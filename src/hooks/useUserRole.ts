import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "cliente" | "funcionario";

export function useUserRole() {
  const { user, session, loading } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const result = await Promise.race([
        supabase.rpc("get_user_role", { _user_id: user.id }),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error("ROLE_QUERY_TIMEOUT") }), 6000)
        ),
      ]);

      const { data, error } = result as { data: AppRole | null; error: Error | null };

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data as AppRole | null;
    },
    enabled: !loading && !!user?.id && !!session?.access_token,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: role ?? null,
    isLoading,
    isAdmin: role === "admin",
    isCliente: role === "cliente",
    isFuncionario: role === "funcionario",
  };
}
