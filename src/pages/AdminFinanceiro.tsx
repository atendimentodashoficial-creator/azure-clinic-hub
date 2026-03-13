import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
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

export default function AdminFinanceiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroMembro, setFiltroMembro] = useState<string>("todos");

  const inicio = format(startOfMonth(mesAtual), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesAtual), "yyyy-MM-dd");

  const { data: comissoes = [], isLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Financeiro da Equipe
        </h1>
        <p className="text-muted-foreground">Gerencie comissões e acompanhe os ganhos da equipe</p>
      </div>

      {/* Month navigation + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center capitalize">
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filtroMembro} onValueChange={setFiltroMembro}>
          <SelectTrigger className="w-[200px]">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os membros</SelectItem>
            {membrosUnicos.map(n => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-amber-500">{pendentes.length}</p>
          <p className="text-sm text-muted-foreground">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Aprovadas</p>
          <p className="text-2xl font-bold text-green-500">{aprovadas.length}</p>
          <p className="text-sm text-muted-foreground">R$ {totalAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Rejeitadas</p>
          <p className="text-2xl font-bold text-destructive">{rejeitadas.length}</p>
        </Card>
      </div>

      {/* Commissions list */}
      {isLoading ? (
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
                <p className="text-xs text-muted-foreground">{c.membro_nome} • {format(new Date(c.created_at), "dd/MM/yyyy")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">
                  R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                {c.status === "pendente" ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => aprovarMutation.mutate({ id: c.id, status: "aprovada" })}
                      disabled={aprovarMutation.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:bg-destructive/10"
                      onClick={() => aprovarMutation.mutate({ id: c.id, status: "rejeitada" })}
                      disabled={aprovarMutation.isPending}
                    >
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
  );
}
