import { useMemo } from "react";
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
  Building2, UsersRound, Package, Send, ArrowRight
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];

export default function AdminHomeDashboard() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const navigate = useNavigate();
  const effectiveUserId = ownerId || user?.id;

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
      const { data } = await supabase.from("tarefas_clientes").select("id, nome").eq("user_id", effectiveUserId);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 120_000,
  });

  // Fetch reuniões
  const { data: reunioes = [], isLoading: reunioesLoading } = useQuery({
    queryKey: ["dashboard-reunioes", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const today = new Date();
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      const { data } = await supabase
        .from("reunioes")
        .select("id, titulo, data_reuniao, status, tipo_reuniao_id, participantes")
        .eq("user_id", effectiveUserId)
        .gte("data_reuniao", today.toISOString())
        .lte("data_reuniao", sevenDaysLater.toISOString())
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

    // Próximas reuniões (ordenadas por data)
    const proximasReunioes = [...reunioes]
      .sort((a, b) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime())
      .slice(0, 8);


    return {
      totalTarefas: tarefas.length,
      tarefasAtivas: ativas.length,
      tarefasConcluidas: concluidas.length,
      tarefasAtrasadas: atrasadas.length,
      tarefasUrgentes: urgentes.length,
      porColuna,
      last7Days,
      proximasReunioes,
      totalReunioesProximas: reunioes.length,
      totalMembros: membros.length,
      totalClientes: clientes.length,
      campanhasAtivas: campanhas.filter(c => c.status === "em_andamento").length,
      campanhasPausadas: campanhas.filter(c => c.status === "pausada").length,
    };
  }, [tarefasData, reunioes, membros, clientes, campanhas]);

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat
              icon={ListChecks}
              label="Tarefas Ativas"
              value={stats.tarefasAtivas}
              accent="text-primary"
              onClick={() => navigate("/admin/tarefas")}
            />
            <QuickStat
              icon={AlertTriangle}
              label="Atrasadas"
              value={stats.tarefasAtrasadas}
              accent={stats.tarefasAtrasadas > 0 ? "text-destructive" : "text-muted-foreground"}
              onClick={() => navigate("/admin/tarefas")}
            />
            <QuickStat
              icon={Video}
              label="Reuniões Hoje"
              value={stats.reunioesHoje.length}
              accent="text-primary"
              onClick={() => navigate("/admin/reunioes")}
            />
            <QuickStat
              icon={CheckCircle2}
              label="Concluídas"
              value={stats.tarefasConcluidas}
              accent="text-green-600"
            />
          </div>

          {/* Second Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat
              icon={Building2}
              label="Clientes"
              value={stats.totalClientes}
              accent="text-primary"
              onClick={() => navigate("/admin/tarefas-clientes")}
            />
            <QuickStat
              icon={UsersRound}
              label="Equipe"
              value={stats.totalMembros}
              accent="text-primary"
              onClick={() => navigate("/admin/equipe")}
            />
            <QuickStat
              icon={Send}
              label="Campanhas Ativas"
              value={stats.campanhasAtivas}
              accent={stats.campanhasAtivas > 0 ? "text-green-600" : "text-muted-foreground"}
              onClick={() => navigate("/admin/disparos")}
            />
            <QuickStat
              icon={CalendarDays}
              label="Reuniões (7 dias)"
              value={stats.totalReunioesProximas}
              accent="text-primary"
              onClick={() => navigate("/admin/reunioes")}
            />
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

            {/* Reuniões Hoje */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Reuniões Hoje
                  {stats.reunioesHoje.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{stats.reunioesHoje.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.reunioesHoje.length > 0 ? (
                  stats.reunioesHoje.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate("/admin/reunioes")}>
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.data_reuniao), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhuma reunião hoje</p>
                )}

                {stats.reunioesAmanha.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Amanhã</p>
                    {stats.reunioesAmanha.slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/reunioes")}>
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Video className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.data_reuniao), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
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

          {/* Bottom Row: Equipe + Campanhas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equipe Resumo */}
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
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
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

            {/* Campanhas Ativas */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Campanhas
                  </CardTitle>
                  <button
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => navigate("/admin/disparos")}
                  >
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {campanhas.length > 0 ? (
                  <div className="space-y-3">
                    {campanhas.slice(0, 5).map(c => {
                      const progress = c.total_contatos > 0 ? Math.round((c.enviados / c.total_contatos) * 100) : 0;
                      return (
                        <div key={c.id} className="space-y-2 p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{c.nome}</p>
                            <Badge variant={c.status === "em_andamento" ? "default" : "secondary"} className="text-xs">
                              {c.status === "em_andamento" ? "Ativa" : "Pausada"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {c.enviados}/{c.total_contatos}
                            </span>
                          </div>
                          {c.falhas > 0 && (
                            <p className="text-xs text-destructive">{c.falhas} falhas</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhuma campanha ativa</p>
                )}
              </CardContent>
            </Card>
          </div>
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
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-elegant",
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className={cn("text-2xl font-bold", accent)}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}
