import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EscalaMembro {
  id: string;
  user_id: string;
  membro_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AusenciaMembro {
  id: string;
  user_id: string;
  membro_id: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
  created_at: string;
  updated_at: string;
}

export const useEscalasMembros = (membroId?: string) => {
  return useQuery({
    queryKey: ["escalas-membros", membroId],
    queryFn: async () => {
      let query = supabase
        .from("escalas_membros" as any)
        .select("*")
        .eq("ativo", true)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (membroId) {
        query = query.eq("membro_id", membroId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as EscalaMembro[];
    },
  });
};

export const useCreateEscalaMembro = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (escala: Omit<EscalaMembro, "id" | "created_at" | "updated_at" | "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("escalas_membros" as any)
        .insert({ ...escala, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escalas-membros"] }),
  });
};

export const useDeleteEscalaMembro = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escalas_membros" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["escalas-membros"] }),
  });
};

export const useAusenciasMembros = (membroId?: string) => {
  return useQuery({
    queryKey: ["ausencias-membros", membroId],
    queryFn: async () => {
      let query = supabase
        .from("ausencias_membros" as any)
        .select("*")
        .order("data_inicio", { ascending: true });

      if (membroId) {
        query = query.eq("membro_id", membroId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AusenciaMembro[];
    },
  });
};

export const useCreateAusenciaMembro = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ausencia: Omit<AusenciaMembro, "id" | "created_at" | "updated_at" | "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("ausencias_membros" as any)
        .insert({ ...ausencia, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias-membros"] }),
  });
};

export const useDeleteAusenciaMembro = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ausencias_membros" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias-membros"] }),
  });
};
