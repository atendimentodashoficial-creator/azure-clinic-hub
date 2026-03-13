import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * For funcionarios: returns the admin's user_id (owner).
 * For admins: returns their own user_id.
 */
export function useOwnerId() {
  const { user } = useAuth();

  const { data: ownerId, isLoading } = useQuery({
    queryKey: ["owner-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Check if this user is a funcionario linked to an admin
      const { data: membro } = await supabase
        .from("tarefas_membros" as any)
        .select("user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return (membro as any)?.user_id || user.id;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // Cache for 10 min
  });

  return { ownerId: ownerId || user?.id, isLoading };
}
