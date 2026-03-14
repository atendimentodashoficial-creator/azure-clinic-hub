import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ClienteProduto {
  id: string;
  nome: string;
  descricao: string | null;
  total_tarefas: number;
  tarefas_concluidas: number;
}

export function useClienteProdutos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cliente-produtos", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];

      // Get the client record for this user
      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("id")
        .eq("email", user.email)
        .limit(1)
        .single();

      if (!clienteData) return [];

      // Get tasks that have a produto_template_id
      const { data: tarefas, error } = await supabase
        .from("tarefas")
        .select(`
          id, produto_template_id, coluna_id,
          tarefas_colunas!inner(nome)
        `)
        .eq("cliente_id", clienteData.id)
        .not("produto_template_id", "is", null);

      if (error) throw error;
      if (!tarefas || tarefas.length === 0) return [];

      // Get unique produto_template_ids
      const templateIds = [...new Set(tarefas.map((t: any) => t.produto_template_id))];

      // Fetch product names
      const { data: templates, error: tErr } = await supabase
        .from("produto_templates" as any)
        .select("id, nome, descricao")
        .in("id", templateIds);

      if (tErr) throw tErr;

      const templateMap = new Map((templates as any[]).map(t => [t.id, t]));

      // Group and count
      const grouped: Record<string, ClienteProduto> = {};
      for (const t of tarefas as any[]) {
        const tid = t.produto_template_id;
        const tmpl = templateMap.get(tid);
        if (!tmpl) continue;
        if (!grouped[tid]) {
          grouped[tid] = {
            id: tid,
            nome: tmpl.nome,
            descricao: tmpl.descricao,
            total_tarefas: 0,
            tarefas_concluidas: 0,
          };
        }
        grouped[tid].total_tarefas++;
        if (t.tarefas_colunas?.nome === "Concluído") {
          grouped[tid].tarefas_concluidas++;
        }
      }

      return Object.values(grouped);
    },
    enabled: !!user?.email,
  });
}
