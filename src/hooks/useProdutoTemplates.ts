import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProdutoTemplateTarefa {
  id: string;
  produto_template_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  created_at: string;
}

export interface ProdutoTemplate {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  requer_reuniao: boolean;
  duracao_reuniao: number;
  tipo_reuniao_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useProdutoTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["produto-templates", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("produto_templates" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as unknown as ProdutoTemplate[];
    },
    enabled: !!user?.id,
  });
}

export function useProdutoTemplateTarefas(templateId: string | null) {
  return useQuery({
    queryKey: ["produto-template-tarefas", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from("produto_template_tarefas" as any)
        .select("*")
        .eq("produto_template_id", templateId)
        .order("ordem");
      if (error) throw error;
      return data as unknown as ProdutoTemplateTarefa[];
    },
    enabled: !!templateId,
  });
}

export function useProdutoTemplateMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["produto-templates"] });
    qc.invalidateQueries({ queryKey: ["produto-template-tarefas"] });
  };

  const criarTemplate = useMutation({
    mutationFn: async (data: { nome: string; descricao?: string; requer_reuniao?: boolean; duracao_reuniao?: number }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { data: created, error } = await supabase
        .from("produto_templates" as any)
        .insert({ ...data, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return created as unknown as ProdutoTemplate;
    },
    onSuccess: invalidate,
  });

  const atualizarTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProdutoTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("produto_templates" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reordenarTemplates = useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("produto_templates" as any)
          .update({ ordem: item.ordem } as any)
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const excluirTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const adicionarTarefa = useMutation({
    mutationFn: async (data: { produto_template_id: string; titulo: string; descricao?: string; ordem: number }) => {
      const { error } = await supabase
        .from("produto_template_tarefas" as any)
        .insert(data as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProdutoTemplateTarefa> & { id: string }) => {
      const { error } = await supabase
        .from("produto_template_tarefas" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_template_tarefas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { criarTemplate, atualizarTemplate, reordenarTemplates, excluirTemplate, adicionarTarefa, atualizarTarefa, excluirTarefa };
}
