import { UsersRound } from "lucide-react";
import TarefasMembrosTab from "@/components/tarefas/TarefasMembrosTab";
import EquipeAnalytics from "@/components/equipe/EquipeAnalytics";
import CargosConfig from "@/components/equipe/CargosConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronUp, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function EquipePage() {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UsersRound className="h-6 w-6" />
          Equipe
        </h1>
        <p className="text-muted-foreground">Gerencie os membros da sua equipe</p>
      </div>
      <EquipeAnalytics />

      {/* Configurações colapsável */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <Card className="p-0">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-5">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configurações da Equipe
            </h3>
            {configOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-5 pb-5">
            <CargosConfig />
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <TarefasMembrosTab />
    </div>
  );
}
