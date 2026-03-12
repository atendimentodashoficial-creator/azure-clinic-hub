import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaMembro {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  observacoes: string | null;
  senha: string | null;
  salario: number | null;
  data_contratacao: string | null;
  dia_pagamento: number | null;
  created_at: string;
}

export function useTarefasMembros() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["tarefas-membros", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tarefas_membros" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("nome");
      if (error) throw error;
      return data as unknown as TarefaMembro[];
    },
    enabled: !!user?.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefas-membros"] });

  const criarMembro = useMutation({
    mutationFn: async (membro: Omit<TarefaMembro, "id" | "user_id" | "created_at">) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("tarefas_membros" as any).insert({ ...membro, user_id: user.id } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarMembro = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaMembro> & { id: string }) => {
      const { error } = await supabase.from("tarefas_membros" as any).update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas_membros" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { membros, isLoading, criarMembro, atualizarMembro, excluirMembro };
}
