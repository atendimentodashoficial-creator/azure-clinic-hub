import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CreditCard, Key, RefreshCw, Download, Eye, EyeOff, Filter,
  ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, Search, FileText, Wallet, X, Landmark
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface BankTransaction {
  id: string;
  operation: string;
  transactionDate: string;
  status: string;
  type: string;
  description: string;
  amountBrl: number;
  isCanceled: boolean;
  category: { id: string; name: string };
  costCenter: { id: string; name: string };
  attachments: { id: string; name: string }[];
}

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

  // Transaction filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // All transactions (single fetch, split client-side)
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [nextPageKey, setNextPageKey] = useState<string | null>(null);

  // Card filters
  const [cardSearchTerm, setCardSearchTerm] = useState("");
  const [cardFilterStatus, setCardFilterStatus] = useState<string>("all");
  const [cardFilterCategory, setCardFilterCategory] = useState<string>("all");
  const [cardFilterCard, setCardFilterCard] = useState<string>("all");

  // Bank filters
  const [bankSearchTerm, setBankSearchTerm] = useState("");
  const [bankFilterStatus, setBankFilterStatus] = useState<string>("all");
  const [bankFilterType, setBankFilterType] = useState<string>("all");

  const [transacoesSubTab, setTransacoesSubTab] = useState("conta-corrente");

  // Load saved credentials from localStorage
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

  // Auto-renew token 2 minutes before expiry
  useEffect(() => {
    if (!token || !tokenExpiresAt || !apiKey || !apiSecret) return;
    const renewIn = (tokenExpiresAt - Date.now()) - 60000; // 1 min before expiry (renews at ~29 min)
    if (renewIn <= 0) {
      authenticate(true);
      return;
    }
    const timer = setTimeout(() => authenticate(true), renewIn);
    return () => clearTimeout(timer);
  }, [token, tokenExpiresAt, apiKey, apiSecret, environment]);

  const isTokenValid = token && tokenExpiresAt && Date.now() < tokenExpiresAt;

  const fetchTransactions = async (pageKey?: string) => {
    if (!isTokenValid) {
      toast.error("Autentique-se primeiro");
      return;
    }
    setIsLoadingTransactions(true);
    try {
      const { data, error } = await supabase.functions.invoke("conta-simples-api", {
        body: {
          action: "credit-card-statements",
          token,
          startDate,
          endDate,
          environment,
          limit: 100,
          ...(pageKey ? { nextPageStartKey: pageKey } : {}),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const txs = data.transactions || data.data || [];
      if (pageKey) {
        setAllTransactions((prev) => [...prev, ...txs]);
      } else {
        setAllTransactions(txs);
      }
      setNextPageKey(data.nextPageStartKey || null);
    } catch (err: any) {
      toast.error(`Erro ao buscar transações: ${err.message}`);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Split transactions client-side: with card = cartões, without card = conta corrente
  const cardTransactions = allTransactions.filter((tx) => tx.card && tx.card.maskedNumber);
  const bankTransactions = allTransactions.filter((tx) => !tx.card || !tx.card.maskedNumber);

  const fetchAll = () => {
    fetchTransactions();
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!isTokenValid) {
      toast.error("Autentique-se primeiro");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("conta-simples-api", {
        body: { action: "download-attachment", token, attachmentId, environment },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Convert base64 to blob and download
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Anexo baixado!");
    } catch (err: any) {
      toast.error(`Erro ao baixar anexo: ${err.message}`);
    }
  };

  // Card filters
  const filteredCardTransactions = cardTransactions.filter((tx) => {
    const term = cardSearchTerm.toLowerCase();
    if (cardSearchTerm && !(
      tx.merchant?.toLowerCase().includes(term) ||
      tx.card?.responsibleName?.toLowerCase().includes(term) ||
      tx.card?.maskedNumber?.includes(term) ||
      tx.category?.name?.toLowerCase().includes(term)
    )) return false;

    if (cardFilterStatus !== "all") {
      if (cardFilterStatus === "canceled" && !tx.isCanceled) return false;
      if (cardFilterStatus === "PROCESSED" && (tx.status !== "PROCESSED" || tx.isCanceled)) return false;
      if (cardFilterStatus === "PENDING" && (tx.status !== "PENDING" || tx.isCanceled)) return false;
    }
    if (cardFilterCategory !== "all" && tx.category?.name !== cardFilterCategory) return false;
    if (cardFilterCard !== "all" && tx.card?.maskedNumber !== cardFilterCard) return false;

    return true;
  });

  const uniqueCategories = [...new Set(cardTransactions.map((t) => t.category?.name).filter(Boolean))].sort();
  const uniqueCards = [...new Set(cardTransactions.map((t) => t.card?.maskedNumber).filter(Boolean))].sort();
  const hasActiveCardFilters = cardFilterStatus !== "all" || cardFilterCategory !== "all" || cardFilterCard !== "all";
  const clearCardFilters = () => { setCardFilterStatus("all"); setCardFilterCategory("all"); setCardFilterCard("all"); setCardSearchTerm(""); };

  // Bank filters
  const filteredBankTransactions = bankTransactions.filter((tx) => {
    const term = bankSearchTerm.toLowerCase();
    if (bankSearchTerm && !(
      (tx as any).description?.toLowerCase().includes(term) ||
      (tx as any).merchant?.toLowerCase().includes(term) ||
      tx.category?.name?.toLowerCase().includes(term)
    )) return false;
    if (bankFilterStatus !== "all") {
      if (bankFilterStatus === "canceled" && !tx.isCanceled) return false;
      if (bankFilterStatus === "PROCESSED" && (tx.status !== "PROCESSED" || tx.isCanceled)) return false;
      if (bankFilterStatus === "PENDING" && (tx.status !== "PENDING" || tx.isCanceled)) return false;
    }
    if (bankFilterType !== "all" && tx.operation !== bankFilterType) return false;
    return true;
  });
  const hasActiveBankFilters = bankFilterStatus !== "all" || bankFilterType !== "all";
  const clearBankFilters = () => { setBankFilterStatus("all"); setBankFilterType("all"); setBankSearchTerm(""); };

  // Card summary for sub-tab
  const cardSummary = uniqueCards.map((maskedNumber) => {
    const cardTxs = cardTransactions.filter((t) => t.card?.maskedNumber === maskedNumber && !t.isCanceled);
    const firstTx = cardTxs[0];
    return {
      maskedNumber,
      responsibleName: firstTx?.card?.responsibleName || "—",
      type: firstTx?.card?.type || "—",
      totalGasto: cardTxs.filter((t) => t.operation === "CASH_OUT").reduce((s, t) => s + t.amountBrl, 0),
      totalTransacoes: cardTxs.length,
      ultimaTransacao: cardTxs.length > 0 ? cardTxs.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0]?.transactionDate : null,
    };
  });

  const getOperationIcon = (op: string) => {
    return op === "CASH_IN" ? (
      <ArrowDownLeft className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-red-500" />
    );
  };

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
          <TabsTrigger value="transacoes" className="gap-1.5">
            <Landmark className="h-4 w-4" />
            Extrato
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure suas credenciais da API Conta Simples. Obtenha suas credenciais no{" "}
              <a
                href="https://ib.contasimples.com/integracoes/api/credenciais"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Internet Banking da Conta Simples
              </a>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Sua API Key"
                />
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
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveCredentials} variant="outline" size="sm">
                Salvar Credenciais
              </Button>
              <Button onClick={() => authenticate()} disabled={isAuthenticating} size="sm">
                {isAuthenticating ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Key className="h-4 w-4 mr-1" />
                )}
                {isAuthenticating ? "Autenticando..." : "Autenticar"}
              </Button>
            </div>

            {isTokenValid && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Token ativo — expira em{" "}
                  {Math.round(((tokenExpiresAt || 0) - Date.now()) / 60000)} minutos
                </p>
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Funcionalidades Disponíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Extrato de Cartão</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Consulte transações de cartão de crédito por período com dados de categoria, centro de custo e responsável.
                </p>
              </div>
              <div className="p-3 border rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Comprovantes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Baixe comprovantes, notas fiscais e recibos anexados às transações em PNG, JPEG ou PDF.
                </p>
              </div>
              <div className="p-3 border rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Conciliação</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Visualize o status de conciliação de cada transação e automatize fluxos financeiros.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transacoes" className="space-y-4">
          {!isTokenValid ? (
            <Card className="p-8 text-center">
              <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">
                Autentique-se na aba "Configuração" para consultar transações.
              </p>
            </Card>
          ) : (
            <>
              {/* Period + fetch */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Fim</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <Button onClick={fetchAll} disabled={isLoadingTransactions} size="sm">
                    {isLoadingTransactions ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Search className="h-4 w-4 mr-1" />
                    )}
                    Buscar
                  </Button>
                </div>
              </Card>

              {/* Sub-tabs */}
              <div className="flex">
                <TabsList className="h-8">
                  <TabsTrigger value="conta-corrente" className="h-8 text-xs gap-1.5" onClick={() => setTransacoesSubTab("conta-corrente")}>
                    <Landmark className="h-4 w-4" />
                    Conta Corrente
                  </TabsTrigger>
                  <TabsTrigger value="cartoes" className="h-8 text-xs gap-1.5" onClick={() => setTransacoesSubTab("cartoes")}>
                    <CreditCard className="h-4 w-4" />
                    Cartões
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ===== CONTA CORRENTE ===== */}
              {transacoesSubTab === "conta-corrente" && (
                <>
                  {/* Bank filters */}
                  {bankTransactions.length > 0 && (
                    <Card className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={bankSearchTerm}
                            onChange={(e) => setBankSearchTerm(e.target.value)}
                            placeholder="Buscar descrição, categoria..."
                            className="pl-9 h-8 text-xs"
                          />
                        </div>
                        <Select value={bankFilterStatus} onValueChange={setBankFilterStatus}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Status</SelectItem>
                            <SelectItem value="PROCESSED">Processada</SelectItem>
                            <SelectItem value="PENDING">Pendente</SelectItem>
                            <SelectItem value="canceled">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={bankFilterType} onValueChange={setBankFilterType}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Tipos</SelectItem>
                            <SelectItem value="CASH_OUT">Saída</SelectItem>
                            <SelectItem value="CASH_IN">Entrada</SelectItem>
                          </SelectContent>
                        </Select>
                        {hasActiveBankFilters && (
                          <Button variant="ghost" size="sm" onClick={clearBankFilters} className="h-8 text-xs gap-1">
                            <X className="h-3 w-3" />
                            Limpar
                          </Button>
                        )}
                      </div>
                      {hasActiveBankFilters && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {filteredBankTransactions.length} de {bankTransactions.length} movimentações
                        </p>
                      )}
                    </Card>
                  )}

                  {filteredBankTransactions.length > 0 ? (
                    <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBankTransactions.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>{getOperationIcon(tx.operation)}</TableCell>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {format(new Date(tx.transactionDate), "dd/MM/yy HH:mm")}
                                </TableCell>
                                <TableCell className="text-sm font-medium max-w-[250px] truncate">
                                  {(tx as any).description || (tx as any).merchant || "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {tx.category?.name || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  <span className={tx.operation === "CASH_IN" ? "text-green-500" : "text-foreground"}>
                                    {tx.operation === "CASH_IN" ? "+" : "-"} R${" "}
                                    {tx.amountBrl?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
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
                          <Button variant="outline" size="sm" onClick={() => fetchTransactions(nextPageKey)} disabled={isLoadingTransactions}>
                            {isLoadingTransactions ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
                            Carregar mais
                          </Button>
                        </div>
                      )}
                    </Card>
                  ) : bankTransactions.length === 0 && !isLoadingTransactions ? (
                    <Card className="p-8 text-center text-muted-foreground">
                      <Landmark className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>Clique em "Buscar" para consultar o extrato da conta corrente.</p>
                    </Card>
                  ) : null}

                  {isLoadingTransactions && bankTransactions.length === 0 && (
                    <Card className="p-8 text-center text-muted-foreground">
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
                      <p>Carregando extrato...</p>
                    </Card>
                  )}

                  {/* Bank summary */}
                  {bankTransactions.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-xl font-bold">{bankTransactions.length}</p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Entradas</p>
                        <p className="text-xl font-bold text-green-500">
                          R$ {bankTransactions.filter((t) => t.operation === "CASH_IN" && !t.isCanceled).reduce((s, t) => s + (t.amountBrl || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Saídas</p>
                        <p className="text-xl font-bold text-red-500">
                          R$ {bankTransactions.filter((t) => t.operation === "CASH_OUT" && !t.isCanceled).reduce((s, t) => s + (t.amountBrl || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Canceladas</p>
                        <p className="text-xl font-bold text-muted-foreground">{bankTransactions.filter((t) => t.isCanceled).length}</p>
                      </Card>
                    </div>
                  )}
                </>
              )}

              {/* ===== CARTÕES ===== */}
              {transacoesSubTab === "cartoes" && (
                <>
                  {/* Card summary table */}
                  {cardSummary.length > 0 && (
                    <Card className="overflow-hidden">
                      <div className="p-3 border-b">
                        <h3 className="text-sm font-medium">Resumo por Cartão</h3>
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
                              <TableRow key={card.maskedNumber} className="cursor-pointer hover:bg-muted/50" onClick={() => { setCardFilterCard(card.maskedNumber!); }}>
                                <TableCell className="font-mono text-sm">{card.maskedNumber}</TableCell>
                                <TableCell className="text-sm">{card.responsibleName}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{card.type}</Badge></TableCell>
                                <TableCell className="text-right font-mono text-sm text-red-500">
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
                  )}

                  {/* Card transactions filters */}
                  {cardTransactions.length > 0 && (
                    <Card className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={cardSearchTerm}
                            onChange={(e) => setCardSearchTerm(e.target.value)}
                            placeholder="Buscar estabelecimento, responsável..."
                            className="pl-9 h-8 text-xs"
                          />
                        </div>
                        <Select value={cardFilterStatus} onValueChange={setCardFilterStatus}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Status</SelectItem>
                            <SelectItem value="PROCESSED">Processada</SelectItem>
                            <SelectItem value="PENDING">Pendente</SelectItem>
                            <SelectItem value="canceled">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                        {uniqueCategories.length > 0 && (
                          <Select value={cardFilterCategory} onValueChange={setCardFilterCategory}>
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas Categorias</SelectItem>
                              {uniqueCategories.map((cat) => (
                                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {uniqueCards.length > 1 && (
                          <Select value={cardFilterCard} onValueChange={setCardFilterCard}>
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                              <SelectValue placeholder="Cartão" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos Cartões</SelectItem>
                              {uniqueCards.map((c) => (
                                <SelectItem key={c} value={c!}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {hasActiveCardFilters && (
                          <Button variant="ghost" size="sm" onClick={clearCardFilters} className="h-8 text-xs gap-1">
                            <X className="h-3 w-3" />
                            Limpar
                          </Button>
                        )}
                      </div>
                      {hasActiveCardFilters && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {filteredCardTransactions.length} de {cardTransactions.length} transações
                        </p>
                      )}
                    </Card>
                  )}

              {filteredCardTransactions.length > 0 ? (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Estabelecimento</TableHead>
                          <TableHead>Cartão</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCardTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>{getOperationIcon(tx.operation)}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(tx.transactionDate), "dd/MM/yy HH:mm")}
                            </TableCell>
                            <TableCell className="text-sm font-medium max-w-[200px] truncate">
                              {tx.merchant}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div>{tx.card?.maskedNumber}</div>
                              <div className="text-[10px]">{tx.card?.responsibleName}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {tx.category?.name || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              <span className={tx.operation === "CASH_IN" ? "text-green-500" : "text-foreground"}>
                                {tx.operation === "CASH_IN" ? "+" : "-"} R${" "}
                                {tx.amountBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              {tx.installment > 1 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({tx.installment}x)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(tx.status, tx.isCanceled)}</TableCell>
                            <TableCell>
                              {tx.attachments?.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    downloadAttachment(tx.attachments[0].id, tx.attachments[0].name)
                                  }
                                  title="Baixar comprovante"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {cardNextPageKey && (
                    <div className="p-3 border-t text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchCardTransactions(cardNextPageKey)}
                        disabled={isLoadingCards}
                      >
                        {isLoadingCards ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Carregar mais
                      </Button>
                    </div>
                  )}
                </Card>
              ) : cardTransactions.length === 0 && !isLoadingCards ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Clique em "Buscar" para consultar as transações de cartão do período.</p>
                </Card>
              ) : null}

              {isLoadingCards && cardTransactions.length === 0 && (
                <Card className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
                  <p>Carregando transações de cartão...</p>
                </Card>
              )}

              {/* Summary cards */}
              {cardTransactions.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{cardTransactions.length}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Saídas</p>
                    <p className="text-xl font-bold text-red-500">
                      R${" "}
                      {cardTransactions
                        .filter((t) => t.operation === "CASH_OUT" && !t.isCanceled)
                        .reduce((s, t) => s + t.amountBrl, 0)
                        .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Conciliadas</p>
                    <p className="text-xl font-bold text-green-500">
                      {cardTransactions.filter((t) => t.isConciled).length}
                    </p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Canceladas</p>
                    <p className="text-xl font-bold text-muted-foreground">
                      {cardTransactions.filter((t) => t.isCanceled).length}
                    </p>
                  </Card>
                </div>
              )}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
