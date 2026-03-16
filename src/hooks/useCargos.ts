import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerId } from "@/hooks/useOwnerId";

export interface Cargo {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export function useCargos() {
  const { ownerId } = useOwnerId();
  const qc = useQueryClient();

  const { data: cargos = [], isLoading } = useQuery({
    queryKey: ["tarefas-cargos", ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      const { data, error } = await supabase
        .from("tarefas_cargos" as any)
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as unknown as Cargo[];
    },
    enabled: !!ownerId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefas-cargos"] });

  const criarCargo = useMutation({
    mutationFn: async (cargo: { nome: string; cor?: string }) => {
      if (!ownerId) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("tarefas_cargos" as any)
        .insert({ ...cargo, user_id: ownerId } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarCargo = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cargo> & { id: string }) => {
      const { error } = await supabase
        .from("tarefas_cargos" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tarefas_cargos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { cargos, isLoading, criarCargo, atualizarCargo, excluirCargo };
}
