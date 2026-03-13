import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * For funcionarios: finds their tarefas_membros record by matching email.
 */
export function useMembroAtual() {
  const { user } = useAuth();

  const { data: membro, isLoading } = useQuery({
    queryKey: ["membro-atual", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Try by auth_user_id first, fallback to email
      const { data, error } = await supabase
        .from("tarefas_membros" as any)
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as any;
      // Fallback: match by email
      if (user.email) {
        const { data: dataByEmail, error: errEmail } = await supabase
          .from("tarefas_membros" as any)
          .select("*")
          .eq("email", user.email)
          .maybeSingle();
        if (errEmail) throw errEmail;
        return dataByEmail as any;
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { membro, isLoading };
}
