import { UsersRound } from "lucide-react";
import TarefasMembrosTab from "@/components/tarefas/TarefasMembrosTab";
import EquipeAnalytics from "@/components/equipe/EquipeAnalytics";
import CargosConfig from "@/components/equipe/CargosConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      <Tabs defaultValue="membros" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="membros" className="text-xs px-3 h-7">Membros</TabsTrigger>
          <TabsTrigger value="cargos" className="text-xs px-3 h-7">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="membros" className="space-y-6">
          <EquipeAnalytics />
          <TarefasMembrosTab />
        </TabsContent>

        <TabsContent value="cargos">
          <CargosConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
