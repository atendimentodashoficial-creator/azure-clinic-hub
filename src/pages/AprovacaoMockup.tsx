import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview, MockupSlide } from "@/components/tarefas/MockupPreview";
import { InstagramGridPreview } from "@/components/tarefas/InstagramGridPreview";
import { IPhoneFrame } from "@/components/ui/device-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DeviceFrame, DeviceFrameWithFallback } from "@/components/ui/device-frame";
import { Check, X, ChevronLeft, ChevronRight, Send, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// Scales the IPhoneFrame proportionally to match the right panel height on desktop
function GridMockupScaler({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [wrapperH, setWrapperH] = useState<string>('auto');

  const recalc = useCallback(() => {
    if (isMobile || !containerRef.current || !innerRef.current) return;
    const parent = containerRef.current.closest('[data-grid-layout]');
    if (!parent) return;
    const rightPanel = parent.querySelector('[data-grid-right]') as HTMLElement;
    if (!rightPanel) return;

    // Temporarily reset to measure natural height
    innerRef.current.style.transform = 'scale(1)';
    const naturalH = innerRef.current.offsetHeight;
    const rightH = rightPanel.offsetHeight;

    if (naturalH > 0 && rightH > 0) {
      const s = Math.max(1, Math.min(rightH / naturalH, 1.5));
      setScale(s);
      setWrapperH(`${naturalH * s}px`);
      innerRef.current.style.transform = `scale(${s})`;
    } else {
      innerRef.current.style.transform = 'scale(1)';
    }
  }, [isMobile]);

  useEffect(() => {
    const t = setTimeout(recalc, 300);
    return () => clearTimeout(t);
  }, [recalc]);

  useEffect(() => {
    const interval = setInterval(recalc, 1000);
    return () => clearInterval(interval);
  }, [recalc]);

  if (isMobile) return <>{children}</>;

  return (
    <div ref={containerRef} style={{ height: wrapperH }}>
      <div
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

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

interface GridPostData {
  grid_post_id: string;
  tarefa_id: string;
  posicao: number;
  image_url: string;
  status: string;
  feedback: string | null;
  tarefa_titulo: string;
  cliente_nome: string;
  cliente_empresa: string;
}

interface HighlightData {
  highlight_id: string;
  tarefa_id: string;
  ordem: number;
  titulo: string;
  image_url: string;
  status: string;
  feedback: string | null;
  tarefa_titulo: string;
  cliente_nome: string;
  cliente_empresa: string;
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
  const [gridPosts, setGridPosts] = useState<GridPostData[]>([]);
  const [gridHighlights, setGridHighlights] = useState<HighlightData[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPostIdx, setCurrentPostIdx] = useState(0);
  const [currentGridIdx, setCurrentGridIdx] = useState(0);
  const [currentHighlightIdx, setCurrentHighlightIdx] = useState(0);
  const [gridApprovalTab, setGridApprovalTab] = useState<"posts" | "highlights">("posts");
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [gridFeedbacks, setGridFeedbacks] = useState<Record<string, string>>({});
  const [highlightFeedbacks, setHighlightFeedbacks] = useState<Record<string, string>>({});
  const [linkFeedback, setLinkFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkApprovalStatus, setLinkApprovalStatus] = useState<string>("pendente");

  const isLinkOnlyMode = mockups.length === 0 && gridPosts.length === 0 && taskLinks.length > 0;
  const isGridMode = gridPosts.length > 0;

  useEffect(() => {
    if (!token) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mockupRes, linksRes, taskRes, gridRes, highlightsRes] = await Promise.all([
        supabase.rpc("get_mockups_by_approval_token", { p_token: token! }),
        supabase.rpc("get_links_by_approval_token", { p_token: token! }),
        supabase.rpc("get_task_by_approval_token", { p_token: token! }),
        supabase.rpc("get_grid_posts_by_approval_token", { p_token: token! }),
        supabase.rpc("get_grid_highlights_by_approval_token", { p_token: token! }),
      ]);

      if (mockupRes.error) throw mockupRes.error;
      const raw = (mockupRes.data || []) as MockupData[];
      const withPostIndex = raw.map(m => ({ ...m, post_index: (m as any).post_index ?? 0 }));
      setMockups(withPostIndex);
      setTaskLinks((linksRes.data || []) as TaskLink[]);
      setGridPosts((gridRes.data || []) as GridPostData[]);
      setGridHighlights((highlightsRes.data || []) as HighlightData[]);

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

  // === GRID APPROVAL HANDLERS ===
  const sortedGridPosts = [...gridPosts].sort((a, b) => a.posicao - b.posicao);
  const currentGridPost = sortedGridPosts[currentGridIdx];

  const handleApproveGridPost = async () => {
    if (!currentGridPost) return;
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_grid_post_approval", {
        p_token: token!,
        p_grid_post_id: currentGridPost.grid_post_id,
        p_status: "aprovado",
        p_feedback: gridFeedbacks[currentGridPost.grid_post_id] || null,
      });
      if (err) throw err;
      setGridPosts(prev => {
        const updated = prev.map(g => g.grid_post_id === currentGridPost.grid_post_id ? { ...g, status: "aprovado", feedback: gridFeedbacks[currentGridPost.grid_post_id] || null } : g);
        setTimeout(() => {
          const sorted = [...updated].sort((a, b) => a.posicao - b.posicao);
          const nextUndecided = sorted.findIndex((g, i) => i > currentGridIdx && g.status === "pendente");
          if (nextUndecided !== -1) setCurrentGridIdx(nextUndecided);
          else {
            const first = sorted.findIndex(g => g.status === "pendente");
            if (first !== -1) setCurrentGridIdx(first);
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

  const handleRejectGridPost = async () => {
    if (!currentGridPost) return;
    const feedback = gridFeedbacks[currentGridPost.grid_post_id] || "";
    if (!feedback.trim()) {
      toast.error("Adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_grid_post_approval", {
        p_token: token!,
        p_grid_post_id: currentGridPost.grid_post_id,
        p_status: "reprovado",
        p_feedback: feedback,
      });
      if (err) throw err;
      setGridPosts(prev => {
        const updated = prev.map(g => g.grid_post_id === currentGridPost.grid_post_id ? { ...g, status: "reprovado", feedback } : g);
        setTimeout(() => {
          const sorted = [...updated].sort((a, b) => a.posicao - b.posicao);
          const nextUndecided = sorted.findIndex((g, i) => i > currentGridIdx && g.status === "pendente");
          if (nextUndecided !== -1) setCurrentGridIdx(nextUndecided);
          else {
            const first = sorted.findIndex(g => g.status === "pendente");
            if (first !== -1) setCurrentGridIdx(first);
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
  // === HIGHLIGHT APPROVAL HANDLERS ===
  const sortedHighlights = [...gridHighlights].sort((a, b) => a.ordem - b.ordem);
  const currentHighlight = sortedHighlights[currentHighlightIdx];

  const handleApproveHighlight = async () => {
    if (!currentHighlight) return;
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_grid_highlight_approval", {
        p_token: token!,
        p_highlight_id: currentHighlight.highlight_id,
        p_status: "aprovado",
        p_feedback: highlightFeedbacks[currentHighlight.highlight_id] || null,
      });
      if (err) throw err;
      setGridHighlights(prev => {
        const updated = prev.map(h => h.highlight_id === currentHighlight.highlight_id ? { ...h, status: "aprovado", feedback: highlightFeedbacks[currentHighlight.highlight_id] || null } : h);
        setTimeout(() => {
          const sorted = [...updated].sort((a, b) => a.ordem - b.ordem);
          const next = sorted.findIndex((h, i) => i > currentHighlightIdx && h.status === "pendente");
          if (next !== -1) setCurrentHighlightIdx(next);
          else {
            const first = sorted.findIndex(h => h.status === "pendente");
            if (first !== -1) setCurrentHighlightIdx(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Destaque aprovado!");
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectHighlight = async () => {
    if (!currentHighlight) return;
    const feedback = highlightFeedbacks[currentHighlight.highlight_id] || "";
    if (!feedback.trim()) {
      toast.error("Adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_grid_highlight_approval", {
        p_token: token!,
        p_highlight_id: currentHighlight.highlight_id,
        p_status: "reprovado",
        p_feedback: feedback,
      });
      if (err) throw err;
      setGridHighlights(prev => {
        const updated = prev.map(h => h.highlight_id === currentHighlight.highlight_id ? { ...h, status: "reprovado", feedback } : h);
        setTimeout(() => {
          const sorted = [...updated].sort((a, b) => a.ordem - b.ordem);
          const next = sorted.findIndex((h, i) => i > currentHighlightIdx && h.status === "pendente");
          if (next !== -1) setCurrentHighlightIdx(next);
          else {
            const first = sorted.findIndex(h => h.status === "pendente");
            if (first !== -1) setCurrentHighlightIdx(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Destaque reprovado com feedback.");
    } catch {
      toast.error("Erro ao reprovar");
    } finally {
      setSubmitting(false);
    }
  };

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

  if (error || (!isLinkOnlyMode && !isGridMode && posts.length === 0)) {
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

  // Grid approval mode
  if (isGridMode) {
    const gridTitulo = gridPosts[0]?.tarefa_titulo || taskInfo?.tarefa_titulo || "Tarefa";
    const gridCliente = gridPosts[0]?.cliente_nome || taskInfo?.cliente_nome || "perfil";
    const gridEmpresa = gridPosts[0]?.cliente_empresa || taskInfo?.cliente_empresa || "";
    const allGridPostsDecided = gridPosts.every(g => g.status === "aprovado" || g.status === "reprovado");
    const allHighlightsDecided = gridHighlights.length === 0 || gridHighlights.every(h => h.status === "aprovado" || h.status === "reprovado");
    const allGridDecided = allGridPostsDecided && allHighlightsDecided;
    const hasHighlights = gridHighlights.length > 0;

    const itemStatusColor = (s: string) => {
      if (s === "aprovado") return "bg-emerald-500/20 text-emerald-400";
      if (s === "reprovado") return "bg-red-500/20 text-red-400";
      return "bg-amber-500/20 text-amber-400";
    };
    const itemStatusLabel = (s: string) => {
      if (s === "aprovado") return "Aprovado";
      if (s === "reprovado") return "Reprovado";
      return "Pendente";
    };

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">{gridTitulo}</h1>
            <p className="text-sm text-muted-foreground">Aprovação de Grade do Instagram • {gridCliente}</p>
          </div>

          <div data-grid-layout className="flex flex-col lg:flex-row lg:items-start lg:justify-center lg:gap-32">
            {/* Left: Instagram grid mockup — visual reference, scales to match right panel */}
            <div className="order-2 lg:order-1 lg:sticky lg:top-8 w-full max-w-[400px] mx-auto lg:mx-0 flex-shrink-0">
              <GridMockupScaler>
                <IPhoneFrame>
                  <InstagramGridPreview
                    posts={gridPosts.map(g => ({
                      id: g.grid_post_id,
                      posicao: g.posicao,
                      image_url: g.image_url,
                      status: g.status,
                      feedback: g.feedback,
                    }))}
                    highlights={gridHighlights.map(h => ({
                      id: h.highlight_id,
                      ordem: h.ordem,
                      titulo: h.titulo,
                      image_url: h.image_url,
                      status: h.status,
                      feedback: h.feedback,
                    }))}
                    perfilNome={gridCliente}
                    perfilCategoria={gridEmpresa}
                    approvalMode={false}
                  />
                </IPhoneFrame>
              </GridMockupScaler>
            </div>

            {/* Right: Approval controls */}
            <div data-grid-right className="order-1 lg:order-2 flex-1 min-w-0 max-w-xl mx-auto lg:mx-0 space-y-6">
              {/* Tab switch: Posts / Destaques */}
              {hasHighlights && (
                <div className="flex gap-2 justify-center">
                  <Button
                    variant={gridApprovalTab === "posts" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGridApprovalTab("posts")}
                    className="gap-1.5"
                  >
                    Posts ({gridPosts.length})
                    {allGridPostsDecided && <Check className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant={gridApprovalTab === "highlights" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGridApprovalTab("highlights")}
                    className="gap-1.5"
                  >
                    Destaques ({gridHighlights.length})
                    {allHighlightsDecided && <Check className="w-3 h-3" />}
                  </Button>
                </div>
              )}

              {/* Posts approval */}
              {gridApprovalTab === "posts" && (
                <>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {sortedGridPosts.map((g, i) => (
                      <button
                        key={g.grid_post_id}
                        onClick={() => setCurrentGridIdx(i)}
                        className={cn(
                          "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                          i === currentGridIdx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                          g.status === "aprovado" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                          g.status === "reprovado" ? "bg-red-500/20 border-red-500 text-red-400" :
                          "bg-muted border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {currentGridPost && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" disabled={currentGridIdx === 0} onClick={() => setCurrentGridIdx(i => i - 1)}>
                          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                        </Button>
                        <Badge className={cn("border-0", itemStatusColor(currentGridPost.status))}>
                          {itemStatusLabel(currentGridPost.status)}
                        </Badge>
                        <Button variant="ghost" size="sm" disabled={currentGridIdx === sortedGridPosts.length - 1} onClick={() => setCurrentGridIdx(i => i + 1)}>
                          Próximo <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>

                      <div className="w-full max-w-md mx-auto aspect-[4/5] rounded-lg border border-border overflow-hidden">
                        <img
                          src={currentGridPost.image_url}
                          alt={`Post ${currentGridPost.posicao + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <Card className="p-4 space-y-3">
                          <Textarea
                            placeholder="Feedback para este post (obrigatório para reprovar)..."
                            value={gridFeedbacks[currentGridPost.grid_post_id] || ""}
                            onChange={e => setGridFeedbacks(prev => ({ ...prev, [currentGridPost.grid_post_id]: e.target.value }))}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button onClick={handleApproveGridPost} disabled={submitting} className="flex-1 gap-1.5" variant={currentGridPost.status === "aprovado" ? "secondary" : "default"}>
                              <Check className="w-4 h-4" />
                              {currentGridPost.status === "aprovado" ? "Aprovado" : "Aprovar"}
                            </Button>
                            <Button onClick={handleRejectGridPost} disabled={submitting} variant="destructive" className="flex-1 gap-1.5">
                              <X className="w-4 h-4" />
                              {currentGridPost.status === "reprovado" ? "Reprovado" : "Reprovar"}
                            </Button>
                          </div>
                        </Card>

                      {currentGridPost.status === "reprovado" && currentGridPost.feedback && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">
                          💬 {currentGridPost.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Highlights approval */}
              {gridApprovalTab === "highlights" && (
                <>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {sortedHighlights.map((h, i) => (
                      <button
                        key={h.highlight_id}
                        onClick={() => setCurrentHighlightIdx(i)}
                        className={cn(
                          "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                          i === currentHighlightIdx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                          h.status === "aprovado" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                          h.status === "reprovado" ? "bg-red-500/20 border-red-500 text-red-400" :
                          "bg-muted border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {currentHighlight && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" disabled={currentHighlightIdx === 0} onClick={() => setCurrentHighlightIdx(i => i - 1)}>
                          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                        </Button>
                        <Badge className={cn("border-0", itemStatusColor(currentHighlight.status))}>
                          {itemStatusLabel(currentHighlight.status)}
                        </Badge>
                        <Button variant="ghost" size="sm" disabled={currentHighlightIdx === sortedHighlights.length - 1} onClick={() => setCurrentHighlightIdx(i => i + 1)}>
                          Próximo <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>

                      <div className="w-full max-w-md mx-auto">
                        <div className="w-full aspect-[4/5] rounded-lg border border-border bg-muted/20 flex items-center justify-center">
                          <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                            <img
                              src={currentHighlight.image_url}
                              alt={currentHighlight.titulo}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>

                      <Card className="p-4 space-y-3">
                        <Textarea
                          placeholder="Feedback para este destaque (obrigatório para reprovar)..."
                          value={highlightFeedbacks[currentHighlight.highlight_id] || ""}
                          onChange={e => setHighlightFeedbacks(prev => ({ ...prev, [currentHighlight.highlight_id]: e.target.value }))}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleApproveHighlight} disabled={submitting} className="flex-1 gap-1.5" variant={currentHighlight.status === "aprovado" ? "secondary" : "default"}>
                            <Check className="w-4 h-4" />
                            {currentHighlight.status === "aprovado" ? "Aprovado" : "Aprovar"}
                          </Button>
                          <Button onClick={handleRejectHighlight} disabled={submitting} variant="destructive" className="flex-1 gap-1.5">
                            <X className="w-4 h-4" />
                            {currentHighlight.status === "reprovado" ? "Reprovado" : "Reprovar"}
                          </Button>
                        </div>
                      </Card>

                      {currentHighlight.status === "reprovado" && currentHighlight.feedback && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">
                          💬 {currentHighlight.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {allGridDecided && (
                <Card className="p-5 space-y-4 text-center border-primary/30">
                  <p className="text-sm font-medium text-foreground">Todos os itens foram revisados!</p>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {gridPosts.filter(g => g.status === "aprovado").length + gridHighlights.filter(h => h.status === "aprovado").length} aprovado(s) • {gridPosts.filter(g => g.status === "reprovado").length + gridHighlights.filter(h => h.status === "reprovado").length} reprovado(s)
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
        </div>
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

              <Card className="p-4 space-y-3">
                <Textarea
                  placeholder="Feedback para este post (obrigatório para reprovar)..."
                  value={feedbacks[currentPost.postIndex] || ""}
                  onChange={e => setFeedbacks(prev => ({ ...prev, [currentPost.postIndex]: e.target.value }))}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button onClick={handleApprovePost} disabled={submitting} className="flex-1 gap-1.5" variant={currentPost.status === "aprovado" ? "secondary" : "default"}>
                    <Check className="w-4 h-4" />
                    {currentPost.status === "aprovado" ? "Aprovado" : "Aprovar"}
                  </Button>
                  <Button onClick={handleRejectPost} disabled={submitting} variant="destructive" className="flex-1 gap-1.5">
                    <X className="w-4 h-4" />
                    {currentPost.status === "reprovado" ? "Reprovado" : "Reprovar"}
                  </Button>
                </div>
              </Card>
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
                <DeviceFrameWithFallback href={href} title={link.titulo || link.url} />
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
