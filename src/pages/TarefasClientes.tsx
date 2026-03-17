import { Building2 } from "lucide-react";
import TarefasClientesTab from "@/components/tarefas/TarefasClientesTab";

export default function TarefasClientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Clientes
        </h1>
        <p className="text-muted-foreground">Gerencie os clientes vinculados às tarefas</p>
      </div>
      <TarefasClientesTab />
    </div>
  );
}
