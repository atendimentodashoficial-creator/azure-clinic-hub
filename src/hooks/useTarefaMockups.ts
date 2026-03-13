import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaMockup {
  id: string;
  tarefa_id: string;
  user_id: string;
  ordem: number;
  subtitulo: string | null;
  titulo: string | null;
  legenda: string | null;
  cta: string | null;
  status: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export function useTarefaMockups(tarefaId: string | null) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: mockups = [], isLoading } = useQuery({
    queryKey: ["tarefa-mockups", tarefaId],
    queryFn: async () => {
      if (!tarefaId) return [];
      const { data, error } = await supabase
        .from("tarefa_mockups")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("ordem");
      if (error) throw error;
      return data as TarefaMockup[];
    },
    enabled: !!tarefaId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefa-mockups", tarefaId] });

  const saveMockups = useMutation({
    mutationFn: async (slides: { id?: string; subtitulo: string; titulo: string; legenda: string; cta: string; ordem: number }[]) => {
      if (!tarefaId || !effectiveUserId) throw new Error("Não autenticado");
      
      // Delete existing - check for errors
      const { error: deleteError } = await supabase
        .from("tarefa_mockups")
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", effectiveUserId);
      
      if (deleteError) {
        console.error("Erro ao deletar mockups existentes:", deleteError);
        throw deleteError;
      }
      
      // Insert new
      if (slides.length > 0) {
        const { error } = await supabase.from("tarefa_mockups").insert(
          slides.map(({ id: _id, ...s }) => ({
            tarefa_id: tarefaId,
            user_id: effectiveUserId,
            subtitulo: s.subtitulo,
            titulo: s.titulo,
            legenda: s.legenda,
            cta: s.cta,
            ordem: s.ordem,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ mockupId, status, feedback }: { mockupId: string; status: string; feedback?: string }) => {
      const { error } = await supabase.from("tarefa_mockups").update({ status, feedback, updated_at: new Date().toISOString() }).eq("id", mockupId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { mockups, isLoading, saveMockups, updateStatus };
}
