import { useState, useMemo } from "react";
import { useCobrancas, Cobranca } from "@/hooks/useCobrancas";
import { NovaCobrancaDialog } from "@/components/cobrancas/NovaCobrancaDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign, Clock, CheckCircle2, AlertTriangle, XCircle,
  Edit, Trash2, RefreshCw, CreditCard, Receipt, TrendingUp, Calendar,
  BarChart3, ShoppingBag, Wallet, Filter, Search, Users,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  clienteId: string;
  valorContrato?: number;
  comissoes?: any[];
  clienteTarefas?: any[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  pago: { label: "Pago", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  atrasado: { label: "Atrasado", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
};

const metodoLabels: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

const periodoOptions = [
  { value: "todos", label: "Todos" },
  { value: "mes_atual", label: "Mês Atual" },
  { value: "mes_anterior", label: "Mês Anterior" },
  { value: "3_meses", label: "Últimos 3 meses" },
  { value: "6_meses", label: "Últimos 6 meses" },
  { value: "12_meses", label: "Últimos 12 meses" },
];

const statusFilterOptions = [
  { value: "todos", label: "Todos os Status" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" },
];

export function ClienteFinanceiroTab({ clienteId, valorContrato = 0, comissoes = [], clienteTarefas = [] }: Props) {
  const { cobrancas, isLoading, criarCobranca, atualizarCobranca, excluirCobranca } = useCobrancas(clienteId);
  const [editando, setEditando] = useState<Cobranca | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState("resumo");
  const [periodo, setPeriodo] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [busca, setBusca] = useState("");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  // Period filter logic
  const getDateRange = () => {
    const now = new Date();
    switch (periodo) {
      case "mes_atual": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "mes_anterior": { const prev = subMonths(now, 1); return { start: startOfMonth(prev), end: endOfMonth(prev) }; }
      case "3_meses": return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "6_meses": return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      case "12_meses": return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) };
      default: return null;
    }
  };

  const filterByPeriod = (items: Cobranca[]) => {
    const range = getDateRange();
    if (!range) return items;
    return items.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return isWithinInterval(d, { start: range.start, end: range.end });
    });
  };

  const filterByStatus = (items: Cobranca[]) => {
    if (statusFilter === "todos") return items;
    return items.filter(c => c.status === statusFilter);
  };

  const filterBySearch = (items: Cobranca[]) => {
    if (!busca.trim()) return items;
    const term = busca.toLowerCase();
    return items.filter(c =>
      c.descricao.toLowerCase().includes(term) ||
      c.observacoes?.toLowerCase().includes(term)
    );
  };

  const applyFilters = (items: Cobranca[]) => filterBySearch(filterByStatus(filterByPeriod(items)));

  // Filtered lists by type
  const todasCobrancas = useMemo(() => applyFilters(cobrancas), [cobrancas, periodo, statusFilter, busca]);
  const mensalidades = useMemo(() => applyFilters(cobrancas.filter(c => c.tipo === "mrr")), [cobrancas, periodo, statusFilter, busca]);
  const vendas = useMemo(() => applyFilters(cobrancas.filter(c => c.tipo === "unico")), [cobrancas, periodo, statusFilter, busca]);

  // Stats
  const stats = useMemo(() => {
    const all = filterByPeriod(cobrancas);
    const mrr = all.filter(c => c.tipo === "mrr" && c.status !== "cancelado");
    const mrrAtivo = mrr.reduce((a, c) => a + c.valor, 0);
    const totalRecebido = all.filter(c => c.status === "pago").reduce((a, c) => a + c.valor, 0);
    const totalPendente = all.filter(c => c.status === "pendente").reduce((a, c) => a + c.valor, 0);
    const totalAtrasado = all.filter(c => c.status === "atrasado").reduce((a, c) => a + c.valor, 0);
    const vendasTotal = all.filter(c => c.tipo === "unico" && c.status === "pago").reduce((a, c) => a + c.valor, 0);
    const totalComissoes = comissoes.reduce((a: number, c: any) => a + (c.valor || 0), 0);
    const comissoesPendentes = comissoes.filter((c: any) => c.status === "pendente").reduce((a: number, c: any) => a + (c.valor || 0), 0);
    const lucroLiquido = totalRecebido - totalComissoes;
    return { mrrAtivo, totalRecebido, totalPendente, totalAtrasado, vendasTotal, totalComissoes, comissoesPendentes, lucroLiquido };
  }, [cobrancas, comissoes, periodo]);

  const handleCriar = (data: any) => {
    criarCobranca.mutate(data, {
      onSuccess: () => toast.success("Cobrança criada!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: any) => {
    const { id, ...rest } = data;
    atualizarCobranca.mutate({ id, ...rest }, {
      onSuccess: () => { toast.success("Cobrança atualizada!"); setEditando(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleExcluir = () => {
    if (!excluirId) return;
    excluirCobranca.mutate(excluirId, {
      onSuccess: () => { toast.success("Cobrança excluída"); setExcluirId(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleMarcarPago = (cobranca: Cobranca) => {
    atualizarCobranca.mutate({
      id: cobranca.id,
      status: "pago",
      data_pagamento: new Date().toISOString().split("T")[0],
    } as any, {
      onSuccess: () => toast.success("Marcado como pago!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  // Shared card renderer
  const renderCobrancaCard = (c: Cobranca) => {
    const cfg = statusConfig[c.status] || statusConfig.pendente;
    const isOverdue = c.status === "atrasado";
    return (
      <Card
        key={c.id}
        className={`p-4 transition-colors hover:border-primary/30 ${isOverdue ? "border-destructive/30 bg-destructive/5" : ""}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{c.descricao}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-medium">
                {c.tipo === "mrr" ? "MRR" : "Único"}
              </Badge>
              {c.recorrencia_ativa && (
                <Badge className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5 bg-secondary text-secondary-foreground">
                  <RefreshCw className="h-2.5 w-2.5" /> Auto
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Venc: {formatDate(c.data_vencimento)}
              </span>
              {c.data_pagamento && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Pago: {formatDate(c.data_pagamento)}
                </span>
              )}
              {c.metodo_pagamento && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                  {metodoLabels[c.metodo_pagamento] || c.metodo_pagamento}
                </Badge>
              )}
            </div>
            {c.observacoes && (
              <p className="text-xs text-muted-foreground/70 truncate max-w-md italic">{c.observacoes}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={cfg.variant} className="text-xs gap-1 px-2 py-0.5">
              {cfg.icon}
              {cfg.label}
            </Badge>
            <span className="text-base font-bold whitespace-nowrap tabular-nums">{formatCurrency(c.valor)}</span>
            <div className="flex items-center gap-0.5 border-l pl-2 border-border">
              {c.status === "pendente" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => handleMarcarPago(c)} title="Marcar como pago">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(c)}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setExcluirId(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderList = (items: Cobranca[]) => {
    if (items.length === 0) {
      return <Card className="p-8 text-center text-muted-foreground">Nenhum registro encontrado</Card>;
    }
    return <div className="space-y-2.5">{items.map(renderCobrancaCard)}</div>;
  };

  // Filters bar
  const FiltersBar = () => (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar cobrança..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9 h-8 text-xs"
        />
      </div>
      <Select value={periodo} onValueChange={setPeriodo}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <Calendar className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodoOptions.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusFilterOptions.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <NovaCobrancaDialog clienteId={clienteId} onSubmit={handleCriar} />
    </div>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats overview - always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "MRR Ativo", value: formatCurrency(stats.mrrAtivo), icon: <TrendingUp className="h-4 w-4" />, color: "text-primary" },
          { label: "Recebido", value: formatCurrency(stats.totalRecebido), icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
          { label: "Pendente", value: formatCurrency(stats.totalPendente), icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
          { label: "Atrasado", value: formatCurrency(stats.totalAtrasado), icon: <AlertTriangle className="h-4 w-4" />, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              {s.icon}
              <span className="text-xs">{s.label}</span>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="cobrancas" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Cobranças
          </TabsTrigger>
          <TabsTrigger value="mensalidades" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Mensalidades
          </TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-1.5">
            <Users className="h-4 w-4" />
            Comissões
          </TabsTrigger>
        </TabsList>

        {/* ── Resumo ── */}
        <TabsContent value="resumo">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Valor do Contrato", value: formatCurrency(valorContrato), icon: <Wallet className="h-4 w-4" /> },
                { label: "Vendas Únicas", value: formatCurrency(stats.vendasTotal), icon: <ShoppingBag className="h-4 w-4" /> },
                { label: "Comissões Totais", value: formatCurrency(stats.totalComissoes), icon: <Users className="h-4 w-4" /> },
                { label: "Lucro Líquido", value: formatCurrency(stats.lucroLiquido), icon: <TrendingUp className="h-4 w-4" />, color: stats.lucroLiquido >= 0 ? "text-green-600" : "text-destructive" },
              ].map(s => (
                <Card key={s.label} className="p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    {s.icon}
                    <span className="text-xs">{s.label}</span>
                  </div>
                  <p className={`text-lg font-bold ${"color" in s ? s.color : "text-foreground"}`}>{s.value}</p>
                </Card>
              ))}
            </div>

            {/* Recent activity */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Últimas Movimentações</h3>
                <Badge variant="outline" className="text-xs">{cobrancas.length} registros</Badge>
              </div>
              <div className="divide-y max-h-[350px] overflow-y-auto scrollbar-subtle">
                {cobrancas.slice(0, 10).map(c => {
                  const cfg = statusConfig[c.status] || statusConfig.pendente;
                  return (
                    <div key={c.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{c.descricao}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {c.tipo === "mrr" ? "MRR" : "Único"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Venc: {formatDate(c.data_vencimento)}
                          {c.data_pagamento && ` · Pago: ${formatDate(c.data_pagamento)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={cfg.variant} className="text-[10px] gap-0.5 px-1.5 py-0">
                          {cfg.icon}{cfg.label}
                        </Badge>
                        <span className="text-sm font-bold tabular-nums">{formatCurrency(c.valor)}</span>
                      </div>
                    </div>
                  );
                })}
                {cobrancas.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma movimentação</div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Cobranças (todas) ── */}
        <TabsContent value="cobrancas">
          <div className="space-y-4">
            <FiltersBar />
            {renderList(todasCobrancas)}
          </div>
        </TabsContent>

        {/* ── Mensalidades (MRR) ── */}
        <TabsContent value="mensalidades">
          <div className="space-y-4">
            <FiltersBar />
            {renderList(mensalidades)}
          </div>
        </TabsContent>

        {/* ── Vendas (único) ── */}
        <TabsContent value="vendas">
          <div className="space-y-4">
            <FiltersBar />
            {renderList(vendas)}
          </div>
        </TabsContent>

        {/* ── Comissões ── */}
        <TabsContent value="comissoes">
          <div className="space-y-4">
            {comissoes.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Total Comissões", value: formatCurrency(stats.totalComissoes), icon: <DollarSign className="h-4 w-4" /> },
                    { label: "Pendentes", value: formatCurrency(stats.comissoesPendentes), icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
                    { label: "Aprovadas", value: formatCurrency(stats.totalComissoes - stats.comissoesPendentes), icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
                  ].map(s => (
                    <Card key={s.label} className="p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        {s.icon}
                        <span className="text-xs">{s.label}</span>
                      </div>
                      <p className={`text-lg font-bold ${"color" in s ? s.color : "text-foreground"}`}>{s.value}</p>
                    </Card>
                  ))}
                </div>

                <Card className="overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-sm">Histórico de Comissões</h3>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto scrollbar-subtle">
                    {comissoes.map((c: any) => {
                      const tarefa = clienteTarefas.find((t: any) => t.id === c.tarefa_id);
                      return (
                        <div key={c.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{tarefa?.titulo || "Tarefa removida"}</p>
                            <p className="text-xs text-muted-foreground">{c.membro_nome} · {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={c.status === "aprovado" ? "default" : "secondary"} className="text-xs">
                              {c.status === "aprovado" ? "Aprovado" : "Pendente"}
                            </Badge>
                            <span className="text-sm font-bold tabular-nums">{formatCurrency(c.valor)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhuma comissão registrada para este cliente
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      {editando && (
        <NovaCobrancaDialog
          clienteId={clienteId}
          editando={editando}
          onSubmit={handleAtualizar}
          onClose={() => setEditando(null)}
          externalOpen={true}
        />
      )}

      {/* Confirm delete */}
      <AlertDialog open={!!excluirId} onOpenChange={(v) => !v && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
