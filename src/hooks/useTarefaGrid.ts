import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaGridPost {
  id: string;
  tarefa_id: string;
  user_id: string;
  posicao: number;
  image_url: string;
  status: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export function useTarefaGrid(tarefaId: string | null) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: gridPosts = [], isLoading } = useQuery({
    queryKey: ["tarefa-grid", tarefaId],
    queryFn: async () => {
      if (!tarefaId) return [];
      const { data, error } = await supabase
        .from("tarefa_grid_posts")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("posicao");
      if (error) throw error;
      return data as TarefaGridPost[];
    },
    enabled: !!tarefaId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefa-grid", tarefaId] });

  const uploadImage = useMutation({
    mutationFn: async ({ posicao, file }: { posicao: number; file: File }) => {
      if (!tarefaId || !effectiveUserId) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${effectiveUserId}/${tarefaId}/${posicao}.${ext}`;

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from("tarefa-grid")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("tarefa-grid")
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl + `?t=${Date.now()}`;

      // Upsert grid post
      const existing = gridPosts.find(g => g.posicao === posicao);
      if (existing) {
        const { error } = await supabase
          .from("tarefa_grid_posts")
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tarefa_grid_posts")
          .insert({
            tarefa_id: tarefaId,
            user_id: effectiveUserId,
            posicao,
            image_url: imageUrl,
          });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const removeImage = useMutation({
    mutationFn: async (posicao: number) => {
      const existing = gridPosts.find(g => g.posicao === posicao);
      if (!existing) return;
      const { error } = await supabase
        .from("tarefa_grid_posts")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const resubmitRejected = useMutation({
    mutationFn: async () => {
      if (!tarefaId) throw new Error("Sem tarefa");
      const { error } = await supabase
        .from("tarefa_grid_posts")
        .update({ status: "pendente", feedback: null, updated_at: new Date().toISOString() })
        .eq("tarefa_id", tarefaId)
        .eq("status", "reprovado");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { gridPosts, isLoading, uploadImage, removeImage, resubmitRejected };
}
