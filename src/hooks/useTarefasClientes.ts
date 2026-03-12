import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TarefaCliente {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  senha_acesso: string | null;
  telefone: string | null;
  empresa: string | null;
  cnpj: string | null;
  site: string | null;
  instagram: string | null;
  linktree: string | null;
  google_meu_negocio: string | null;
  observacoes: string | null;
  grupo_whatsapp: string | null;
  tipo: string;
  created_at: string;
}

export function useTarefasClientes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["tarefas-clientes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tarefas_clientes")
        .select("*")
        .eq("user_id", user.id)
        .order("nome");
      if (error) throw error;
      return data as TarefaCliente[];
    },
    enabled: !!user?.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefas-clientes"] });

  const criarCliente = useMutation({
    mutationFn: async (cliente: Omit<TarefaCliente, "id" | "user_id" | "created_at">) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("tarefas_clientes").insert({ ...cliente, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarCliente = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaCliente> & { id: string }) => {
      const { error } = await supabase.from("tarefas_clientes").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas_clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { clientes, isLoading, criarCliente, atualizarCliente, excluirCliente };
}
