import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefasNotificacaoConfig {
  id: string;
  user_id: string;
  instancia_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useTarefasNotificacaoConfig() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["tarefas-notificacao-config", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data, error } = await supabase
        .from("tarefas_notificacao_config")
        .select("*")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      if (error) throw error;
      return data as TarefasNotificacaoConfig | null;
    },
    enabled: !!effectiveUserId,
  });

  const upsertConfig = useMutation({
    mutationFn: async (instancia_id: string | null) => {
      if (!effectiveUserId) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("tarefas_notificacao_config")
        .upsert({
          user_id: effectiveUserId,
          instancia_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas-notificacao-config"] }),
  });

  return { config, isLoading, upsertConfig };
}
