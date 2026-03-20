import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  CreditCard, Key, RefreshCw, Eye, EyeOff, Building2,
  ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, Search, FileText, X
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ContaPJConfig } from "./ContaPJConfig";

interface ContaSimplesCreds {
  api_key: string;
  api_secret: string;
  environment: "sandbox" | "production";
}

interface CardTransaction {
  id: string;
  operation: string;
  transactionDate: string;
  status: string;
  type: string;
  merchant: string;
  amountBrl: number;
  exchangeRateUsd: number;
  isCanceled: boolean;
  isConciled: boolean;
  installment: number;
  card: {
    id: string;
    maskedNumber: string;
    responsibleName: string;
    responsibleEmail: string;
    type: string;
  };
  category: { id: string; name: string };
  costCenter: { id: string; name: string };
  attachments: { id: string; name: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  PURCHASE_INTERNATIONAL: "Compra Internacional",
  PURCHASE_BNPL: "Compra Parcelada",
  WITHDRAW: "Saque",
  WITHDRAW_INTERNATIONAL: "Saque Internacional",
  WITHDRAW_FUNDS: "Resgate",
  REFUND: "Estorno",
  REFUND_INTERNATIONAL: "Estorno Internacional",
  REFUND_CREDIT_ADJUSTMENT: "Ajuste Crédito",
  REVERSAL_CREDIT_ADJUSTMENT: "Reversão Ajuste",
  REFUND_IOF: "Estorno IOF",
  REFUND_PURCHASE_BNPL: "Estorno Parcelada",
  IOF: "IOF",
  LIMIT: "Ajuste Limite (Débito)",
  LIMIT_CREDIT: "Ajuste Limite (Crédito)",
  SUMMARY: "Resumo",
  BILL_TARIFF: "Tarifa",
  REFUND_BILL_TARIFF: "Estorno Tarifa",
  INVOICE_PAYMENT: "Pagamento Fatura",
  BALANCE_INQUIRY: "Consulta Saldo",
};

export function ContaSimpleConfig() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [showSecret, setShowSecret] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextPageKey, setNextPageKey] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Selected card (null = show all)
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const saved = localStorage.getItem(`conta-simples-creds-${ownerId}`);
    if (saved) {
      try {
        const creds: ContaSimplesCreds = JSON.parse(saved);
        setApiKey(creds.api_key);
        setApiSecret(creds.api_secret);
        setEnvironment(creds.environment);
      } catch {}
    }
  }, [ownerId]);

  const saveCredentials = () => {
    if (!ownerId || !apiKey || !apiSecret) {
      toast.error("Preencha API Key e API Secret");
      return;
    }
    const creds: ContaSimplesCreds = { api_key: apiKey, api_secret: apiSecret, environment };
    localStorage.setItem(`conta-simples-creds-${ownerId}`, JSON.stringify(creds));
    toast.success("Credenciais salvas localmente");
  };

  const authenticate = async (silent = false) => {
    if (!apiKey || !apiSecret) {
      if (!silent) toast.error("Preencha API Key e API Secret");
      return;
    }
    if (!silent) setIsAuthenticating(true);
    try {
      const { data, error } = await supabase.functions.invoke("conta-simples-api", {
        body: { action: "authenticate", api_key: apiKey, api_secret: apiSecret, environment },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setToken(data.access_token);
      setTokenExpiresAt(Date.now() + (data.expires_in * 1000));
      if (!silent) toast.success("Autenticado com sucesso!");
    } catch (err: any) {
      if (!silent) toast.error(`Falha na autenticação: ${err.message}`);
    } finally {
      if (!silent) setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (!token || !tokenExpiresAt || !apiKey || !apiSecret) return;
    const renewIn = (tokenExpiresAt - Date.now()) - 60000;
    if (renewIn <= 0) { authenticate(true); return; }
    const timer = setTimeout(() => authenticate(true), renewIn);
    return () => clearTimeout(timer);
  }, [token, tokenExpiresAt, apiKey, apiSecret, environment]);

  const isTokenValid = token && tokenExpiresAt && Date.now() < tokenExpiresAt;

  const fetchTransactions = async (pageKey?: string) => {
    if (!isTokenValid) { toast.error("Autentique-se primeiro"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("conta-simples-api", {
        body: {
          action: "credit-card-statements",
          token, startDate, endDate, environment,
          limit: 100,
          ...(pageKey ? { nextPageStartKey: pageKey } : {}),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const txs = data.transactions || data.data || [];
      if (pageKey) {
        setTransactions((prev) => [...prev, ...txs]);
      } else {
        setTransactions(txs);
      }
      setNextPageKey(data.nextPageStartKey || null);
    } catch (err: any) {
      toast.error(`Erro ao buscar transações: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!isTokenValid) { toast.error("Autentique-se primeiro"); return; }
    try {
      const { data, error } = await supabase.functions.invoke("conta-simples-api", {
        body: { action: "download-attachment", token, attachmentId, environment },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success("Anexo baixado!");
    } catch (err: any) {
      toast.error(`Erro ao baixar anexo: ${err.message}`);
    }
  };

  // Filtered transactions (by selected card + other filters)
  const filteredTransactions = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase();
    if (searchTerm && !(
      tx.merchant?.toLowerCase().includes(term) ||
      tx.card?.responsibleName?.toLowerCase().includes(term) ||
      tx.card?.maskedNumber?.includes(term) ||
      tx.category?.name?.toLowerCase().includes(term) ||
      (TYPE_LABELS[tx.type] || tx.type)?.toLowerCase().includes(term)
    )) return false;

    if (filterStatus !== "all") {
      if (filterStatus === "canceled" && !tx.isCanceled) return false;
      if (filterStatus === "PROCESSED" && (tx.status !== "PROCESSED" || tx.isCanceled)) return false;
      if (filterStatus === "PENDING" && (tx.status !== "PENDING" || tx.isCanceled)) return false;
    }
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (filterCategory !== "all" && tx.category?.name !== filterCategory) return false;
    if (selectedCard && tx.card?.maskedNumber !== selectedCard) return false;
    return true;
  });

  const uniqueCategories = [...new Set(transactions.map((t) => t.category?.name).filter(Boolean))].sort();
  const uniqueCards = [...new Set(transactions.map((t) => t.card?.maskedNumber).filter(Boolean))].sort();
  const uniqueTypes = [...new Set(transactions.map((t) => t.type).filter(Boolean))].sort();
  const hasActiveFilters = filterStatus !== "all" || filterType !== "all" || filterCategory !== "all" || !!selectedCard;
  const clearFilters = () => { setFilterStatus("all"); setFilterType("all"); setFilterCategory("all"); setSelectedCard(null); setSearchTerm(""); };

  // Card summary
  const cardSummary = uniqueCards.map((maskedNumber) => {
    const cardTxs = transactions.filter((t) => t.card?.maskedNumber === maskedNumber && !t.isCanceled);
    const firstTx = cardTxs[0];
    return {
      maskedNumber,
      responsibleName: firstTx?.card?.responsibleName || "—",
      type: firstTx?.card?.type || "—",
      totalGasto: cardTxs.filter((t) => t.operation === "CASH_OUT").reduce((s, t) => s + t.amountBrl, 0),
      totalTransacoes: cardTxs.length,
      ultimaTransacao: cardTxs.length > 0
        ? cardTxs.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0]?.transactionDate
        : null,
    };
  });

  const getOperationIcon = (op: string) =>
    op === "CASH_IN" ? <ArrowDownLeft className="h-4 w-4 text-green-500" /> : <ArrowUpRight className="h-4 w-4 text-red-500" />;

  const getStatusBadge = (status: string, isCanceled: boolean) => {
    if (isCanceled) return <Badge variant="destructive" className="text-xs">Cancelada</Badge>;
    switch (status) {
      case "PROCESSED": return <Badge variant="default" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Processada</Badge>;
      case "PENDING": return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Conta Simples</h2>
        {isTokenValid && (
          <Badge variant="default" className="text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config" className="gap-1.5">
            <Key className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Cartões
          </TabsTrigger>
          <TabsTrigger value="conta-pj" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Conta PJ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure suas credenciais da API Conta Simples. Obtenha suas credenciais no{" "}
              <a href="https://ib.contasimples.com/integracoes/api/credenciais" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Internet Banking da Conta Simples
              </a>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua API Key" />
              </div>
              <div className="space-y-2">
                <Label>API Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Seu API Secret"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveCredentials} variant="outline" size="sm">Salvar Credenciais</Button>
              <Button onClick={() => authenticate()} disabled={isAuthenticating} size="sm">
                {isAuthenticating ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
                {isAuthenticating ? "Autenticando..." : "Autenticar"}
              </Button>
            </div>
            {isTokenValid && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Token ativo — expira em {Math.round(((tokenExpiresAt || 0) - Date.now()) / 60000)} minutos
                </p>
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Funcionalidades Disponíveis</h3>
            <p className="text-xs text-muted-foreground">
              A API da Conta Simples fornece acesso ao extrato de <strong>cartão de crédito</strong> (compras, saques, estornos, ajustes de limite, tarifas, etc.) e download de comprovantes. Transações de conta corrente (PIX, TED, boletos) não estão disponíveis via API no momento.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="cartoes" className="space-y-4">
          {!isTokenValid ? (
            <Card className="p-8 text-center">
              <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Autentique-se na aba "Configuração" para consultar cartões.</p>
            </Card>
          ) : (
            <>
              {/* Period + fetch */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
                  </div>
                  <Button onClick={() => fetchTransactions()} disabled={isLoading} size="sm">
                    {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                    Buscar
                  </Button>
                </div>
              </Card>

              {/* Card summary list */}
              {cardSummary.length > 0 ? (
                <Card className="overflow-hidden">
                  <div className="p-3 border-b flex items-center justify-between">
                    <h3 className="text-sm font-medium">Resumo por Cartão</h3>
                    {selectedCard && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSelectedCard(null)}>
                        <X className="h-3 w-3" />
                        Ver todos
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cartão</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Total Gasto</TableHead>
                          <TableHead className="text-center">Transações</TableHead>
                          <TableHead>Última Transação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cardSummary.map((card) => (
                          <TableRow
                            key={card.maskedNumber}
                            className={`cursor-pointer transition-colors ${selectedCard === card.maskedNumber ? "bg-primary/10" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedCard(selectedCard === card.maskedNumber ? null : card.maskedNumber)}
                          >
                            <TableCell className="font-mono text-sm">•••• {card.maskedNumber}</TableCell>
                            <TableCell className="text-sm">{card.responsibleName}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{card.type}</Badge></TableCell>
                            <TableCell className="text-right font-mono text-sm text-destructive">
                              R$ {card.totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center text-sm">{card.totalTransacoes}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {card.ultimaTransacao ? format(new Date(card.ultimaTransacao), "dd/MM/yy HH:mm") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ) : transactions.length === 0 && !isLoading ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Clique em "Buscar" para consultar os cartões do período.</p>
                </Card>
              ) : null}

              {isLoading && transactions.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
                  <p>Carregando transações...</p>
                </Card>
              )}

              {/* Transactions table (filtered by selected card or all) */}
              {transactions.length > 0 && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-xl font-bold">{filteredTransactions.length}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Saídas</p>
                      <p className="text-xl font-bold text-destructive">
                        R$ {filteredTransactions.filter((t) => t.operation === "CASH_OUT" && !t.isCanceled).reduce((s, t) => s + t.amountBrl, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Conciliadas</p>
                      <p className="text-xl font-bold">{filteredTransactions.filter((t) => t.isConciled).length}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-muted-foreground">Canceladas</p>
                      <p className="text-xl font-bold text-muted-foreground">{filteredTransactions.filter((t) => t.isCanceled).length}</p>
                    </Card>
                  </div>

                  {/* Filters */}
                  <Card className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar estabelecimento, responsável..." className="pl-9 h-8 text-xs" />
                      </div>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos Status</SelectItem>
                          <SelectItem value="PROCESSED">Processada</SelectItem>
                          <SelectItem value="PENDING">Pendente</SelectItem>
                          <SelectItem value="canceled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                      {uniqueTypes.length > 1 && (
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Tipos</SelectItem>
                            {uniqueTypes.map((t) => (
                              <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {uniqueCategories.length > 1 && (
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas Categorias</SelectItem>
                            {uniqueCategories.map((cat) => (
                              <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                          <X className="h-3 w-3" />
                          Limpar
                        </Button>
                      )}
                    </div>
                    {(hasActiveFilters || searchTerm) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {filteredTransactions.length} de {transactions.length} transações
                        {selectedCard && <span> · Cartão •••• {selectedCard}</span>}
                      </p>
                    )}
                  </Card>

                  {/* Transactions table */}
                  {filteredTransactions.length > 0 && (
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Estabelecimento</TableHead>
                              <TableHead>Tipo</TableHead>
                              {!selectedCard && <TableHead>Cartão</TableHead>}
                              <TableHead>Categoria</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTransactions.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>{getOperationIcon(tx.operation)}</TableCell>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {format(new Date(tx.transactionDate), "dd/MM/yy HH:mm")}
                                </TableCell>
                                <TableCell className="text-sm font-medium max-w-[200px] truncate">{tx.merchant}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[tx.type] || tx.type}</Badge>
                                </TableCell>
                                {!selectedCard && (
                                  <TableCell className="text-xs text-muted-foreground">
                                    <div>{tx.card?.maskedNumber}</div>
                                    <div className="text-[10px]">{tx.card?.responsibleName}</div>
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{tx.category?.name || "—"}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  <span className={tx.operation === "CASH_IN" ? "text-green-600 dark:text-green-400" : "text-foreground"}>
                                    {tx.operation === "CASH_IN" ? "+" : "-"} R$ {tx.amountBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                  {tx.installment > 1 && (
                                    <span className="text-xs text-muted-foreground ml-1">({tx.installment}x)</span>
                                  )}
                                </TableCell>
                                <TableCell>{getStatusBadge(tx.status, tx.isCanceled)}</TableCell>
                                <TableCell>
                                  {tx.attachments?.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => downloadAttachment(tx.attachments[0].id, tx.attachments[0].name)} title="Baixar comprovante">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {nextPageKey && (
                        <div className="p-3 border-t text-center">
                          <Button variant="outline" size="sm" onClick={() => fetchTransactions(nextPageKey)} disabled={isLoading}>
                            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
                            Carregar mais
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="conta-pj" className="space-y-4">
          <ContaPJConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
