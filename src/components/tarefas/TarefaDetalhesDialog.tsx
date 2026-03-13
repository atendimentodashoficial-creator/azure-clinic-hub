import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas, TipoTarefa } from "@/hooks/useTiposTarefas";
import { useTarefaMockups } from "@/hooks/useTarefaMockups";
import { MockupEditor } from "./MockupEditor";
import { MockupSlide } from "./MockupPreview";
import { TarefaTimer } from "./TarefaTimer";
import { Building2, Calendar, Video, Upload, Save, Send, Link2, Copy } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

const FILE_TYPE_LABELS: Record<string, string> = {
  imagens: "Imagens",
  videos: "Vídeos",
  pdf: "PDF",
  zip: "ZIP",
  texto: "Texto",
  mockup: "Mockup de Post",
  qualquer: "Qualquer arquivo",
};

interface TarefaDetalhesDialogProps {
  tarefa: Tarefa | null;
  colunas: TarefaColuna[];
  clientes: { id: string; nome: string; empresa: string | null }[];
  reunioesMap?: Record<string, { data_reuniao: string; status: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TarefaDetalhesDialog({ tarefa, colunas, clientes, reunioesMap, open, onOpenChange }: TarefaDetalhesDialogProps) {
  const { tipos } = useTiposTarefas();
  const { mockups, saveMockups } = useTarefaMockups(tarefa?.id || null);
  
  const [mockupSlides, setMockupSlides] = useState<MockupSlide[]>([
    { ordem: 0, subtitulo: "", titulo: "", legenda: "", cta: "" },
  ]);

  const tipoTarefa = tarefa?.tipo_tarefa_id ? tipos.find(t => t.id === tarefa.tipo_tarefa_id) : null;
  const hasMockup = tipoTarefa?.tipos_arquivo_permitidos?.includes("mockup");
  const mockupLimit = tipoTarefa?.limite_arquivos?.mockup || 0; // 0 = unlimited
  const cliente = tarefa?.cliente_id ? clientes.find(c => c.id === tarefa.cliente_id) : null;
  const reuniao = tarefa?.reuniao_id && reunioesMap ? reunioesMap[tarefa.reuniao_id] : null;
  const prio = PRIORIDADES.find(p => p.value === tarefa?.prioridade) || PRIORIDADES[1];
  const coluna = tarefa ? colunas.find(c => c.id === tarefa.coluna_id) : null;

  // Load existing mockups or initialize with required count
  const mockupsKey = mockups.map(m => m.id).join(",");
  useEffect(() => {
    if (mockups.length > 0) {
      setMockupSlides(mockups.map(m => ({
        id: m.id,
        ordem: m.ordem,
        subtitulo: m.subtitulo || "",
        titulo: m.titulo || "",
        legenda: m.legenda || "",
        cta: m.cta || "",
      })));
    } else if (hasMockup) {
      const count = mockupLimit > 0 ? mockupLimit : 1;
      setMockupSlides(
        Array.from({ length: count }, (_, i) => ({ ordem: i, subtitulo: "", titulo: "", legenda: "", cta: "" }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockupsKey, mockupLimit, hasMockup]);

  const handleSaveMockups = async () => {
    try {
      await saveMockups.mutateAsync(mockupSlides);
      toast.success("Mockup salvo com sucesso!");
    } catch {
      toast.error("Erro ao salvar mockup");
    }
  };

  const handleSendForApproval = async () => {
    if (!tarefa) return;
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("tarefas")
        .update({ approval_token: token, approval_status: "aguardando" })
        .eq("id", tarefa.id);
      if (error) throw error;
      const link = `${window.location.origin}/aprovacao/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link de aprovação copiado para a área de transferência!");
      // Force refresh
      window.location.reload();
    } catch {
      toast.error("Erro ao gerar link de aprovação");
    }
  };

  if (!tarefa) return null;

  // Determine which file types this task type requires (excluding mockup)
  const requiredFileTypes = tipoTarefa?.tipos_arquivo_permitidos?.filter(t => t !== "mockup" && t !== "qualquer") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tarefa.titulo}
            {coluna && (
              <Badge variant="outline" className="text-xs font-normal" style={{ borderColor: coluna.cor, color: coluna.cor }}>
                {coluna.nome}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Info section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={cn("text-xs border-0", prio.color)}>{prio.label}</Badge>
              {tarefa.data_limite && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(tarefa.data_limite + "T00:00:00"), "dd/MM/yyyy")}
                </span>
              )}
              <TarefaTimer
                timerStatus={tarefa.timer_status}
                timerInicio={tarefa.timer_inicio}
                tempoAcumulado={tarefa.tempo_acumulado_segundos}
              />
            </div>

            {tarefa.descricao && (
              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{tarefa.descricao}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {tarefa.responsavel_nome && (
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <p className="text-sm mt-0.5">{tarefa.responsavel_nome}</p>
                </div>
              )}
              {cliente && (
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="text-sm mt-0.5 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {cliente.nome}
                  </p>
                </div>
              )}
            </div>

            {reuniao && (
              <div>
                <Label className="text-xs text-muted-foreground">Reunião</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1 text-primary">
                  <Video className="h-3 w-3" />
                  {format(new Date(reuniao.data_reuniao), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
            )}

            {tipoTarefa && (
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Tarefa</Label>
                <p className="text-sm mt-0.5 font-medium">{tipoTarefa.nome}</p>
                {tipoTarefa.descricao && <p className="text-xs text-muted-foreground">{tipoTarefa.descricao}</p>}
              </div>
            )}
          </div>

          {/* File upload requirements */}
          {requiredFileTypes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Upload className="h-4 w-4" /> Arquivos necessários
                </Label>
                <div className="flex flex-wrap gap-2">
                  {requiredFileTypes.map(ft => {
                    const limite = tipoTarefa?.limite_arquivos?.[ft];
                    return (
                      <Badge key={ft} variant="secondary" className="text-xs">
                        {FILE_TYPE_LABELS[ft] || ft}
                        {limite && limite > 0 ? ` (${limite})` : ""}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Upload de arquivos em breve</p>
              </div>
            </>
          )}

          {/* Mockup editor */}
          {hasMockup && (
            <>
              <Separator />
              <div className="space-y-3">
                <MockupEditor
                  slides={mockupSlides}
                  onChange={setMockupSlides}
                  perfilNome={cliente?.nome || "perfil"}
                  perfilCategoria={cliente?.empresa || ""}
                  maxSlides={mockupLimit}
                />
                <Button onClick={handleSaveMockups} disabled={saveMockups.isPending} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {saveMockups.isPending ? "Salvando..." : "Salvar Mockup"}
                </Button>

                {/* Approval actions */}
                {mockups.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    {tarefa.approval_token ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Link de aprovação</Label>
                        <div className="flex gap-2">
                          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded truncate">
                            {`${window.location.origin}/aprovacao/${tarefa.approval_token}`}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${tarefa.approval_token}`);
                              toast.success("Link copiado!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Show mockup statuses */}
                        <div className="space-y-1.5 mt-1">
                          {mockups.map((m, i) => (
                            <div key={m.id} className="space-y-1">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]",
                                  m.status === "aprovado" ? "border-emerald-500 text-emerald-400" :
                                  m.status === "reprovado" ? "border-red-500 text-red-400 cursor-pointer hover:bg-red-500/10" :
                                  "border-muted-foreground/30 text-muted-foreground"
                                )}
                                onClick={() => m.status === "reprovado" && m.feedback && setExpandedFeedback(prev => prev === m.id ? null : m.id)}
                              >
                                Slide {i + 1}: {m.status === "aprovado" ? "Aprovado" : m.status === "reprovado" ? "Reprovado" : "Pendente"}
                              </Badge>
                              {m.status === "reprovado" && m.feedback && expandedFeedback === m.id && (
                                <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 ml-1 animate-in fade-in slide-in-from-top-1">
                                  💬 {m.feedback}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleSendForApproval}
                      >
                        <Send className="h-4 w-4" />
                        Enviar para Aprovação
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
