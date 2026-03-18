import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CobrancaPagamento {
  id: string;
  cobranca_id: string;
  user_id: string;
  valor: number;
  data_pagamento: string;
  data_proximo_pagamento: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  created_at: string;
}

export const useCobrancaPagamentos = (cobrancaId: string | null) => {
  return useQuery({
    queryKey: ["cobranca-pagamentos", cobrancaId],
    queryFn: async () => {
      if (!cobrancaId) return [];
      const { data, error } = await supabase
        .from("cobranca_pagamentos" as any)
        .select("*")
        .eq("cobranca_id", cobrancaId)
        .order("data_pagamento", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CobrancaPagamento[];
    },
    enabled: !!cobrancaId,
  });
};

export const useCreateCobrancaPagamento = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pagamento: {
      cobranca_id: string;
      valor: number;
      data_pagamento: string;
      data_proximo_pagamento?: string | null;
      comprovante_url?: string | null;
      observacoes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("cobranca_pagamentos" as any)
        .insert({ ...pagamento, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cobranca-pagamentos", variables.cobranca_id] });
    },
  });
};

export const useDeleteCobrancaPagamento = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cobrancaId }: { id: string; cobrancaId: string }) => {
      const { error } = await supabase
        .from("cobranca_pagamentos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return cobrancaId;
    },
    onSuccess: (cobrancaId) => {
      queryClient.invalidateQueries({ queryKey: ["cobranca-pagamentos", cobrancaId] });
    },
  });
};

export const uploadCobrancaComprovante = async (file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const ext = file.name.split(".").pop();
  const path = `cobrancas/${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("comprovantes")
    .upload(path, file);
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("comprovantes")
    .getPublicUrl(path);

  return urlData.publicUrl;
};
