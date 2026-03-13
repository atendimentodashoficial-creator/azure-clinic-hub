import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * For funcionarios: finds their tarefas_membros record by matching email.
 */
export function useMembroAtual() {
  const { user } = useAuth();

  const { data: membro, isLoading } = useQuery({
    queryKey: ["membro-atual", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("tarefas_membros" as any)
        .select("*")
        .eq("email", user.email)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  return { membro, isLoading };
}
