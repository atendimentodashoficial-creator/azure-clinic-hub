import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";

export interface TipoReuniao {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoReuniaoMembro {
  id: string;
  tipo_reuniao_id: string;
  membro_id: string;
  created_at: string;
}

export function useTiposReuniao() {
  const ownerId = useOwnerId();

  const query = useQuery({
    queryKey: ["tipos-reuniao", ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      const { data, error } = await supabase
        .from("tipos_reuniao" as any)
        .select("*")
        .eq("user_id", ownerId)
        .order("nome");
      if (error) throw error;
      return data as unknown as TipoReuniao[];
    },
    enabled: !!ownerId,
  });

  return query;
}

export function useTipoReuniaoMembros(tipoId: string | null) {
  return useQuery({
    queryKey: ["tipos-reuniao-membros", tipoId],
    queryFn: async () => {
      if (!tipoId) return [];
      const { data, error } = await supabase
        .from("tipos_reuniao_membros" as any)
        .select("*")
        .eq("tipo_reuniao_id", tipoId);
      if (error) throw error;
      return data as unknown as TipoReuniaoMembro[];
    },
    enabled: !!tipoId,
  });
}

export function useTiposReuniaoMutations() {
  const queryClient = useQueryClient();
  const ownerId = useOwnerId();

  const criarTipo = useMutation({
    mutationFn: async (data: { nome: string; descricao?: string }) => {
      if (!ownerId) throw new Error("Usuário não identificado");
      const { data: created, error } = await supabase
        .from("tipos_reuniao" as any)
        .insert({ user_id: ownerId, nome: data.nome, descricao: data.descricao || null })
        .select()
        .single();
      if (error) throw error;
      return created as unknown as TipoReuniao;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-reuniao"] }),
  });

  const atualizarTipo = useMutation({
    mutationFn: async (data: { id: string; nome: string; descricao?: string | null; ativo?: boolean }) => {
      const { error } = await supabase
        .from("tipos_reuniao" as any)
        .update({ nome: data.nome, descricao: data.descricao, ativo: data.ativo, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-reuniao"] }),
  });

  const excluirTipo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tipos_reuniao" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-reuniao"] }),
  });

  const setMembros = useMutation({
    mutationFn: async ({ tipoId, membroIds }: { tipoId: string; membroIds: string[] }) => {
      // Delete all existing
      await supabase
        .from("tipos_reuniao_membros" as any)
        .delete()
        .eq("tipo_reuniao_id", tipoId);

      // Insert new
      if (membroIds.length > 0) {
        const rows = membroIds.map(membro_id => ({ tipo_reuniao_id: tipoId, membro_id }));
        const { error } = await supabase
          .from("tipos_reuniao_membros" as any)
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-reuniao-membros"] }),
  });

  return { criarTipo, atualizarTipo, excluirTipo, setMembros };
}
