import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export const RoleRedirector = () => {
  const { user, loading } = useAuth();
  const { role, isLoading } = useUserRole();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  switch (role) {
    case "admin":
      return <Navigate to="/admin" replace />;
    case "cliente":
      return <Navigate to="/cliente" replace />;
    case "funcionario":
      return <Navigate to="/funcionario" replace />;
    default:
      // No role assigned - show a message or redirect to auth
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Nenhum perfil de acesso atribuído.</p>
            <p className="text-sm text-muted-foreground">Entre em contato com o administrador.</p>
          </div>
        </div>
      );
  }
};
