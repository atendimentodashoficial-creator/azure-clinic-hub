import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";

export interface Cobranca {
  id: string;
  user_id: string;
  cliente_id: string;
  descricao: string;
  valor: number;
  tipo: "mrr" | "unico";
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  data_vencimento: string;
  data_pagamento: string | null;
  metodo_pagamento: string | null;
  observacoes: string | null;
  recorrencia_ativa: boolean;
  recorrencia_origem_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCobrancas(clienteId?: string) {
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();
  const queryKey = ["cobrancas", clienteId];

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("cobrancas")
        .select("*")
        .order("data_vencimento", { ascending: false });

      if (clienteId) {
        query = query.eq("cliente_id", clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Cobranca[];
    },
    enabled: !!ownerId,
  });

  const criarCobranca = useMutation({
    mutationFn: async (dados: Omit<Cobranca, "id" | "created_at" | "updated_at" | "user_id">) => {
      const { data, error } = await supabase
        .from("cobrancas")
        .insert({ ...dados, user_id: ownerId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const atualizarCobranca = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<Cobranca> & { id: string }) => {
      const { data, error } = await supabase
        .from("cobrancas")
        .update(dados as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const excluirCobranca = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cobrancas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { cobrancas, isLoading, criarCobranca, atualizarCobranca, excluirCobranca };
}
