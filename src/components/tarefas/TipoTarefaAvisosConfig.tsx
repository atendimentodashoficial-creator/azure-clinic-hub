import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Bell } from "lucide-react";
import { useState } from "react";

export interface AvisoConfig {
  ativo: boolean;
  mensagem: string;
}

export interface AvisosMap {
  atribuida?: AvisoConfig;
  aprovacao_interna?: AvisoConfig;
  aprovacao_cliente?: AvisoConfig;
  reprovada_cliente?: AvisoConfig;
  ajustada?: AvisoConfig;
  aprovada_concluida?: AvisoConfig;
}

const AVISO_TYPES: { key: keyof AvisosMap; label: string; description: string; defaultMsg: string }[] = [
  { key: "atribuida", label: "Tarefa atribuída", description: "Quando a tarefa é atribuída a um membro", defaultMsg: "Olá! A tarefa *{tarefa}* foi atribuída a você no projeto *{cliente}*." },
  { key: "aprovacao_interna", label: "Enviada para aprovação interna", description: "Quando a tarefa é enviada para o gestor revisar", defaultMsg: "A tarefa *{tarefa}* do projeto *{cliente}* está aguardando sua aprovação interna." },
  { key: "aprovacao_cliente", label: "Enviada para aprovação do cliente", description: "Quando a tarefa é enviada para aprovação do cliente", defaultMsg: "Olá *{cliente}*! A tarefa *{tarefa}* está pronta para sua aprovação." },
  { key: "reprovada_cliente", label: "Reprovada pelo cliente", description: "Quando o cliente reprova a tarefa", defaultMsg: "A tarefa *{tarefa}* do projeto *{cliente}* foi reprovada pelo cliente." },
  { key: "ajustada", label: "Tarefa ajustada (revisada)", description: "Quando a tarefa é reenviada após revisão", defaultMsg: "A tarefa *{tarefa}* do projeto *{cliente}* foi ajustada e reenviada." },
  { key: "aprovada_concluida", label: "Aprovada / Concluída", description: "Quando a tarefa é aprovada e concluída", defaultMsg: "A tarefa *{tarefa}* do projeto *{cliente}* foi aprovada e concluída! ✅" },
];

interface Props {
  avisos: AvisosMap;
  onChange: (avisos: AvisosMap) => void;
}

export function TipoTarefaAvisosConfig({ avisos, onChange }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateAviso = (key: keyof AvisosMap, field: keyof AvisoConfig, value: any) => {
    const current = avisos[key] || { ativo: false, mensagem: AVISO_TYPES.find(a => a.key === key)?.defaultMsg || "" };
    onChange({
      ...avisos,
      [key]: { ...current, [field]: value },
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Avisos por WhatsApp</Label>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Configure quais notificações serão enviadas via WhatsApp para este tipo de tarefa. Use {"{tarefa}"}, {"{cliente}"}, {"{membro}"} nas mensagens.
      </p>
      <div className="space-y-1">
        {AVISO_TYPES.map(aviso => {
          const config = avisos[aviso.key] || { ativo: false, mensagem: aviso.defaultMsg };
          const isOpen = openSections[aviso.key] || false;

          return (
            <Collapsible key={aviso.key} open={isOpen} onOpenChange={() => toggleSection(aviso.key)}>
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3">
                  <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                    <div>
                      <span className="text-sm font-medium">{aviso.label}</span>
                      <p className="text-xs text-muted-foreground">{aviso.description}</p>
                    </div>
                  </CollapsibleTrigger>
                  <Switch
                    checked={config.ativo}
                    onCheckedChange={v => updateAviso(aviso.key, "ativo", v)}
                  />
                </div>
                <CollapsibleContent>
                  {config.ativo && (
                    <div className="px-3 pb-3">
                      <Textarea
                        value={config.mensagem}
                        onChange={e => updateAviso(aviso.key, "mensagem", e.target.value)}
                        placeholder="Mensagem do aviso..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
