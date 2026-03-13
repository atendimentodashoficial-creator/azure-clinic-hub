import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview, MockupSlide } from "@/components/tarefas/MockupPreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DeviceFrame } from "@/components/ui/device-frame";
import { Check, X, ChevronLeft, ChevronRight, Send, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MockupData {
  mockup_id: string;
  tarefa_id: string;
  ordem: number;
  post_index: number;
  subtitulo: string;
  titulo: string;
  legenda: string;
  cta: string;
  status: string;
  feedback: string | null;
  tarefa_titulo: string;
  cliente_nome: string;
  cliente_empresa: string;
}

interface TaskLink {
  url: string;
  titulo: string | null;
  ordem: number;
}

interface TaskInfo {
  tarefa_id: string;
  tarefa_titulo: string;
  cliente_nome: string;
  cliente_empresa: string;
  approval_status: string;
}

interface PostForApproval {
  postIndex: number;
  mockups: MockupData[];
  status: string;
}

function derivePostStatus(mockups: MockupData[]): string {
  const statuses = new Set(mockups.map(m => m.status));
  if (statuses.size === 1) return mockups[0].status;
  return "pendente";
}

export default function AprovacaoMockup() {
  const { token } = useParams<{ token: string }>();
  const [mockups, setMockups] = useState<MockupData[]>([]);
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPostIdx, setCurrentPostIdx] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [linkFeedback, setLinkFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkApprovalStatus, setLinkApprovalStatus] = useState<string>("pendente");

  const isLinkOnlyMode = mockups.length === 0 && taskLinks.length > 0;

  useEffect(() => {
    if (!token) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mockupRes, linksRes, taskRes] = await Promise.all([
        supabase.rpc("get_mockups_by_approval_token", { p_token: token! }),
        supabase.rpc("get_links_by_approval_token", { p_token: token! }),
        supabase.rpc("get_task_by_approval_token", { p_token: token! }),
      ]);

      if (mockupRes.error) throw mockupRes.error;
      const raw = (mockupRes.data || []) as MockupData[];
      const withPostIndex = raw.map(m => ({ ...m, post_index: (m as any).post_index ?? 0 }));
      setMockups(withPostIndex);
      setTaskLinks((linksRes.data || []) as TaskLink[]);

      const taskData = (taskRes.data || []) as TaskInfo[];
      if (taskData.length > 0) {
        setTaskInfo(taskData[0]);
        if (taskData[0].approval_status === "concluido") {
          setLinkApprovalStatus("aprovado");
        } else if (taskData[0].approval_status === "em_revisao") {
          setLinkApprovalStatus("reprovado");
        }
      }

      const fb: Record<number, string> = {};
      const grouped = groupByPost(withPostIndex);
      grouped.forEach(post => {
        const existingFeedback = post.mockups.find(m => m.feedback)?.feedback;
        if (existingFeedback) fb[post.postIndex] = existingFeedback;
      });
      setFeedbacks(fb);
    } catch (e: any) {
      setError(e.message || "Link inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  const groupByPost = (data: MockupData[]): PostForApproval[] => {
    const map = new Map<number, MockupData[]>();
    data.forEach(m => {
      const pi = m.post_index ?? 0;
      if (!map.has(pi)) map.set(pi, []);
      map.get(pi)!.push(m);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([postIndex, mocks]) => ({
        postIndex,
        mockups: mocks.sort((a, b) => a.ordem - b.ordem),
        status: derivePostStatus(mocks),
      }));
  };

  // === MOCKUP APPROVAL HANDLERS ===
  const posts = groupByPost(mockups);
  const currentPost = posts[currentPostIdx];

  const handleApprovePost = async () => {
    if (!currentPost) return;
    setSubmitting(true);
    try {
      for (const m of currentPost.mockups) {
        const { error: err } = await supabase.rpc("update_mockup_approval", {
          p_token: token!,
          p_mockup_id: m.mockup_id,
          p_status: "aprovado",
          p_feedback: feedbacks[currentPost.postIndex] || null,
        });
        if (err) throw err;
      }
      setMockups(prev => {
        const updated = prev.map(m =>
          currentPost.mockups.some(cm => cm.mockup_id === m.mockup_id)
            ? { ...m, status: "aprovado", feedback: feedbacks[currentPost.postIndex] || null }
            : m
        );
        setTimeout(() => {
          const nextPosts = groupByPost(updated);
          const nextUndecided = nextPosts.findIndex((p, i) => i > currentPostIdx && p.status === "pendente");
          if (nextUndecided !== -1) setCurrentPostIdx(nextUndecided);
          else {
            const first = nextPosts.findIndex(p => p.status === "pendente");
            if (first !== -1) setCurrentPostIdx(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Post aprovado!");
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPost = async () => {
    if (!currentPost) return;
    if (!feedbacks[currentPost.postIndex]?.trim()) {
      toast.error("Por favor, adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      for (const m of currentPost.mockups) {
        const { error: err } = await supabase.rpc("update_mockup_approval", {
          p_token: token!,
          p_mockup_id: m.mockup_id,
          p_status: "reprovado",
          p_feedback: feedbacks[currentPost.postIndex],
        });
        if (err) throw err;
      }
      setMockups(prev => {
        const updated = prev.map(m =>
          currentPost.mockups.some(cm => cm.mockup_id === m.mockup_id)
            ? { ...m, status: "reprovado", feedback: feedbacks[currentPost.postIndex] }
            : m
        );
        setTimeout(() => {
          const nextPosts = groupByPost(updated);
          const nextUndecided = nextPosts.findIndex((p, i) => i > currentPostIdx && p.status === "pendente");
          if (nextUndecided !== -1) setCurrentPostIdx(nextUndecided);
          else {
            const first = nextPosts.findIndex(p => p.status === "pendente");
            if (first !== -1) setCurrentPostIdx(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Post reprovado com feedback.");
    } catch {
      toast.error("Erro ao reprovar");
    } finally {
      setSubmitting(false);
    }
  };

  // === LINK-ONLY APPROVAL HANDLERS ===
  const handleApproveLinks = async () => {
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_task_approval_by_token", {
        p_token: token!,
        p_status: "aprovado",
        p_feedback: linkFeedback || null,
      });
      if (err) throw err;
      setLinkApprovalStatus("aprovado");
      toast.success("Aprovado com sucesso!");
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectLinks = async () => {
    if (!linkFeedback.trim()) {
      toast.error("Por favor, adicione um feedback antes de solicitar mudanças.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_task_approval_by_token", {
        p_token: token!,
        p_status: "reprovado",
        p_feedback: linkFeedback,
      });
      if (err) throw err;
      setLinkApprovalStatus("reprovado");
      toast.success("Mudança solicitada com sucesso.");
    } catch {
      toast.error("Erro ao solicitar mudança");
    } finally {
      setSubmitting(false);
    }
  };

  // === RENDER ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-10 text-center max-w-md space-y-3">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-foreground">Obrigado!</h2>
          <p className="text-sm text-muted-foreground">
            Suas respostas foram enviadas com sucesso. A equipe já foi notificada e dará continuidade ao processo.
          </p>
        </Card>
      </div>
    );
  }

  if (error || (!isLinkOnlyMode && posts.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Nenhum item pendente</h2>
          <p className="text-sm text-muted-foreground">
            {error || "Todos os itens já foram aprovados ou não há itens para revisar."}
          </p>
        </Card>
      </div>
    );
  }

  // Link-only approval mode
  if (isLinkOnlyMode) {
    return <LinkOnlyApproval
      taskInfo={taskInfo}
      taskLinks={taskLinks}
      linkFeedback={linkFeedback}
      setLinkFeedback={setLinkFeedback}
      linkApprovalStatus={linkApprovalStatus}
      submitting={submitting}
      submitted={submitted}
      onApprove={handleApproveLinks}
      onReject={handleRejectLinks}
      onSubmit={() => setSubmitted(true)}
    />;
  }

  // Mockup approval mode
  const tarefaTitulo = mockups[0]?.tarefa_titulo || "Tarefa";
  const clienteNome = mockups[0]?.cliente_nome || "perfil";
  const clienteEmpresa = mockups[0]?.cliente_empresa || "";

  const statusColor = (s: string) => {
    if (s === "aprovado") return "bg-emerald-500/20 text-emerald-400";
    if (s === "reprovado") return "bg-red-500/20 text-red-400";
    return "bg-amber-500/20 text-amber-400";
  };

  const statusLabel = (s: string) => {
    if (s === "aprovado") return "Aprovado";
    if (s === "reprovado") return "Reprovado";
    return "Pendente";
  };

  const allDecided = posts.every(p => p.status === "aprovado" || p.status === "reprovado");
  const isCarousel = currentPost && currentPost.mockups.length > 1;

  const previewSlides: MockupSlide[] = currentPost
    ? currentPost.mockups.map(m => ({
        ordem: m.ordem,
        subtitulo: m.subtitulo || "",
        titulo: m.titulo || "",
        legenda: m.legenda || "",
        cta: m.cta || "",
      }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{tarefaTitulo}</h1>
          <p className="text-sm text-muted-foreground">Aprovação de Posts • {clienteNome}</p>
        </div>

        {taskLinks.length > 0 && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Link2 className="h-4 w-4" />
              Links da Tarefa
            </div>
            <div className="space-y-1.5">
              {taskLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  {link.titulo || link.url}
                </a>
              ))}
            </div>
          </Card>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap">
          {posts.map((p, i) => (
            <button
              key={p.postIndex}
              onClick={() => setCurrentPostIdx(i)}
              className={cn(
                "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                i === currentPostIdx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                p.status === "aprovado" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                p.status === "reprovado" ? "bg-red-500/20 border-red-500 text-red-400" :
                "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentPost && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" disabled={currentPostIdx === 0} onClick={() => setCurrentPostIdx(i => i - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <div className="flex items-center gap-2">
                <Badge className={cn("border-0", statusColor(currentPost.status))}>
                  {statusLabel(currentPost.status)}
                </Badge>
                {isCarousel && (
                  <Badge variant="secondary" className="text-[10px]">
                    Carrossel ({currentPost.mockups.length} slides)
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" disabled={currentPostIdx === posts.length - 1} onClick={() => setCurrentPostIdx(i => i + 1)}>
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <MockupPreview slides={previewSlides} perfilNome={clienteNome} perfilCategoria={clienteEmpresa} />

            {!allDecided && (
              <Card className="p-4 space-y-3">
                <Textarea
                  placeholder="Feedback para este post (obrigatório para reprovar)..."
                  value={feedbacks[currentPost.postIndex] || ""}
                  onChange={e => setFeedbacks(prev => ({ ...prev, [currentPost.postIndex]: e.target.value }))}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button onClick={handleApprovePost} disabled={submitting || currentPost.status === "aprovado"} className="flex-1 gap-1.5" variant={currentPost.status === "aprovado" ? "secondary" : "default"}>
                    <Check className="w-4 h-4" />
                    {currentPost.status === "aprovado" ? "Aprovado" : "Aprovar"}
                  </Button>
                  <Button onClick={handleRejectPost} disabled={submitting || currentPost.status === "reprovado"} variant="destructive" className="flex-1 gap-1.5">
                    <X className="w-4 h-4" />
                    {currentPost.status === "reprovado" ? "Reprovado" : "Reprovar"}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {allDecided && (
          <Card className="p-5 space-y-4 text-center border-primary/30">
            <p className="text-sm font-medium text-foreground">Todos os posts foram revisados!</p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {posts.filter(p => p.status === "aprovado").length} aprovado(s) • {posts.filter(p => p.status === "reprovado").length} reprovado(s)
              </p>
              <Button onClick={() => setSubmitted(true)} className="gap-2" size="lg">
                <Send className="w-4 h-4" />
                Enviar respostas
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// === LINK-ONLY APPROVAL COMPONENT ===
function LinkOnlyApproval({
  taskInfo,
  taskLinks,
  linkFeedback,
  setLinkFeedback,
  linkApprovalStatus,
  submitting,
  submitted,
  onApprove,
  onReject,
  onSubmit,
}: {
  taskInfo: TaskInfo | null;
  taskLinks: TaskLink[];
  linkFeedback: string;
  setLinkFeedback: (v: string) => void;
  linkApprovalStatus: string;
  submitting: boolean;
  submitted: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSubmit: () => void;
}) {
  const tarefaTitulo = taskInfo?.tarefa_titulo || "Tarefa";
  const clienteNome = taskInfo?.cliente_nome || "";
  const decided = linkApprovalStatus === "aprovado" || linkApprovalStatus === "reprovado";

  const statusColor = (s: string) => {
    if (s === "aprovado") return "bg-emerald-500/20 text-emerald-400";
    if (s === "reprovado") return "bg-red-500/20 text-red-400";
    return "bg-amber-500/20 text-amber-400";
  };
  const statusLabel = (s: string) => {
    if (s === "aprovado") return "Aprovado";
    if (s === "reprovado") return "Mudança solicitada";
    return "Pendente";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{tarefaTitulo}</h1>
          <p className="text-sm text-muted-foreground">
            Aprovação de Entrega{clienteNome ? ` • ${clienteNome}` : ""}
          </p>
        </div>


        {/* Embedded link previews */}
        <div className="space-y-8">
          {taskLinks.map((link, i) => {
            const href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
            return (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline truncate"
                    >
                      {link.titulo || link.url}
                    </a>
                  </div>
                  <Badge className={cn("border-0 flex-shrink-0", statusColor(linkApprovalStatus))}>
                    {statusLabel(linkApprovalStatus)}
                  </Badge>
                </div>
                <DeviceFrame>
                  <iframe
                    src={href}
                    className="w-full h-full border-0 block touch-pan-y"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    title={link.titulo || `Link ${i + 1}`}
                  />
                </DeviceFrame>
              </div>
            );
          })}
        </div>

        {/* Feedback + actions */}
        {!decided && (
          <Card className="p-4 space-y-3 max-w-xl mx-auto">
            <Textarea
              placeholder="Feedback ou observações (obrigatório para solicitar mudanças)..."
              value={linkFeedback}
              onChange={e => setLinkFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={onApprove}
                disabled={submitting}
                className="flex-1 gap-1.5"
              >
                <Check className="w-4 h-4" />
                Aprovar
              </Button>
              <Button
                onClick={onReject}
                disabled={submitting}
                variant="destructive"
                className="flex-1 gap-1.5"
              >
                <X className="w-4 h-4" />
                Solicitar Mudança
              </Button>
            </div>
          </Card>
        )}

        {decided && (
          <Card className="p-5 space-y-4 text-center border-primary/30">
            <p className="text-sm font-medium text-foreground">
              {linkApprovalStatus === "aprovado"
                ? "Entrega aprovada!"
                : "Mudança solicitada com sucesso."}
            </p>
            <Button onClick={onSubmit} className="gap-2" size="lg">
              <Send className="w-4 h-4" />
              Concluir
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
