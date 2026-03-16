import { UsersRound, Users, Shield } from "lucide-react";
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
        <TabsList>
          <TabsTrigger value="membros" className="gap-1.5">
            <Users className="h-4 w-4" />
            Membros
          </TabsTrigger>
          <TabsTrigger value="cargos" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Cargos
          </TabsTrigger>
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
