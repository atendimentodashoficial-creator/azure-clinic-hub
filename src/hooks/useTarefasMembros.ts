import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  foto_url: string | null;
  auth_user_id: string | null;
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
    mutationFn: async (membro: Omit<TarefaMembro, "id" | "user_id" | "created_at" | "auth_user_id">) => {
      if (!user?.id) throw new Error("Não autenticado");

      let authUserId: string | null = null;

      // If email and senha are provided, create auth user
      if (membro.email && membro.senha) {
        const { data, error } = await supabase.functions.invoke('create-team-member-auth', {
          body: {
            action: 'create',
            email: membro.email,
            password: membro.senha,
            fullName: membro.nome,
          }
        });

        if (error) throw new Error(error.message || 'Erro ao criar login do membro');
        if (data?.error) throw new Error(data.error);
        authUserId = data?.authUserId || null;
      }

      const { error: insertError } = await supabase
        .from("tarefas_membros" as any)
        .insert({ ...membro, user_id: user.id, auth_user_id: authUserId } as any);
      if (insertError) throw insertError;
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
      // Find the member to get auth_user_id
      const member = membros.find(m => m.id === id);
      
      // Delete auth user if exists
      if (member?.auth_user_id) {
        try {
          await supabase.functions.invoke('create-team-member-auth', {
            body: { action: 'delete', userId: member.auth_user_id }
          });
        } catch (err) {
          console.error('Erro ao excluir login do membro:', err);
        }
      }

      const { error } = await supabase.from("tarefas_membros" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { membros, isLoading, criarMembro, atualizarMembro, excluirMembro };
}
