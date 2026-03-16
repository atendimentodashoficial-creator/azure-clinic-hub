import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, ListTodo, AlertTriangle, Video, Calendar, TrendingUp, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FuncionarioDashboard() {
  const { user } = useAuth();
  const { membro, isLoading: membroLoading } = useMembroAtual();
  const { ownerId } = useOwnerId();

  // Fetch tarefas assigned to this member
  const { data: tarefas = [], isLoading: tarefasLoading, fetchStatus: tarefasFetchStatus } = useQuery({
    queryKey: ["func-dashboard-tarefas", ownerId, membro?.nome],
    queryFn: async () => {
      if (!ownerId || !membro?.nome) return [];
      const { data, error } = await supabase
        .from("tarefas")
        .select("id, titulo, prioridade, data_entrega, coluna_id, responsavel_nome, created_at, updated_at, cliente_id, tarefas_colunas!inner(nome)")
        .eq("user_id", ownerId)
        .ilike("responsavel_nome", `%${(membro as any).nome}%`);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ownerId && !!(membro as any)?.nome,
  });

  // Fetch reunioes for this member
  const { data: reunioes = [], isLoading: reunioesLoading, fetchStatus: reunioesFetchStatus } = useQuery({
    queryKey: ["func-dashboard-reunioes", ownerId, membro?.id],
    queryFn: async () => {
      if (!ownerId || !membro?.id) return [];
      const { data, error } = await supabase
        .from("reunioes")
        .select("id, titulo, data_reuniao, status, duracao_minutos")
        .eq("user_id", ownerId)
        .gte("data_reuniao", new Date().toISOString().split("T")[0])
        .order("data_reuniao", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ownerId && !!(membro as any)?.id,
  });

  const stats = useMemo(() => {
    const aFazer = tarefas.filter((t: any) => {
      const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return col === "a fazer";
    });
    const emProgresso = tarefas.filter((t: any) => {
      const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return col === "em progresso";
    });
    const concluidas = tarefas.filter((t: any) => {
      const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return col === "concluido";
    });
    const atrasadas = tarefas.filter((t: any) => {
      if (!t.data_entrega) return false;
      const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return col !== "concluido" && isPast(parseISO(t.data_entrega));
    });
    const urgentes = tarefas.filter((t: any) => {
      const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return col !== "concluido" && (t.prioridade === "urgente" || t.prioridade === "alta");
    });

    return { aFazer, emProgresso, concluidas, atrasadas, urgentes, total: tarefas.length };
  }, [tarefas]);

  const proximasReunioes = useMemo(() => {
    return reunioes.filter((r: any) => r.status !== "cancelada").slice(0, 5);
  }, [reunioes]);

  const proximasTarefas = useMemo(() => {
    return tarefas
      .filter((t: any) => {
        const col = t.tarefas_colunas?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        return col !== "concluido" && t.data_entrega;
      })
      .sort((a: any, b: any) => new Date(a.data_entrega).getTime() - new Date(b.data_entrega).getTime())
      .slice(0, 5);
  }, [tarefas]);

  const isLoading = membroLoading || tarefasLoading || reunioesLoading;

  const firstName = (membro as any)?.nome?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Funcionário";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground text-sm">
          Aqui está o resumo das suas atividades
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={ListTodo}
          label="A Fazer"
          value={isLoading ? "-" : stats.aFazer.length}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatsCard
          icon={Clock}
          label="Em Progresso"
          value={isLoading ? "-" : stats.emProgresso.length}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatsCard
          icon={CheckCircle2}
          label="Concluídas"
          value={isLoading ? "-" : stats.concluidas.length}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
        <StatsCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={isLoading ? "-" : stats.atrasadas.length}
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas Entregas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Próximas Entregas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : proximasTarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega pendente</p>
            ) : (
              proximasTarefas.map((t: any) => {
                const date = parseISO(t.data_entrega);
                const overdue = isPast(date);
                const today = isToday(date);
                const tomorrow = isTomorrow(date);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      overdue ? "bg-destructive" : today ? "bg-amber-500" : tomorrow ? "bg-blue-500" : "bg-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.titulo}</p>
                      <p className={cn(
                        "text-xs",
                        overdue ? "text-destructive font-medium" : "text-muted-foreground"
                      )}>
                        {overdue ? "Atrasada · " : ""}
                        {today ? "Hoje" : tomorrow ? "Amanhã" : format(date, "dd/MM/yyyy")}
                      </p>
                    </div>
                    {t.prioridade && (
                      <Badge variant="outline" className={cn(
                        "text-[10px] shrink-0",
                        t.prioridade === "urgente" && "border-red-500/50 text-red-500",
                        t.prioridade === "alta" && "border-orange-500/50 text-orange-500",
                        t.prioridade === "media" && "border-amber-500/50 text-amber-500",
                        t.prioridade === "baixa" && "border-emerald-500/50 text-emerald-500",
                      )}>
                        {t.prioridade}
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Próximas Reuniões */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Próximas Reuniões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : proximasReunioes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma reunião agendada</p>
            ) : (
              proximasReunioes.map((r: any) => {
                const date = parseISO(r.data_reuniao);
                const today = isToday(date);
                const tomorrow = isTomorrow(date);
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      today ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Video className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {today ? "Hoje" : tomorrow ? "Amanhã" : format(date, "EEEE, dd/MM", { locale: ptBR })}
                        {" às "}
                        {format(date, "HH:mm")}
                        {r.duracao_minutos && ` · ${r.duracao_minutos}min`}
                      </p>
                    </div>
                    {today && (
                      <Badge className="bg-primary/20 text-primary border-0 text-[10px] shrink-0">Hoje</Badge>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tarefas Urgentes/Alta Prioridade */}
      {stats.urgentes.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Tarefas Urgentes ({stats.urgentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.urgentes.slice(0, 6).map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    t.prioridade === "urgente" ? "bg-red-600" : "bg-orange-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.data_entrega ? format(parseISO(t.data_entrega), "dd/MM/yyyy") : "Sem prazo"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] shrink-0",
                    t.prioridade === "urgente" ? "border-red-500/50 text-red-500" : "border-orange-500/50 text-orange-500",
                  )}>
                    {t.prioridade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, color, bgColor }: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", bgColor)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}
