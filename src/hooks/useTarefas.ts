import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerId } from "@/hooks/useOwnerId";
import { sendTaskNotification } from "@/utils/taskNotifications";

export interface TarefaColuna {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export interface Tarefa {
  id: string;
  user_id: string;
  coluna_id: string;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_nome: string | null;
  prioridade: string;
  data_limite: string | null;
  subtarefas_total: number;
  subtarefas_concluidas: number;
  ordem: number;
  comissao: number | null;
  reuniao_id: string | null;
  tipo_tarefa_id: string | null;
  produto_template_id: string | null;
  timer_inicio: string | null;
  tempo_acumulado_segundos: number;
  timer_status: string;
  approval_token: string | null;
  approval_status: string | null;
  aprovacao_interna_status: string | null;
  aprovacao_interna_por: string | null;
  aprovacao_interna_feedback: string | null;
  created_at: string;
}

const DEFAULT_COLUMNS = [
  { nome: "A Fazer", cor: "#f59e0b", ordem: 0 },
  { nome: "Em Progresso", cor: "#3b82f6", ordem: 1 },
  { nome: "Aprovação Interna", cor: "#f97316", ordem: 2 },
  { nome: "Aprovação Cliente", cor: "#8b5cf6", ordem: 3 },
  { nome: "Em Revisão", cor: "#ef4444", ordem: 4 },
  { nome: "Concluído", cor: "#22c55e", ordem: 5 },
];

export function useTarefas() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();

  const effectiveUserId = ownerId || user?.id;

  // Fetch columns
  const { data: colunas = [], isLoading: loadingColunas } = useQuery({
    queryKey: ["tarefas-colunas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("tarefas_colunas")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("ordem");
      if (error) throw error;

      // Auto-create default columns if none exist
      if (!data || data.length === 0) {
        const inserts = DEFAULT_COLUMNS.map((c) => ({ ...c, user_id: effectiveUserId }));
        const { data: created, error: err2 } = await supabase
          .from("tarefas_colunas")
          .insert(inserts)
          .select();
        if (err2) throw err2;
        return (created as TarefaColuna[]) || [];
      }
      return data as TarefaColuna[];
    },
    enabled: !!effectiveUserId,
  });

  // Fetch tasks
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("ordem");
      if (error) throw error;
      return ((data as any[]) || []).map((d) => ({
        ...d,
        tempo_acumulado_segundos: Number(d.tempo_acumulado_segundos ?? 0),
        timer_status: d.timer_status || "parado",
      })) as Tarefa[];
    },
    enabled: !!effectiveUserId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["tarefas-colunas"] });
  };

  // Create task
  const criarTarefa = useMutation({
    mutationFn: async (tarefa: { titulo: string; descricao?: string; responsavel_nome?: string; prioridade?: string; data_limite?: string; coluna_id: string; cliente_id?: string; subtarefas_total?: number; comissao?: number; reuniao_id?: string; tipo_tarefa_id?: string; produto_template_id?: string }) => {
      if (!effectiveUserId) throw new Error("Não autenticado");
      const maxOrdem = tarefas.filter((t) => t.coluna_id === tarefa.coluna_id).length;
      const { data, error } = await supabase.from("tarefas").insert({
        ...tarefa,
        user_id: effectiveUserId,
        ordem: maxOrdem,
      }).select("id").single();
      if (error) throw error;
      return { id: data.id, user_id: effectiveUserId, responsavel_nome: tarefa.responsavel_nome };
    },
    onSuccess: invalidate,
  });

  // Update task
  const atualizarTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tarefa> & { id: string }) => {
      const { error } = await supabase.from("tarefas").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Delete task
  const excluirTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Move task to column
  const moverTarefa = useMutation({
    mutationFn: async ({ id, coluna_id, ordem }: { id: string; coluna_id: string; ordem: number }) => {
      const { error } = await supabase.from("tarefas").update({ coluna_id, ordem, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Add column
  const criarColuna = useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string }) => {
      if (!effectiveUserId) throw new Error("Não autenticado");
      const maxOrdem = colunas.length;
      const { error } = await supabase.from("tarefas_colunas").insert({ nome, cor, user_id: effectiveUserId, ordem: maxOrdem });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Delete column
  const excluirColuna = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().match({ coluna_id: id });
      if (error) throw error;
      const { error: err2 } = await supabase.from("tarefas_colunas").delete().eq("id", id);
      if (err2) throw err2;
    },
    onSuccess: invalidate,
  });

  return {
    colunas,
    tarefas,
    isLoading: loadingColunas || loadingTarefas,
    criarTarefa,
    atualizarTarefa,
    excluirTarefa,
    moverTarefa,
    criarColuna,
    excluirColuna,
  };
}
