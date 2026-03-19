import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ListChecks, Users, Video, MessageSquare,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, CalendarDays,
  Building2, UsersRound, Package, Send, ArrowRight, DollarSign, Wallet,
  Receipt, BarChart3, Target
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, differenceInDays, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PeriodFilter, usePeriodFilter } from "@/components/filters/PeriodFilter";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];

export default function AdminHomeDashboard() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const navigate = useNavigate();
  const effectiveUserId = ownerId || user?.id;
  const { periodFilter, setPeriodFilter, dateStart, setDateStart, dateEnd, setDateEnd } = usePeriodFilter("this_month");

  // Fetch tarefas + colunas
  const { data: tarefasData, isLoading: tarefasLoading } = useQuery({
    queryKey: ["dashboard-tarefas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return { tarefas: [], colunas: [] };
      const [{ data: tarefas }, { data: colunas }] = await Promise.all([
        supabase.from("tarefas").select("id, titulo, coluna_id, prioridade, data_limite, responsavel_nome, cliente_id, created_at, subtarefas_total, subtarefas_concluidas, timer_status").eq("user_id", effectiveUserId),
        supabase.from("tarefas_colunas").select("id, nome, cor, ordem").eq("user_id", effectiveUserId).order("ordem"),
      ]);
      return { tarefas: tarefas || [], colunas: colunas || [] };
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  // Fetch membros
  const { data: membros = [], isLoading: membrosLoading } = useQuery({
    queryKey: ["dashboard-membros", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase.from("tarefas_membros").select("id, nome, cargo, foto_url").eq("user_id", effectiveUserId);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 120_000,
  });

  // Fetch clientes
  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["dashboard-clientes", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase.from("tarefas_clientes").select("id, nome, tipo, empresa, foto_perfil_url").eq("user_id", effectiveUserId);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 120_000,
  });

  // Fetch reuniões based on period filter
  const { data: reunioes = [], isLoading: reunioesLoading } = useQuery({
    queryKey: ["dashboard-reunioes", effectiveUserId, dateStart.toISOString(), dateEnd.toISOString()],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const todayStart = startOfDay(new Date());
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      const fetchStart = dateStart < todayStart ? dateStart : todayStart;
      const fetchEnd = dateEnd > sevenDaysLater ? dateEnd : sevenDaysLater;
      const { data } = await supabase
        .from("reunioes")
        .select("id, titulo, data_reuniao, status, tipo_reuniao_id, participantes, converteu")
        .eq("user_id", effectiveUserId)
        .gte("data_reuniao", fetchStart.toISOString())
        .lte("data_reuniao", fetchEnd.toISOString())
        .order("data_reuniao");
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  // Fetch disparos campanhas (active)
  const { data: campanhas = [] } = useQuery({
    queryKey: ["dashboard-campanhas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase
        .from("disparos_campanhas")
        .select("id, nome, status, enviados, total_contatos, falhas")
        .eq("user_id", effectiveUserId)
        .in("status", ["em_andamento", "pausada"]);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  // Fetch cobrancas do período (faturamento)
  const periodoKey = `${dateStart.toISOString()}-${dateEnd.toISOString()}`;

  const { data: cobrancasPeriodo = [] } = useQuery({
    queryKey: ["dashboard-cobrancas", effectiveUserId, periodoKey],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase
        .from("cobrancas")
        .select("id, valor, status, data_vencimento")
        .eq("user_id", effectiveUserId)
        .gte("data_vencimento", dateStart.toISOString())
        .lte("data_vencimento", dateEnd.toISOString());
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  // Fetch despesas (gastos) - fetch all, filter in memo
  const { data: todasDespesas = [] } = useQuery({
    queryKey: ["dashboard-despesas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase
        .from("despesas")
        .select("id, valor, data_despesa, recorrente, data_inicio, data_fim")
        .eq("user_id", effectiveUserId);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  // Computed stats
  const stats = useMemo(() => {
    const tarefas = tarefasData?.tarefas || [];
    const colunas = tarefasData?.colunas || [];

    const concluidoCol = colunas.find(c => c.nome === "Concluído");
    const ativas = tarefas.filter(t => !concluidoCol || t.coluna_id !== concluidoCol.id);
    const concluidas = tarefas.filter(t => concluidoCol && t.coluna_id === concluidoCol.id);

    const now = startOfDay(new Date());
    const atrasadas = ativas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && differenceInDays(now, new Date(t.data_limite)) > 0);
    const urgentes = ativas.filter(t => t.prioridade === "alta" || t.prioridade === "urgente");
    const paraHoje = tarefas.filter(t => t.data_limite && isToday(new Date(t.data_limite)));

    // Tasks by column for chart
    const porColuna = colunas.map(col => ({
      nome: col.nome,
      cor: col.cor,
      quantidade: tarefas.filter(t => t.coluna_id === col.id).length,
    })).filter(c => c.quantidade > 0);

    // Tasks created last 7 days
    const last7Days: { dia: string; criadas: number; concluidas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = format(d, "dd/MM");
      const dayStart = startOfDay(d);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const criadas = tarefas.filter(t => {
        const cd = new Date(t.created_at);
        return cd >= dayStart && cd < dayEnd;
      }).length;

      last7Days.push({ dia: dayStr, criadas, concluidas: 0 });
    }

    // Próximas reuniões (futuras, ordenadas por data)
    const now2 = new Date();
    const proximasReunioes = [...reunioes]
      .filter(r => new Date(r.data_reuniao) >= now2 && r.status === "agendado")
      .sort((a, b) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime())
      .slice(0, 8);

    // Reuniões hoje
    const reunioesHoje = reunioes.filter(r => isToday(new Date(r.data_reuniao))).length;

    // Reuniões no período selecionado
    const reunioesPeriodo = reunioes.filter(r => {
      const d = new Date(r.data_reuniao);
      return d >= dateStart && d <= dateEnd;
    });
    const totalMes = reunioesPeriodo.length;

    // Comparecimento e no-show (apenas reuniões finalizadas no período)
    const realizadas = reunioesPeriodo.filter(r => r.status === "realizada" || r.status === "resumido" || r.status === "transcrito").length;
    const noShow = reunioesPeriodo.filter(r => r.status === "nao_compareceu").length;
    const finalizadas = realizadas + noShow;
    const taxaComparecimento = finalizadas > 0 ? Math.round((realizadas / finalizadas) * 100) : 0;
    const taxaNoShow = finalizadas > 0 ? Math.round((noShow / finalizadas) * 100) : 0;
    
    // Conversão = reuniões marcadas como convertidas / total do período
    const convertidas = reunioesPeriodo.filter(r => (r as any).converteu === true).length;
    const taxaConversao = totalMes > 0 ? Math.round((convertidas / totalMes) * 100) : 0;


    // Financeiro
    const receitaPrevista = cobrancasPeriodo.reduce((sum, c) => sum + (c.valor || 0), 0);
    const receitaPaga = cobrancasPeriodo.filter(c => c.status === "pago").reduce((sum, c) => sum + (c.valor || 0), 0);

    const despesasPrevistas = todasDespesas.reduce((sum, d) => {
      if (d.recorrente) {
        const inicio = d.data_inicio ? new Date(d.data_inicio) : null;
        const fim = d.data_fim ? new Date(d.data_fim) : null;
        if (inicio && inicio > dateEnd) return sum;
        if (fim && fim < dateStart) return sum;
        return sum + (d.valor || 0);
      } else {
        if (!d.data_despesa) return sum;
        const dd = new Date(d.data_despesa);
        if (dd >= dateStart && dd <= dateEnd) return sum + (d.valor || 0);
        return sum;
      }
    }, 0);

    // Despesas pagas = pontuais com data no passado + recorrentes ativas até hoje
    const hoje = new Date();
    const despesasPagas = todasDespesas.reduce((sum, d) => {
      if (d.recorrente) {
        const inicio = d.data_inicio ? new Date(d.data_inicio) : null;
        const fim = d.data_fim ? new Date(d.data_fim) : null;
        if (inicio && inicio > dateEnd) return sum;
        if (fim && fim < dateStart) return sum;
        if (inicio && inicio > hoje) return sum;
        return sum + (d.valor || 0);
      } else {
        if (!d.data_despesa) return sum;
        const dd = new Date(d.data_despesa);
        if (dd >= dateStart && dd <= dateEnd && dd <= hoje) return sum + (d.valor || 0);
        return sum;
      }
    }, 0);

    return {
      totalTarefas: tarefas.length,
      tarefasAtivas: ativas.length,
      paraHoje: paraHoje.length,
      tarefasConcluidas: concluidas.length,
      tarefasAtrasadas: atrasadas.length,
      tarefasUrgentes: urgentes.length,
      porColuna,
      last7Days,
      proximasReunioes,
      reunioesHoje,
      totalMes,
      taxaComparecimento,
      taxaNoShow,
      taxaConversao,
      reunioesRealizadas: realizadas,
      reunioesConvertidas: convertidas,
      reunioesNoShow: noShow,
      totalReunioesProximas: proximasReunioes.length,
      totalMembros: membros.length,
      totalClientes: clientes.length,
      campanhasAtivas: campanhas.filter(c => c.status === "em_andamento").length,
      campanhasPausadas: campanhas.filter(c => c.status === "pausada").length,
      receitaPrevista,
      receitaPaga,
      despesasPrevistas,
      despesasPagas,
      margemLucro: receitaPaga > 0 ? ((receitaPaga - despesasPagas) / receitaPaga) * 100 : 0,
    };
  }, [tarefasData, reunioes, membros, clientes, campanhas, cobrancasPeriodo, todasDespesas, dateStart, dateEnd]);

  const isLoading = tarefasLoading || membrosLoading || clientesLoading || reunioesLoading;

  // Tarefas próximas do prazo (próximos 3 dias)
  const tarefasProximas = useMemo(() => {
    const tarefas = tarefasData?.tarefas || [];
    const colunas = tarefasData?.colunas || [];
    const concluidoCol = colunas.find(c => c.nome === "Concluído");
    
    return tarefas
      .filter(t => {
        if (concluidoCol && t.coluna_id === concluidoCol.id) return false;
        if (!t.data_limite) return false;
        const dl = new Date(t.data_limite);
        const diff = differenceInDays(dl, new Date());
        return diff >= -3 && diff <= 3;
      })
      .sort((a, b) => new Date(a.data_limite!).getTime() - new Date(b.data_limite!).getTime())
      .slice(0, 8);
  }, [tarefasData]);

  const getColunaNome = (colunaId: string) => {
    return tarefasData?.colunas.find(c => c.id === colunaId)?.nome || "—";
  };

  const getColunaCor = (colunaId: string) => {
    return tarefasData?.colunas.find(c => c.id === colunaId)?.cor || "#888";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <PeriodFilter
          value={periodFilter}
          onChange={setPeriodFilter}
          dateStart={dateStart}
          dateEnd={dateEnd}
          onDateStartChange={setDateStart}
          onDateEndChange={setDateEnd}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Operacional */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Video className="h-4 w-4" /> Operacional
            </h2>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
               <QuickStat icon={CalendarDays} label="Reuniões no Período" value={stats.totalMes} accent="text-primary" onClick={() => navigate("/admin/reunioes")} />
               <QuickStat icon={CalendarDays} label="Reuniões Hoje" value={stats.reunioesHoje} accent="text-amber-500" onClick={() => navigate("/admin/reunioes")} />
               <QuickStat icon={CheckCircle2} label="Comparecimentos" value={`${stats.taxaComparecimento}%`} accent="text-emerald-600" subtitle={`${stats.reunioesRealizadas} reuniões`} onClick={() => navigate("/admin/reunioes")} />
               <QuickStat icon={AlertTriangle} label="No-shows" value={`${stats.taxaNoShow}%`} accent="text-destructive" subtitle={`${stats.reunioesNoShow} reuniões`} onClick={() => navigate("/admin/reunioes")} />
               <QuickStat icon={TrendingUp} label="Conversões" value={`${stats.taxaConversao}%`} accent="text-blue-600" subtitle={`${stats.reunioesConvertidas} de ${stats.totalMes}`} onClick={() => navigate("/admin/reunioes")} />
             </div>
          </div>

          {/* Tarefas */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Tarefas
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <QuickStat icon={ListChecks} label="Ativas" value={stats.tarefasAtivas} accent="text-primary" onClick={() => navigate("/admin/tarefas")} />
              <QuickStat icon={CalendarDays} label="Para Hoje" value={stats.paraHoje} accent="text-amber-500" onClick={() => navigate("/admin/tarefas")} />
              <QuickStat icon={AlertTriangle} label="Atrasadas" value={stats.tarefasAtrasadas} accent="text-destructive" onClick={() => navigate("/admin/tarefas")} />
              <QuickStat icon={CheckCircle2} label="Concluídas" value={stats.tarefasConcluidas} accent="text-emerald-600" onClick={() => navigate("/admin/tarefas")} />
              <QuickStat icon={Target} label="Total" value={stats.totalTarefas} accent="text-blue-600" onClick={() => navigate("/admin/tarefas")} />
            </div>
          </div>

          {/* Financeiro */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Resumo Financeiro
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <QuickStat icon={TrendingUp} label="Receita Prevista" value={stats.receitaPrevista.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent="text-primary" onClick={() => navigate("/admin/financeiro")} />
              <QuickStat icon={DollarSign} label="Receita Paga" value={stats.receitaPaga.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent="text-emerald-600" onClick={() => navigate("/admin/financeiro")} />
              <QuickStat icon={Receipt} label="Despesas Previstas" value={stats.despesasPrevistas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent="text-amber-600" onClick={() => navigate("/admin/despesas")} />
              <QuickStat icon={Wallet} label="Despesas Pagas" value={stats.despesasPagas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent="text-amber-600" onClick={() => navigate("/admin/despesas")} />
              <QuickStat icon={TrendingUp} label="Margem de Lucro" value={`${stats.margemLucro.toFixed(1)}%`} accent={stats.margemLucro >= 0 ? "text-emerald-600" : "text-destructive"} subtitle={(stats.receitaPaga - stats.despesasPagas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} onClick={() => navigate("/admin/financeiro")} />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tarefas por Coluna - Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Tarefas por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.porColuna.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.porColuna} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="quantidade" name="Tarefas" radius={[6, 6, 0, 0]}>
                        {stats.porColuna.map((entry, idx) => (
                          <Cell key={idx} fill={entry.cor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhuma tarefa cadastrada</p>
                )}
              </CardContent>
            </Card>

            {/* Próximas Reuniões */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Próximas Reuniões
                  {stats.proximasReunioes.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{stats.proximasReunioes.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.proximasReunioes.length > 0 ? (
                  stats.proximasReunioes.map(r => {
                    const d = new Date(r.data_reuniao);
                    const hoje = isToday(d);
                    const amanha = isTomorrow(d);
                    const dateLabel = hoje
                      ? "Hoje"
                      : amanha
                        ? "Amanhã"
                        : format(d, "dd/MM", { locale: ptBR });

                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/admin/reunioes")}>
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", hoje ? "bg-primary/10" : "bg-muted")}>
                          <Video className={cn("h-4 w-4", hoje ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateLabel} · {format(d, "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {hoje && <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">Hoje</Badge>}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhuma reunião agendada</p>
                )}
                <div className="pt-1 text-right">
                  <button className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={() => navigate("/admin/reunioes")}>
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tarefas Próximas do Prazo */}
          {tarefasProximas.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Prazos Próximos
                  <Badge variant="outline" className="ml-auto">{tarefasProximas.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tarefasProximas.map(t => {
                    const dl = new Date(t.data_limite!);
                    const diffDays = differenceInDays(dl, new Date());
                    const isOverdue = diffDays < 0;
                    const isDueToday = isToday(dl);

                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => navigate("/admin/tarefas")}
                      >
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: getColunaCor(t.coluna_id) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.titulo}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{getColunaNome(t.coluna_id)}</span>
                            {t.responsavel_nome && (
                              <>
                                <span>·</span>
                                <span className="truncate">{t.responsavel_nome}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={isOverdue ? "destructive" : isDueToday ? "default" : "secondary"}
                          className="shrink-0 text-xs"
                        >
                          {isOverdue
                            ? `${Math.abs(diffDays)}d atrasada`
                            : isDueToday
                              ? "Hoje"
                              : `${diffDays}d`
                          }
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Equipe */}
          <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    Equipe
                  </CardTitle>
                  <button
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => navigate("/admin/equipe")}
                  >
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {membros.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {membros.slice(0, 6).map(m => (
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/admin/equipe/${m.id}`)}>
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {m.nome?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.nome}</p>
                          {m.cargo && <p className="text-xs text-muted-foreground truncate">{m.cargo}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhum membro cadastrado</p>
                )}
              </CardContent>
            </Card>

          {/* Clientes Internos */}
          {(() => {
            const clientesInternos = clientes.filter(c => c.tipo === "interno");
            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Clientes
                    </CardTitle>
                    <button
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => navigate("/admin/tarefas-clientes")}
                    >
                      Ver todos <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {clientesInternos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {clientesInternos.slice(0, 6).map(c => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => navigate(`/admin/tarefas-clientes/${c.id}`)}
                        >
                          {c.foto_perfil_url ? (
                            <img src={c.foto_perfil_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {c.nome?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.nome}</p>
                            {c.empresa && <p className="text-xs text-muted-foreground truncate">{c.empresa}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-6">Nenhum cliente interno cadastrado</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        </>
      )}
    </div>
  );
}

// Quick stat card component
function QuickStat({
  icon: Icon,
  label,
  value,
  accent,
  onClick,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent: string;
  onClick?: () => void;
  subtitle?: string;
}) {
  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-elegant",
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary-foreground" />
        </div>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className={cn("text-lg font-bold tabular-nums leading-tight", accent)}>{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </Card>
  );
}
