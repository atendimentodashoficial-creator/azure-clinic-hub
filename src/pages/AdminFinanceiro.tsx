import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Cobranca } from "@/hooks/useCobrancas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  Users, TrendingUp, AlertTriangle, Receipt, RefreshCw, ShoppingBag,
  BarChart3, Search, Filter, Calendar, Wallet, CreditCard,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comissao {
  id: string;
  tarefa_id: string;
  user_id: string;
  membro_nome: string;
  valor: number;
  status: string;
  aprovado_em: string | null;
  created_at: string;
  tarefa?: { titulo: string; coluna_id: string } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  pago: { label: "Pago", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  atrasado: { label: "Atrasado", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
};

const metodoLabels: Record<string, string> = {
  pix: "PIX", boleto: "Boleto", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro",
};

const periodoOptions = [
  { value: "mes_atual", label: "Mês Atual" },
  { value: "mes_anterior", label: "Mês Anterior" },
  { value: "3_meses", label: "Últimos 3 meses" },
  { value: "6_meses", label: "Últimos 6 meses" },
  { value: "12_meses", label: "Últimos 12 meses" },
  { value: "todos", label: "Todos" },
];

const statusFilterOptions = [
  { value: "todos", label: "Todos os Status" },
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default function AdminFinanceiro() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroMembro, setFiltroMembro] = useState("todos");
  const [mainTab, setMainTab] = useState("resumo");
  const [periodo, setPeriodo] = useState("mes_atual");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [busca, setBusca] = useState("");
  const [clienteFilter, setClienteFilter] = useState("todos");

  const inicio = format(startOfMonth(mesAtual), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesAtual), "yyyy-MM-dd");

  // Fetch comissões
  const { data: comissoes = [], isLoading: comissoesLoading } = useQuery({
    queryKey: ["admin-comissoes", user?.id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("*, tarefa:tarefas(titulo, coluna_id)")
        .eq("user_id", user!.id)
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Comissao[];
    },
    enabled: !!user?.id,
  });

  // Fetch membros
  const { data: membros = [] } = useQuery({
    queryKey: ["tarefas-membros-financeiro", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_membros")
        .select("id, nome, salario")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as { id: string; nome: string; salario: number | null }[];
    },
    enabled: !!user?.id,
  });

  // Fetch ALL cobrancas (across all clients)
  const { data: todasCobrancas = [], isLoading: cobrancasLoading } = useQuery({
    queryKey: ["admin-all-cobrancas", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("user_id", ownerId!)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return (data || []) as Cobranca[];
    },
    enabled: !!ownerId,
  });

  // Fetch clientes for filter
  const { data: clientes = [] } = useQuery({
    queryKey: ["tarefas-clientes-fin", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas_clientes")
        .select("id, nome, empresa, tipo")
        .eq("user_id", ownerId!)
        .neq("tipo", "preview");
      if (error) throw error;
      return data as { id: string; nome: string; empresa: string | null; tipo: string }[];
    },
    enabled: !!ownerId,
  });

  // Approve/reject mutation
  const aprovarMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovada" | "rejeitada" }) => {
      const { error } = await supabase
        .from("comissoes")
        .update({
          status,
          aprovado_em: status === "aprovada" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes"] });
      toast.success(status === "aprovada" ? "Comissão aprovada!" : "Comissão rejeitada.");
    },
    onError: () => toast.error("Erro ao atualizar comissão"),
  });

  // ── Filtering logic for cobrancas ──
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

  const applyFilters = (items: Cobranca[]) => {
    let result = items;
    const range = getDateRange();
    if (range) {
      result = result.filter(c => {
        const d = new Date(c.data_vencimento + "T12:00:00");
        return isWithinInterval(d, { start: range.start, end: range.end });
      });
    }
    if (statusFilter !== "todos") result = result.filter(c => c.status === statusFilter);
    if (clienteFilter !== "todos") result = result.filter(c => c.cliente_id === clienteFilter);
    if (busca.trim()) {
      const term = busca.toLowerCase();
      result = result.filter(c => c.descricao.toLowerCase().includes(term) || c.observacoes?.toLowerCase().includes(term));
    }
    return result;
  };

  const cobrancasFiltradas = useMemo(() => applyFilters(todasCobrancas), [todasCobrancas, periodo, statusFilter, clienteFilter, busca]);
  const mensalidades = useMemo(() => applyFilters(todasCobrancas.filter(c => c.tipo === "mrr")), [todasCobrancas, periodo, statusFilter, clienteFilter, busca]);
  const vendas = useMemo(() => applyFilters(todasCobrancas.filter(c => c.tipo === "unico")), [todasCobrancas, periodo, statusFilter, clienteFilter, busca]);

  // ── Comissões filtering ──
  const comissoesFiltradas = useMemo(() => {
    if (filtroMembro === "todos") return comissoes;
    return comissoes.filter(c => c.membro_nome === filtroMembro);
  }, [comissoes, filtroMembro]);

  const pendentes = comissoesFiltradas.filter(c => c.status === "pendente");
  const aprovadas = comissoesFiltradas.filter(c => c.status === "aprovada");
  const rejeitadas = comissoesFiltradas.filter(c => c.status === "rejeitada");
  const totalAprovado = aprovadas.reduce((s, c) => s + c.valor, 0);
  const totalPendente = pendentes.reduce((s, c) => s + c.valor, 0);
  const membrosUnicos = [...new Set(comissoes.map(c => c.membro_nome))];

  // ── Global stats ──
  const globalStats = useMemo(() => {
    const filtered = applyFilters(todasCobrancas);
    const mrrAtivo = filtered.filter(c => c.tipo === "mrr" && c.status !== "cancelado").reduce((a, c) => a + c.valor, 0);
    const totalRecebido = filtered.filter(c => c.status === "pago").reduce((a, c) => a + c.valor, 0);
    const totalPend = filtered.filter(c => c.status === "pendente").reduce((a, c) => a + c.valor, 0);
    const totalAtrasado = filtered.filter(c => c.status === "atrasado").reduce((a, c) => a + c.valor, 0);
    const vendasTotal = filtered.filter(c => c.tipo === "unico" && c.status === "pago").reduce((a, c) => a + c.valor, 0);
    const totalSalarios = membros.reduce((a, m) => a + (m.salario || 0), 0);
    return { mrrAtivo, totalRecebido, totalPend, totalAtrasado, vendasTotal, totalSalarios };
  }, [todasCobrancas, membros, periodo, statusFilter, clienteFilter, busca]);

  const clienteNome = (clienteId: string) => {
    const c = clientes.find(cl => cl.id === clienteId);
    return c ? (c.empresa || c.nome) : "—";
  };

  // ── Cobrança card renderer ──
  const renderCobrancaCard = (c: Cobranca) => {
    const cfg = statusConfig[c.status] || statusConfig.pendente;
    const isOverdue = c.status === "atrasado";
    return (
      <Card key={c.id} className={`p-4 transition-colors hover:border-primary/30 ${isOverdue ? "border-destructive/30 bg-destructive/5" : ""}`}>
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {clienteNome(c.cliente_id)}
              </span>
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
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={cfg.variant} className="text-xs gap-1 px-2 py-0.5">
              {cfg.icon}{cfg.label}
            </Badge>
            <span className="text-base font-bold whitespace-nowrap tabular-nums">{formatCurrency(c.valor)}</span>
          </div>
        </div>
      </Card>
    );
  };

  const renderCobrancaList = (items: Cobranca[]) => {
    if (items.length === 0) return <Card className="p-8 text-center text-muted-foreground">Nenhum registro encontrado</Card>;
    return <div className="space-y-2.5">{items.map(renderCobrancaCard)}</div>;
  };

  // ── Filters bar ──
  const FiltersBar = () => (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Buscar cobrança..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-8 text-xs" />
      </div>
      <Select value={periodo} onValueChange={setPeriodo}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <Calendar className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusFilterOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={clienteFilter} onValueChange={setClienteFilter}>
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <Users className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os Clientes</SelectItem>
          {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.empresa || c.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const isLoading = comissoesLoading || cobrancasLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Financeiro
        </h1>
        <p className="text-muted-foreground">Visão completa de receitas, cobranças e comissões da equipe</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "MRR Ativo", value: formatCurrency(globalStats.mrrAtivo), icon: <TrendingUp className="h-4 w-4" />, color: "text-primary" },
          { label: "Recebido", value: formatCurrency(globalStats.totalRecebido), icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
          { label: "Pendente", value: formatCurrency(globalStats.totalPend), icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
          { label: "Atrasado", value: formatCurrency(globalStats.totalAtrasado), icon: <AlertTriangle className="h-4 w-4" />, color: "text-destructive" },
          { label: "Vendas Únicas", value: formatCurrency(globalStats.vendasTotal), icon: <ShoppingBag className="h-4 w-4" />, color: "text-foreground" },
          { label: "Folha Salarial", value: formatCurrency(globalStats.totalSalarios), icon: <Wallet className="h-4 w-4" />, color: "text-foreground" },
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

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo" className="gap-1.5"><BarChart3 className="h-4 w-4" />Resumo</TabsTrigger>
          <TabsTrigger value="cobrancas" className="gap-1.5"><Receipt className="h-4 w-4" />Cobranças</TabsTrigger>
          <TabsTrigger value="mensalidades" className="gap-1.5"><RefreshCw className="h-4 w-4" />Mensalidades</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5"><ShoppingBag className="h-4 w-4" />Vendas</TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-1.5"><Users className="h-4 w-4" />Comissões</TabsTrigger>
        </TabsList>

        {/* ── Resumo ── */}
        <TabsContent value="resumo">
          <div className="space-y-4">
            {/* Top clients by revenue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-sm">Últimas Cobranças</h3>
                </div>
                <div className="divide-y max-h-[350px] overflow-y-auto">
                  {todasCobrancas.slice(0, 10).map(c => {
                    const cfg = statusConfig[c.status] || statusConfig.pendente;
                    return (
                      <div key={c.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{c.descricao}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.tipo === "mrr" ? "MRR" : "Único"}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {clienteNome(c.cliente_id)} · Venc: {formatDate(c.data_vencimento)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={cfg.variant} className="text-[10px] gap-0.5 px-1.5 py-0">{cfg.icon}{cfg.label}</Badge>
                          <span className="text-sm font-bold tabular-nums">{formatCurrency(c.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {todasCobrancas.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma cobrança</div>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-sm">Comissões Pendentes</h3>
                </div>
                <div className="divide-y max-h-[350px] overflow-y-auto">
                  {pendentes.length > 0 ? pendentes.slice(0, 10).map(c => (
                    <div key={c.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{(c.tarefa as any)?.titulo || "Tarefa removida"}</p>
                        <p className="text-xs text-muted-foreground">{c.membro_nome} · {format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{formatCurrency(c.valor)}</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => aprovarMutation.mutate({ id: c.id, status: "aprovada" })} disabled={aprovarMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => aprovarMutation.mutate({ id: c.id, status: "rejeitada" })} disabled={aprovarMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma comissão pendente</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Revenue by client */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Receita por Cliente</h3>
                <Badge variant="outline" className="text-xs">{clientes.length} clientes</Badge>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {clientes.map(cl => {
                  const clienteCobrancas = todasCobrancas.filter(c => c.cliente_id === cl.id);
                  const recebido = clienteCobrancas.filter(c => c.status === "pago").reduce((a, c) => a + c.valor, 0);
                  const pendente = clienteCobrancas.filter(c => c.status === "pendente" || c.status === "atrasado").reduce((a, c) => a + c.valor, 0);
                  if (clienteCobrancas.length === 0) return null;
                  return (
                    <div key={cl.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{cl.empresa || cl.nome}</p>
                        <p className="text-xs text-muted-foreground">{clienteCobrancas.length} cobranças</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Recebido</p>
                          <p className="text-sm font-bold text-green-600 tabular-nums">{formatCurrency(recebido)}</p>
                        </div>
                        {pendente > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Pendente</p>
                            <p className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(pendente)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Cobranças (todas) ── */}
        <TabsContent value="cobrancas">
          <div className="space-y-4">
            <FiltersBar />
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : renderCobrancaList(cobrancasFiltradas)}
          </div>
        </TabsContent>

        {/* ── Mensalidades ── */}
        <TabsContent value="mensalidades">
          <div className="space-y-4">
            <FiltersBar />
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : renderCobrancaList(mensalidades)}
          </div>
        </TabsContent>

        {/* ── Vendas ── */}
        <TabsContent value="vendas">
          <div className="space-y-4">
            <FiltersBar />
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : renderCobrancaList(vendas)}
          </div>
        </TabsContent>

        {/* ── Comissões ── */}
        <TabsContent value="comissoes">
          <div className="space-y-4">
            {/* Month nav + member filter */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center capitalize">
                  {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Select value={filtroMembro} onValueChange={setFiltroMembro}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <Users className="h-3 w-3 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os membros</SelectItem>
                  {membrosUnicos.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Comissões stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{pendentes.length}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(totalPendente)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600">{aprovadas.length}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(totalAprovado)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold text-destructive">{rejeitadas.length}</p>
              </Card>
            </div>

            {/* Comissões list */}
            {comissoesLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : comissoesFiltradas.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhuma comissão neste período.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {comissoesFiltradas.map(c => (
                  <Card key={c.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{(c.tarefa as any)?.titulo || "Tarefa removida"}</p>
                      <p className="text-xs text-muted-foreground">{c.membro_nome} · {format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm tabular-nums">{formatCurrency(c.valor)}</span>
                      {c.status === "pendente" ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => aprovarMutation.mutate({ id: c.id, status: "aprovada" })} disabled={aprovarMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => aprovarMutation.mutate({ id: c.id, status: "rejeitada" })} disabled={aprovarMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" /> Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={c.status === "aprovada" ? "default" : "destructive"} className="text-xs">
                          {c.status === "aprovada" ? "Aprovada" : "Rejeitada"}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
