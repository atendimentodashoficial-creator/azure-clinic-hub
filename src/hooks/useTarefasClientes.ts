import { useEffect, useRef } from "react";
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
  foto_perfil_url: string | null;
  tipo: string;
  created_at: string;
}

export function useTarefasClientes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncedClienteIds = useRef<Set<string>>(new Set());

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
      return data as unknown as TarefaCliente[];
    },
    enabled: !!user?.id,
  });

  const ensureClienteInternoAuth = async (cliente: Partial<TarefaCliente>) => {
    if (cliente.tipo !== "interno") return;

    const email = cliente.email?.trim().toLowerCase();
    const senha = cliente.senha_acesso?.trim();

    if (!email || !senha) {
      throw new Error("Cliente interno precisa de email e senha de acesso para gerar login.");
    }

    const { data, error } = await supabase.functions.invoke("create-team-member-auth", {
      body: {
        action: "ensure_cliente_auth",
        email,
        password: senha,
        fullName: cliente.nome || email,
        role: "cliente",
      },
    });

    if (error) throw error;
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }
  };

  useEffect(() => {
    syncedClienteIds.current.clear();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !clientes.length) return;

    const pendentes = clientes.filter(
      (c) =>
        c.tipo === "interno" &&
        !!c.email &&
        !!c.senha_acesso &&
        !syncedClienteIds.current.has(c.id)
    );

    if (!pendentes.length) return;

    void (async () => {
      for (const cliente of pendentes) {
        try {
          await ensureClienteInternoAuth(cliente);
          syncedClienteIds.current.add(cliente.id);
        } catch (error) {
          console.error(`[Clientes] Falha ao sincronizar login do cliente ${cliente.nome}:`, error);
        }
      }
    })();
  }, [clientes, user?.id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefas-clientes"] });

  const criarCliente = useMutation({
    mutationFn: async (cliente: Omit<TarefaCliente, "id" | "user_id" | "created_at">) => {
      if (!user?.id) throw new Error("Não autenticado");

      await ensureClienteInternoAuth(cliente);

      const { error } = await supabase
        .from("tarefas_clientes")
        .insert({ ...cliente, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarCliente = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaCliente> & { id: string }) => {
      const sanitizedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      ) as Partial<TarefaCliente>;

      const clienteAtual = clientes.find((c) => c.id === id);
      const clienteComposto: Partial<TarefaCliente> = {
        ...clienteAtual,
        ...sanitizedUpdates,
      };

      await ensureClienteInternoAuth(clienteComposto);

      const { error } = await supabase
        .from("tarefas_clientes")
        .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
        .eq("id", id);

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
