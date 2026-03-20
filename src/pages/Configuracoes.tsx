import { Settings, Video, MessageSquare, Link, RotateCcw, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import MensagensPredefinidas from "./MensagensPredefinidas";

import Conexoes from "./Conexoes";
import { ResetDataConfig } from "@/components/configuracoes/ResetDataConfig";
import { TiposReuniaoConfig } from "@/components/configuracoes/TiposReuniaoConfig";
import { ContaSimpleConfig } from "@/components/configuracoes/ContaSimpleConfig";
import { useTabPersistence } from "@/hooks/useTabPersistence";

const tabOptions = [
  { value: "tipos-reuniao", label: "Tipos Reunião", icon: Video },
  { value: "mensagens", label: "Mensagens", icon: MessageSquare },
  { value: "conexoes", label: "Conexões", icon: Link },
  { value: "conta-simples", label: "Conta Simples", icon: CreditCard },
  { value: "reset", label: "Reset", icon: RotateCcw },
];

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useTabPersistence("tab", "tipos-reuniao");
  const isMobile = useIsMobile();
  const isTablet = typeof window !== 'undefined' && window.innerWidth < 1024 && window.innerWidth >= 768;
  const useDropdown = isMobile || isTablet;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Configurações</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {useDropdown ? (
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {tabOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <TabsList>
            {tabOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="gap-1.5">
                <option.icon className="h-4 w-4" />
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="tipos-reuniao">
          <TiposReuniaoConfig />
        </TabsContent>
        
        
        
        <TabsContent value="mensagens">
          <MensagensPredefinidas />
        </TabsContent>

        <TabsContent value="conexoes">
          <Conexoes />
        </TabsContent>

        <TabsContent value="conta-simples">
          <ContaSimpleConfig />
        </TabsContent>


        <TabsContent value="reset">
          <ResetDataConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
