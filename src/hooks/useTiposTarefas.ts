import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TipoTarefa {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  tipos_arquivo_permitidos: string[];
  limite_arquivos: Record<string, number>;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export function useTiposTarefas() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["tipos-tarefas", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("tipos_tarefas")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("ordem");
      if (error) throw error;
      return (data as any[]).map(d => ({
        ...d,
        tipos_arquivo_permitidos: d.tipos_arquivo_permitidos || [],
        limite_arquivos: d.limite_arquivos || {},
      })) as TipoTarefa[];
    },
    enabled: !!effectiveUserId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tipos-tarefas"] });

  const createTipo = useMutation({
    mutationFn: async (data: { nome: string; descricao?: string; tipos_arquivo_permitidos?: string[]; limite_arquivos?: Record<string, number> }) => {
      if (!effectiveUserId) throw new Error("Não autenticado");
      const maxOrdem = tipos.length;
      const { error } = await supabase.from("tipos_tarefas").insert({
        ...data,
        user_id: effectiveUserId,
        ordem: maxOrdem,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateTipo = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TipoTarefa> & { id: string }) => {
      const { error } = await supabase.from("tipos_tarefas").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteTipo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tipos_tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { tipos, isLoading, createTipo, updateTipo, deleteTipo };
}
