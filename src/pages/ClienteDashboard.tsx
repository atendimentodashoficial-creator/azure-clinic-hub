import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function ClienteDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bem-vindo, {user?.user_metadata?.full_name || "Cliente"}!
        </h1>
        <p className="text-muted-foreground">Área do Cliente</p>
      </div>

      <Card className="p-6">
        <p className="text-muted-foreground">
          As funcionalidades do painel do cliente serão configuradas pelo administrador.
        </p>
      </Card>
    </div>
  );
}
