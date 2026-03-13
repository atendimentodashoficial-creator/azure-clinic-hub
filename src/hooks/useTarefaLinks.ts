import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaLink {
  id: string;
  tarefa_id: string;
  user_id: string;
  url: string;
  titulo: string | null;
  ordem: number;
}

export function useTarefaLinks(tarefaId: string | null) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();
  const effectiveUserId = ownerId || user?.id;

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["tarefa-links", tarefaId],
    queryFn: async () => {
      if (!tarefaId) return [];
      const { data, error } = await supabase
        .from("tarefa_links")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("ordem");
      if (error) throw error;
      return data as TarefaLink[];
    },
    enabled: !!tarefaId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefa-links", tarefaId] });

  const saveLinks = useMutation({
    mutationFn: async (newLinks: { url: string; titulo: string | null }[]) => {
      if (!tarefaId || !effectiveUserId) throw new Error("Não autenticado");

      // Delete existing links
      await supabase.from("tarefa_links").delete().eq("tarefa_id", tarefaId);

      if (newLinks.length === 0) return;

      const rows = newLinks.map((l, i) => ({
        tarefa_id: tarefaId,
        user_id: effectiveUserId,
        url: l.url,
        titulo: l.titulo,
        ordem: i,
      }));

      const { error } = await supabase.from("tarefa_links").insert(rows);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { links, isLoading, saveLinks };
}
