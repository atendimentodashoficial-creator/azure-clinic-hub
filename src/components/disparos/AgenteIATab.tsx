import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Settings, BookOpen, Flame, Workflow } from "lucide-react";
import { DisparosSupabaseConfig } from "@/components/disparos/DisparosSupabaseConfig";
import { DisparosRAGConfig } from "@/components/disparos/DisparosRAGConfig";
import { AquecimentoConfig } from "@/components/disparos/AquecimentoConfig";
import { AgentesSDRManager } from "@/components/disparos/AgentesSDRManager";

export function AgenteIATab() {
  return (
    <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-3">
      <Tabs defaultValue="agentes-sdr">
        <TabsList className="mb-4">
          <TabsTrigger value="agentes-sdr" className="gap-1.5">
            <Workflow className="h-4 w-4" />
            Agentes SDR
          </TabsTrigger>
          <TabsTrigger value="aquecimento" className="gap-1.5">
            <Flame className="h-4 w-4" />
            Aquecimento
          </TabsTrigger>
          <TabsTrigger value="supabase" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Supabase
          </TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Base RAG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agentes-sdr">
          <AgentesSDRManager />
        </TabsContent>

        <TabsContent value="aquecimento">
          <AquecimentoConfig />
        </TabsContent>

        <TabsContent value="supabase">
          <DisparosSupabaseConfig />
        </TabsContent>

        <TabsContent value="rag">
          <DisparosRAGConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
