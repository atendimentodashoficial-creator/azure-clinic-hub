import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas, TipoTarefa } from "@/hooks/useTiposTarefas";
import { useTarefaMockups } from "@/hooks/useTarefaMockups";
import { useTarefaLinks } from "@/hooks/useTarefaLinks";
import { useTarefaGrid } from "@/hooks/useTarefaGrid";
import { useTarefaGridHighlights } from "@/hooks/useTarefaGridHighlights";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useUserRole } from "@/hooks/useUserRole";
import { GridPostsManager } from "./GridPostsManager";
import { GridHighlightsManager } from "./GridHighlightsManager";
import { MockupPostsManager, PostGroup } from "./MockupPostsManager";
import { MockupSlide } from "./MockupPreview";
import { TarefaTimer } from "./TarefaTimer";
import { Building2, Calendar, Video, Upload, Save, Send, Link2, Copy, History, Plus, Trash2, ExternalLink, Globe, Instagram, Phone, Mail, FileText, ChevronRight, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay } from "@/utils/phoneFormat";
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
  links: "Links",
  mockup: "Mockup de Post",
  grade: "Grade do Instagram",
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
  const { clientes: clientesCompletos } = useTarefasClientes();
  const { membros } = useTarefasMembros();
  const { membro: membroAtual } = useMembroAtual();
  const { role } = useUserRole();
  const { mockups, saveMockups, resubmitRejected } = useTarefaMockups(tarefa?.id || null);
  const { links: savedLinks, saveLinks } = useTarefaLinks(tarefa?.id || null);
  const { gridPosts, uploadImage, uploadBatch, removeImage, reorderPosts, resubmitRejected: resubmitGridRejected } = useTarefaGrid(tarefa?.id || null);
  const { highlights: gridHighlights, addHighlight, addBatch: addHighlightBatch, removeHighlight, updateTitle: updateHighlightTitle, reorderHighlights, resubmitRejected: resubmitHighlightsRejected } = useTarefaGridHighlights(tarefa?.id || null);
  const [resubmitting, setResubmitting] = useState(false);
  const [posts, setPosts] = useState<PostGroup[]>([
    { postIndex: 0, slides: [{ ordem: 0, subtitulo: "", titulo: "", legenda: "", cta: "" }] },
  ]);
  const [taskLinks, setTaskLinks] = useState<{ url: string; titulo: string }[]>([]);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showClienteSheet, setShowClienteSheet] = useState(false);
  const [internaFeedback, setInternaFeedback] = useState("");

  const { data: clienteCompleto } = useQuery({
    queryKey: ["tarefa-cliente-detalhes", tarefa?.cliente_id],
    queryFn: async () => {
      if (!tarefa?.cliente_id) return null;
      const { data, error } = await supabase
        .from("tarefas_clientes")
        .select("*")
        .eq("id", tarefa.cliente_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tarefa?.cliente_id && showClienteSheet,
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["tarefa-revisoes", tarefa?.id],
    queryFn: async () => {
      if (!tarefa?.id) return [];
      const { data, error } = await supabase
        .from("tarefa_revisoes")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; slide_ordem: number; feedback: string | null; status: string; created_at: string }[];
    },
    enabled: !!tarefa?.id,
  });

  const tipoTarefa = tarefa?.tipo_tarefa_id ? tipos.find(t => t.id === tarefa.tipo_tarefa_id) : null;
  const hasMockup = tipoTarefa?.tipos_arquivo_permitidos?.includes("mockup");
  const hasLinks = tipoTarefa?.tipos_arquivo_permitidos?.includes("links");
  const hasGrid = tipoTarefa?.tipos_arquivo_permitidos?.includes("grade");
  const mockupLimit = tipoTarefa?.limite_arquivos?.mockup || 0;
  const linksLimit = tipoTarefa?.limite_arquivos?.links || 0;
  const requiresApproval = hasMockup || hasLinks || hasGrid;
  const exigeAprovacaoInterna = tipoTarefa?.exige_aprovacao_interna ?? false;
  const exigeAprovacaoCliente = tipoTarefa?.exige_aprovacao ?? false;
  const cliente = tarefa?.cliente_id ? clientes.find(c => c.id === tarefa.cliente_id) : null;
  const clienteCompleto2 = tarefa?.cliente_id ? clientesCompletos.find(c => c.id === tarefa.cliente_id) : null;
  const gestorMembro = clienteCompleto2?.gestor_id ? membros.find(m => m.id === clienteCompleto2.gestor_id) : null;
  const reuniao = tarefa?.reuniao_id && reunioesMap ? reunioesMap[tarefa.reuniao_id] : null;
  const prio = PRIORIDADES.find(p => p.value === tarefa?.prioridade) || PRIORIDADES[1];
  const coluna = tarefa ? colunas.find(c => c.id === tarefa.coluna_id) : null;

  // Load existing mockups or initialize with required count
  const mockupsKey = mockups.map(m => m.id).join(",");
  useEffect(() => {
    if (mockups.length > 0) {
      // Group mockups by post_index
      const grouped = new Map<number, MockupSlide[]>();
      mockups.forEach(m => {
        const pi = m.post_index ?? 0;
        if (!grouped.has(pi)) grouped.set(pi, []);
        grouped.get(pi)!.push({
          id: m.id,
          ordem: m.ordem,
          subtitulo: m.subtitulo || "",
          titulo: m.titulo || "",
          legenda: m.legenda || "",
          cta: m.cta || "",
        });
      });
      const postGroups: PostGroup[] = Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([postIndex, slides]) => ({ postIndex, slides }));
      setPosts(postGroups);
    } else if (hasMockup) {
      const count = mockupLimit > 0 ? mockupLimit : 1;
      setPosts(
        Array.from({ length: count }, (_, i) => ({
          postIndex: i,
          slides: [{ ordem: 0, subtitulo: "", titulo: "", legenda: "", cta: "" }],
        }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockupsKey, mockupLimit, hasMockup]);

  // Load saved links
  const savedLinksKey = savedLinks.map(l => l.id).join(",");
  useEffect(() => {
    if (savedLinks.length > 0) {
      setTaskLinks(savedLinks.map(l => ({ url: l.url, titulo: l.titulo || "" })));
    } else if (hasLinks) {
      const count = linksLimit > 0 ? linksLimit : 1;
      setTaskLinks(Array.from({ length: count }, () => ({ url: "", titulo: "" })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLinksKey, hasLinks, linksLimit]);

  const handleSaveMockups = async () => {
    try {
      // Flatten posts into slides with post_index
      const allSlides = posts.flatMap(post =>
        post.slides.map(s => ({ ...s, post_index: post.postIndex }))
      );
      await saveMockups.mutateAsync(allSlides);
      toast.success("Mockups salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar mockups");
    }
  };

  const normalizeColumnName = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const isAprovacaoClienteColumn = (name: string) => {
    const normalized = normalizeColumnName(name);
    return (normalized.includes("aguardando") && normalized.includes("aprovacao")) ||
           (normalized.includes("aprovacao") && normalized.includes("cliente"));
  };

  const isAprovacaoInternaColumn = (name: string) => {
    const normalized = normalizeColumnName(name);
    return normalized.includes("aprovacao") && normalized.includes("interna");
  };

  const isConcluido = (name: string) => normalizeColumnName(name).includes("concluido");

  const isEmRevisao = (name: string) => normalizeColumnName(name).includes("revisao");

  const findColumnByMatcher = (matcher: (name: string) => boolean) => {
    const fromProps = colunas.find(c => matcher(c.nome));
    return fromProps?.id ?? null;
  };

  const findColumnByMatcherAsync = async (matcher: (name: string) => boolean) => {
    const fromProps = findColumnByMatcher(matcher);
    if (fromProps) return fromProps;
    if (!tarefa?.user_id) return null;

    const { data, error } = await supabase
      .from("tarefas_colunas")
      .select("id, nome")
      .eq("user_id", tarefa.user_id)
      .order("ordem", { ascending: true });

    if (error) throw error;
    return data?.find(c => matcher(c.nome))?.id ?? null;
  };

  const handleSendForApproval = async () => {
    if (!tarefa) return;
    try {
      // If internal approval is required and not yet approved, send to internal approval first
      if (exigeAprovacaoInterna && tarefa.aprovacao_interna_status !== "aprovado") {
        const internaColumnId = await findColumnByMatcherAsync(isAprovacaoInternaColumn);
        const updateData: Record<string, any> = {
          aprovacao_interna_status: "pendente",
          updated_at: new Date().toISOString(),
        };
        if (internaColumnId) {
          updateData.coluna_id = internaColumnId;
        }
        const { error } = await supabase
          .from("tarefas")
          .update(updateData)
          .eq("id", tarefa.id);
        if (error) throw error;
        toast.success("Tarefa enviada para aprovação interna do gestor!");
        window.location.reload();
        return;
      }

      // Normal client approval flow
      const token = tarefa.approval_token || crypto.randomUUID();
      const approvalColumnId = await findColumnByMatcherAsync(isAprovacaoClienteColumn);
      const updateData: Record<string, any> = {
        approval_token: token,
        approval_status: "aguardando",
        updated_at: new Date().toISOString(),
      };
      if (approvalColumnId) {
        updateData.coluna_id = approvalColumnId;
      }
      const { error } = await supabase
        .from("tarefas")
        .update(updateData)
        .eq("id", tarefa.id);
      if (error) throw error;

      const link = `${window.location.origin}/aprovacao/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link de aprovação copiado para a área de transferência!");
      window.location.reload();
    } catch {
      toast.error("Erro ao gerar link de aprovação");
    }
  };

  const handleInternalApproval = async (status: "aprovado" | "reprovado") => {
    if (!tarefa) return;
    setResubmitting(true);
    try {
      const gestorNome = gestorMembro?.nome || membroAtual?.nome || "Gestor";

      if (status === "aprovado") {
        // If client approval is also needed, move to Aprovação Cliente
        if (exigeAprovacaoCliente) {
          const token = tarefa.approval_token || crypto.randomUUID();
          const clienteColumnId = await findColumnByMatcherAsync(isAprovacaoClienteColumn);
          const updateData: Record<string, any> = {
            aprovacao_interna_status: "aprovado",
            aprovacao_interna_por: gestorNome,
            aprovacao_interna_feedback: internaFeedback || null,
            approval_token: token,
            approval_status: "aguardando",
            updated_at: new Date().toISOString(),
          };
          if (clienteColumnId) {
            updateData.coluna_id = clienteColumnId;
          }
          const { error } = await supabase.from("tarefas").update(updateData).eq("id", tarefa.id);
          if (error) throw error;

          const link = `${window.location.origin}/aprovacao/${token}`;
          await navigator.clipboard.writeText(link);
          toast.success("Aprovação interna concluída! Link de aprovação do cliente copiado.");
        } else {
          // No client approval, move to Concluído
          const concluidoColumnId = await findColumnByMatcherAsync(isConcluido);
          const updateData: Record<string, any> = {
            aprovacao_interna_status: "aprovado",
            aprovacao_interna_por: gestorNome,
            aprovacao_interna_feedback: internaFeedback || null,
            approval_status: "concluido",
            updated_at: new Date().toISOString(),
          };
          if (concluidoColumnId) {
            updateData.coluna_id = concluidoColumnId;
          }
          const { error } = await supabase.from("tarefas").update(updateData).eq("id", tarefa.id);
          if (error) throw error;
          toast.success("Aprovação interna concluída! Tarefa finalizada.");
        }
      } else {
        // Reprovado - move to Em Revisão
        const revisaoColumnId = await findColumnByMatcherAsync(isEmRevisao);
        const updateData: Record<string, any> = {
          aprovacao_interna_status: "reprovado",
          aprovacao_interna_por: gestorNome,
          aprovacao_interna_feedback: internaFeedback || null,
          updated_at: new Date().toISOString(),
        };
        if (revisaoColumnId) {
          updateData.coluna_id = revisaoColumnId;
        }
        const { error } = await supabase.from("tarefas").update(updateData).eq("id", tarefa.id);
        if (error) throw error;
        toast.success("Tarefa reprovada internamente e enviada para revisão.");
      }

      setInternaFeedback("");
      window.location.reload();
    } catch {
      toast.error("Erro ao processar aprovação interna");
    } finally {
      setResubmitting(false);
    }
  };

  const handleResubmitRejected = async () => {
    if (!tarefa) return;
    setResubmitting(true);
    try {
      await resubmitRejected.mutateAsync();

      const approvalColumnId = await findColumnByMatcherAsync(isAprovacaoClienteColumn);
      if (approvalColumnId) {
        const { error } = await supabase
          .from("tarefas")
          .update({ coluna_id: approvalColumnId, updated_at: new Date().toISOString() })
          .eq("id", tarefa.id);
        if (error) throw error;
      }

      toast.success("Itens revisados reenviados para aprovação!");
      window.location.reload();
    } catch {
      toast.error("Erro ao reenviar para aprovação");
    } finally {
      setResubmitting(false);
    }
  };

  if (!tarefa) return null;

  // Determine which file types this task type requires (excluding mockup)
  const requiredFileTypes = tipoTarefa?.tipos_arquivo_permitidos?.filter(t => t !== "mockup" && t !== "qualquer" && t !== "links" && t !== "grade") || [];

  return (
    <>
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
                  <button
                    onClick={() => setShowClienteSheet(true)}
                    className="text-sm mt-0.5 flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    <Building2 className="h-3 w-3" /> {cliente.nome}
                    <ChevronRight className="h-3 w-3" />
                  </button>
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

          {/* Internal Approval Section */}
          {exigeAprovacaoInterna && tarefa.aprovacao_interna_status && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Aprovação Interna
                </Label>

                {tarefa.aprovacao_interna_status === "pendente" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="border-amber-500 text-amber-400 text-[10px]">
                        Aguardando aprovação
                      </Badge>
                      {gestorMembro && (
                        <span className="text-xs text-muted-foreground">
                          Gestor: <strong>{gestorMembro.nome}</strong>
                        </span>
                      )}
                    </div>
                    <Textarea
                      placeholder="Feedback da aprovação interna (opcional)..."
                      value={internaFeedback}
                      onChange={e => setInternaFeedback(e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleInternalApproval("aprovado")}
                        disabled={resubmitting}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {resubmitting ? "Processando..." : "Aprovar"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleInternalApproval("reprovado")}
                        disabled={resubmitting}
                      >
                        <XCircle className="h-4 w-4" />
                        Reprovar
                      </Button>
                    </div>
                  </div>
                )}

                {tarefa.aprovacao_interna_status === "aprovado" && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-500 text-emerald-400 text-[10px]">
                      Aprovado internamente
                    </Badge>
                    {tarefa.aprovacao_interna_por && (
                      <span className="text-xs text-muted-foreground">por {tarefa.aprovacao_interna_por}</span>
                    )}
                  </div>
                )}

                {tarefa.aprovacao_interna_status === "reprovado" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-red-500 text-red-400 text-[10px]">
                        Reprovado internamente
                      </Badge>
                      {tarefa.aprovacao_interna_por && (
                        <span className="text-xs text-muted-foreground">por {tarefa.aprovacao_interna_por}</span>
                      )}
                    </div>
                    {tarefa.aprovacao_interna_feedback && (
                      <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1">
                        💬 {tarefa.aprovacao_interna_feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

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

          {/* Links editor */}
          {hasLinks && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Links
                  {linksLimit > 0 && <span className="text-xs text-muted-foreground font-normal">({taskLinks.length}/{linksLimit})</span>}
                </Label>
                <div className="space-y-2">
                  {taskLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Título do link (opcional)"
                          value={link.titulo}
                          className="text-xs h-8"
                          onChange={e => {
                            const updated = [...taskLinks];
                            updated[i] = { ...updated[i], titulo: e.target.value };
                            setTaskLinks(updated);
                          }}
                        />
                        <Input
                          placeholder="https://..."
                          value={link.url}
                          onChange={e => {
                            const updated = [...taskLinks];
                            updated[i] = { ...updated[i], url: e.target.value };
                            setTaskLinks(updated);
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        {link.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.open(link.url, "_blank")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {taskLinks.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setTaskLinks(taskLinks.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {(linksLimit === 0 || taskLinks.length < linksLimit) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTaskLinks([...taskLinks, { url: "", titulo: "" }])}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar link
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    try {
                      const filtered = taskLinks.filter(l => l.url.trim());
                      await saveLinks.mutateAsync(filtered.map(l => ({ url: l.url.trim(), titulo: l.titulo.trim() || null })));
                      toast.success("Links salvos com sucesso!");
                    } catch {
                      toast.error("Erro ao salvar links");
                    }
                  }}
                  disabled={saveLinks.isPending}
                  className="w-full gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveLinks.isPending ? "Salvando..." : "Salvar Links"}
                </Button>
              </div>
            </>
          )}


          {hasMockup && (
            <>
              <Separator />
              <div className="space-y-3">
                <MockupPostsManager
                  posts={posts}
                  onChange={setPosts}
                  maxPosts={mockupLimit}
                  perfilNome={cliente?.nome || "perfil"}
                  perfilCategoria={cliente?.empresa || ""}
                  perfilFotoUrl={(cliente as any)?.foto_perfil_url}
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

                        {/* Resubmit rejected items button */}
                        {mockups.some(m => m.status === "reprovado") && (
                          <Button
                            variant="outline"
                            className="w-full gap-2 mt-2"
                            onClick={handleResubmitRejected}
                            disabled={resubmitting}
                          >
                            <Send className="h-4 w-4" />
                            {resubmitting ? "Reenviando..." : `Reenviar ${mockups.filter(m => m.status === "reprovado").length} item(ns) para Aprovação`}
                          </Button>
                        )}

                        {/* Revision history */}
                        {revisoes.length > 0 && (
                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full gap-1.5 text-xs text-muted-foreground"
                              onClick={() => setShowHistory(prev => !prev)}
                            >
                              <History className="h-3.5 w-3.5" />
                              Histórico de revisões ({revisoes.length})
                            </Button>
                            {showHistory && (
                              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                                {revisoes.map(r => (
                                  <div key={r.id} className="text-[11px] border rounded px-2.5 py-1.5 space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <Badge
                                        variant="outline"
                                        className={cn("text-[10px] border-0 px-0",
                                          r.status === "aprovado" ? "text-emerald-400" :
                                          r.status === "reprovado" ? "text-red-400" :
                                          "text-muted-foreground"
                                        )}
                                      >
                                        Slide {(r.slide_ordem ?? 0) + 1} — {r.status === "aprovado" ? "Aprovado" : "Reprovado"}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                      </span>
                                    </div>
                                    {r.feedback && (
                                      <p className="text-muted-foreground">💬 {r.feedback}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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

          {/* Grid editor */}
          {hasGrid && (
            <>
              <Separator />
              <div className="space-y-3">
                <GridPostsManager
                  gridPosts={gridPosts}
                  onUpload={async (posicao, file) => {
                    await uploadImage.mutateAsync({ posicao, file });
                  }}
                  onBatchUpload={async (files) => {
                    return await uploadBatch.mutateAsync(files);
                  }}
                  onRemove={async (posicao) => {
                    await removeImage.mutateAsync(posicao);
                  }}
                  onReorder={async (newOrder) => {
                    await reorderPosts.mutateAsync(newOrder);
                  }}
                  uploading={uploadImage.isPending || uploadBatch.isPending}
                />

                <Separator />

                <GridHighlightsManager
                  highlights={gridHighlights}
                  onAdd={async (file, titulo) => {
                    await addHighlight.mutateAsync({ file, titulo });
                  }}
                  onBatchAdd={async (files) => {
                    return await addHighlightBatch.mutateAsync(files);
                  }}
                  onRemove={async (id) => {
                    await removeHighlight.mutateAsync(id);
                  }}
                  onUpdateTitle={async (id, titulo) => {
                    await updateHighlightTitle.mutateAsync({ id, titulo });
                  }}
                  onReorder={async (newOrder) => {
                    await reorderHighlights.mutateAsync(newOrder);
                  }}
                  uploading={addHighlight.isPending || addHighlightBatch.isPending}
                />


                {gridPosts.length > 0 && (
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
                        <div className="space-y-1.5 mt-1">
                          {gridPosts.map(g => (
                            <div key={g.id} className="space-y-1">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]",
                                  g.status === "aprovado" ? "border-emerald-500 text-emerald-400" :
                                  g.status === "reprovado" ? "border-red-500 text-red-400 cursor-pointer hover:bg-red-500/10" :
                                  "border-muted-foreground/30 text-muted-foreground"
                                )}
                                onClick={() => g.status === "reprovado" && g.feedback && setExpandedFeedback(prev => prev === g.id ? null : g.id)}
                              >
                                Post {g.posicao + 1}: {g.status === "aprovado" ? "Aprovado" : g.status === "reprovado" ? "Reprovado" : "Pendente"}
                              </Badge>
                              {g.status === "reprovado" && g.feedback && expandedFeedback === g.id && (
                                <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 ml-1 animate-in fade-in slide-in-from-top-1">
                                  💬 {g.feedback}
                                </p>
                              )}
                            </div>
                          ))}
                          {gridHighlights.map(h => (
                            <div key={h.id} className="space-y-1">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]",
                                  h.status === "aprovado" ? "border-emerald-500 text-emerald-400" :
                                  h.status === "reprovado" ? "border-red-500 text-red-400 cursor-pointer hover:bg-red-500/10" :
                                  "border-muted-foreground/30 text-muted-foreground"
                                )}
                                onClick={() => h.status === "reprovado" && h.feedback && setExpandedFeedback(prev => prev === h.id ? null : h.id)}
                              >
                                Destaque "{h.titulo}": {h.status === "aprovado" ? "Aprovado" : h.status === "reprovado" ? "Reprovado" : "Pendente"}
                              </Badge>
                              {h.status === "reprovado" && h.feedback && expandedFeedback === h.id && (
                                <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 ml-1 animate-in fade-in slide-in-from-top-1">
                                  💬 {h.feedback}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        {(gridPosts.some(g => g.status === "reprovado") || gridHighlights.some(h => h.status === "reprovado")) && (
                          <Button
                            variant="outline"
                            className="w-full gap-2 mt-2"
                            onClick={async () => {
                              setResubmitting(true);
                              try {
                                await resubmitGridRejected.mutateAsync();
                                await resubmitHighlightsRejected.mutateAsync();
                                const approvalColumnId = await findColumnByMatcherAsync(isAprovacaoClienteColumn);
                                if (approvalColumnId) {
                                  await supabase.from("tarefas").update({ coluna_id: approvalColumnId, updated_at: new Date().toISOString() }).eq("id", tarefa.id);
                                }
                                toast.success("Itens reenviados para aprovação!");
                                window.location.reload();
                              } catch {
                                toast.error("Erro ao reenviar");
                              } finally {
                                setResubmitting(false);
                              }
                            }}
                            disabled={resubmitting}
                          >
                            <Send className="h-4 w-4" />
                            {resubmitting ? "Reenviando..." : `Reenviar ${gridPosts.filter(g => g.status === "reprovado").length + gridHighlights.filter(h => h.status === "reprovado").length} item(ns) para Aprovação`}
                          </Button>
                        )}
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

          {/* Link-only approval section (no mockups) */}
          {!hasMockup && !hasGrid && hasLinks && savedLinks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
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

                    {/* Approval status */}
                    {tarefa.approval_status && (
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]",
                          tarefa.approval_status === "concluido" ? "border-emerald-500 text-emerald-400" :
                          tarefa.approval_status === "em_revisao" ? "border-red-500 text-red-400" :
                          "border-amber-500 text-amber-400"
                        )}
                      >
                        {tarefa.approval_status === "concluido" ? "Aprovado" :
                         tarefa.approval_status === "em_revisao" ? "Mudança solicitada" :
                         "Aguardando aprovação"}
                      </Badge>
                    )}

                    {/* Resubmit for approval when in revision */}
                    {tarefa.approval_status === "em_revisao" && (
                      <Button
                        variant="outline"
                        className="w-full gap-2 mt-2"
                        onClick={async () => {
                          setResubmitting(true);
                          try {
                            const approvalColumnId = await findColumnByMatcherAsync(isAprovacaoClienteColumn);
                            const updateData: Record<string, any> = {
                              approval_status: "aguardando",
                              updated_at: new Date().toISOString(),
                            };
                            if (approvalColumnId) {
                              updateData.coluna_id = approvalColumnId;
                            }
                            const { error } = await supabase
                              .from("tarefas")
                              .update(updateData)
                              .eq("id", tarefa.id);
                            if (error) throw error;
                            toast.success("Reenviado para aprovação!");
                            window.location.reload();
                          } catch {
                            toast.error("Erro ao reenviar para aprovação");
                          } finally {
                            setResubmitting(false);
                          }
                        }}
                        disabled={resubmitting}
                      >
                        <Send className="h-4 w-4" />
                        {resubmitting ? "Reenviando..." : "Reenviar para Aprovação"}
                      </Button>
                    )}

                    {/* Revision history for link approvals */}
                    {revisoes.length > 0 && (
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full gap-1.5 text-xs text-muted-foreground"
                          onClick={() => setShowHistory(prev => !prev)}
                        >
                          <History className="h-3.5 w-3.5" />
                          Histórico de revisões ({revisoes.length})
                        </Button>
                        {showHistory && (
                          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                            {revisoes.map(r => (
                              <div key={r.id} className="text-[11px] border rounded px-2.5 py-1.5 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px] border-0 px-0",
                                      r.status === "aprovado" ? "text-emerald-400" :
                                      r.status === "reprovado" ? "text-red-400" :
                                      "text-muted-foreground"
                                    )}
                                  >
                                    {r.status === "aprovado" ? "Aprovado" : "Mudança solicitada"}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                  </span>
                                </div>
                                {r.feedback && (
                                  <p className="text-muted-foreground">💬 {r.feedback}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Cliente details sheet */}
    <Sheet open={showClienteSheet} onOpenChange={setShowClienteSheet}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {clienteCompleto?.nome || cliente?.nome || "Cliente"}
          </SheetTitle>
        </SheetHeader>
        {clienteCompleto && (
          <div className="space-y-4 mt-6">
            {clienteCompleto.empresa && (
              <div>
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <p className="text-sm mt-0.5">{clienteCompleto.empresa}</p>
              </div>
            )}
            {clienteCompleto.cnpj && (
              <div>
                <Label className="text-xs text-muted-foreground">CNPJ</Label>
                <p className="text-sm mt-0.5">{clienteCompleto.cnpj}</p>
              </div>
            )}
            {clienteCompleto.email && (
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`mailto:${clienteCompleto.email}`} className="text-primary hover:underline">{clienteCompleto.email}</a>
                </p>
              </div>
            )}
            {clienteCompleto.telefone && (
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatPhoneDisplay(clienteCompleto.telefone)}
                </p>
              </div>
            )}

            <Separator />

            {clienteCompleto.site && (
              <div>
                <Label className="text-xs text-muted-foreground">Site</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={clienteCompleto.site.startsWith("http") ? clienteCompleto.site : `https://${clienteCompleto.site}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{clienteCompleto.site}</a>
                </p>
              </div>
            )}
            {clienteCompleto.instagram && (
              <div>
                <Label className="text-xs text-muted-foreground">Instagram</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`https://instagram.com/${clienteCompleto.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{clienteCompleto.instagram}</a>
                </p>
              </div>
            )}
            {clienteCompleto.linktree && (
              <div>
                <Label className="text-xs text-muted-foreground">Linktree</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={clienteCompleto.linktree.startsWith("http") ? clienteCompleto.linktree : `https://${clienteCompleto.linktree}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{clienteCompleto.linktree}</a>
                </p>
              </div>
            )}
            {clienteCompleto.google_meu_negocio && (
              <div>
                <Label className="text-xs text-muted-foreground">Google Meu Negócio</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={clienteCompleto.google_meu_negocio.startsWith("http") ? clienteCompleto.google_meu_negocio : `https://${clienteCompleto.google_meu_negocio}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{clienteCompleto.google_meu_negocio}</a>
                </p>
              </div>
            )}
            {clienteCompleto.grupo_whatsapp && (
              <div>
                <Label className="text-xs text-muted-foreground">Grupo WhatsApp</Label>
                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={clienteCompleto.grupo_whatsapp} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Abrir grupo</a>
                </p>
              </div>
            )}

            {clienteCompleto.observacoes && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{clienteCompleto.observacoes}</p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
