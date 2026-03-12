import { UsersRound } from "lucide-react";
import TarefasMembrosTab from "@/components/tarefas/TarefasMembrosTab";

export default function EquipePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UsersRound className="h-6 w-6" />
          Equipe
        </h1>
        <p className="text-muted-foreground">Gerencie os membros da sua equipe</p>
      </div>
      <TarefasMembrosTab />
    </div>
  );
}
