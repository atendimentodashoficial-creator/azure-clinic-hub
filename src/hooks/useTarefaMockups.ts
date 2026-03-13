import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaMockup {
  id: string;
  tarefa_id: string;
  user_id: string;
  ordem: number;
  post_index: number;
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
        .order("post_index")
        .order("ordem");
      if (error) throw error;
      return data as TarefaMockup[];
    },
    enabled: !!tarefaId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefa-mockups", tarefaId] });

  const saveMockups = useMutation({
    mutationFn: async (slides: { id?: string; subtitulo: string; titulo: string; legenda: string; cta: string; ordem: number; post_index: number }[]) => {
      if (!tarefaId || !effectiveUserId) throw new Error("Não autenticado");
      
      // Separate slides that have existing IDs (update) vs new ones (insert)
      const existingIds = mockups.map(m => m.id);
      const toUpdate = slides.filter(s => s.id && existingIds.includes(s.id));
      const toInsert = slides.filter(s => !s.id || !existingIds.includes(s.id));
      
      // Delete mockups that are no longer in the slides list
      const keepIds = toUpdate.map(s => s.id!);
      const toDeleteIds = existingIds.filter(id => !keepIds.includes(id));
      
      if (toDeleteIds.length > 0) {
        const { error } = await supabase
          .from("tarefa_mockups")
          .delete()
          .in("id", toDeleteIds);
        if (error) throw error;
      }
      
      // Update existing mockups (preserve status for approved ones)
      for (const slide of toUpdate) {
        const existing = mockups.find(m => m.id === slide.id);
        const updateData: Record<string, any> = {
          subtitulo: slide.subtitulo,
          titulo: slide.titulo,
          legenda: slide.legenda,
          cta: slide.cta,
          ordem: slide.ordem,
          updated_at: new Date().toISOString(),
        };
        // If content changed on an approved mockup, keep approved status
        // If content changed on a rejected mockup, it stays rejected until resubmit
        const { error } = await supabase
          .from("tarefa_mockups")
          .update(updateData)
          .eq("id", slide.id!);
        if (error) throw error;
      }
      
      // Insert new mockups
      if (toInsert.length > 0) {
        const { error } = await supabase.from("tarefa_mockups").insert(
          toInsert.map(({ id: _id, ...s }) => ({
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

  const resubmitRejected = useMutation({
    mutationFn: async () => {
      if (!tarefaId) throw new Error("Sem tarefa");
      // Reset only rejected mockups to pendente
      const { error } = await supabase
        .from("tarefa_mockups")
        .update({ status: "pendente", feedback: null, updated_at: new Date().toISOString() })
        .eq("tarefa_id", tarefaId)
        .eq("status", "reprovado");
      if (error) throw error;
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

  return { mockups, isLoading, saveMockups, updateStatus, resubmitRejected };
}
