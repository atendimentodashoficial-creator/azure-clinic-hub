import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaGridHighlight {
  id: string;
  tarefa_id: string;
  user_id: string;
  ordem: number;
  titulo: string;
  image_url: string;
  status: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export function useTarefaGridHighlights(tarefaId: string | null) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: highlights = [], isLoading } = useQuery({
    queryKey: ["tarefa-grid-highlights", tarefaId],
    queryFn: async () => {
      if (!tarefaId) return [];
      const { data, error } = await supabase
        .from("tarefa_grid_highlights")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("ordem");
      if (error) throw error;
      return data as TarefaGridHighlight[];
    },
    enabled: !!tarefaId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefa-grid-highlights", tarefaId] });

  const addHighlight = useMutation({
    mutationFn: async ({ file, titulo }: { file: File; titulo: string }) => {
      if (!tarefaId || !effectiveUserId) throw new Error("Não autenticado");

      const ordem = highlights.length;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${effectiveUserId}/${tarefaId}/highlight_${ordem}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("tarefa-grid")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("tarefa-grid")
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl + `?t=${Date.now()}`;

      const { error } = await supabase
        .from("tarefa_grid_highlights")
        .insert({
          tarefa_id: tarefaId,
          user_id: effectiveUserId,
          ordem,
          titulo,
          image_url: imageUrl,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeHighlight = useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from("tarefa_grid_highlights")
        .delete()
        .eq("id", highlightId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateTitle = useMutation({
    mutationFn: async ({ id, titulo }: { id: string; titulo: string }) => {
      const { error } = await supabase
        .from("tarefa_grid_highlights")
        .update({ titulo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const resubmitRejected = useMutation({
    mutationFn: async () => {
      if (!tarefaId) throw new Error("Sem tarefa");
      const { error } = await supabase
        .from("tarefa_grid_highlights")
        .update({ status: "pendente", feedback: null, updated_at: new Date().toISOString() })
        .eq("tarefa_id", tarefaId)
        .eq("status", "reprovado");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { highlights, isLoading, addHighlight, removeHighlight, updateTitle, resubmitRejected };
}
