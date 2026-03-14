import { useState, useEffect, useRef, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview, MockupSlide } from "@/components/tarefas/MockupPreview";
import { InstagramGridPreview } from "@/components/tarefas/InstagramGridPreview";
import { IPhoneFrame } from "@/components/ui/device-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DeviceFrameWithFallback } from "@/components/ui/device-frame";
import { Check, X, ChevronLeft, ChevronRight, Send, ExternalLink, Link2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

function extractInstagramUsername(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.replace(/\/+$/, "").trim();
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || trimmed;
  } catch {
    return trimmed.replace(/^@/, "");
  }
}

// Fire-and-forget notification
async function notifyTaskEvent(tarefaId: string, evento: string, feedback?: string) {
  try {
    const { data: tarefa } = await supabase.from("tarefas").select("user_id").eq("id", tarefaId).maybeSingle();
    if (!tarefa?.user_id) return;
    await supabase.functions.invoke("enviar-aviso-tarefa", {
      body: { evento, tarefa_id: tarefaId, user_id: tarefa.user_id, feedback },
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
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
  cliente_instagram: string;
  cliente_foto_perfil_url: string | null;
  aprovacao_interna_status: string;
}

interface PostForApproval {
  postIndex: number;
  mockups: MockupData[];
}

function GradeScaledMockup({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalH, setNaturalH] = useState(0);

  useEffect(() => {
    const sync = () => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;
      inner.style.transform = 'scale(1)';
      requestAnimationFrame(() => {
        const nW = inner.offsetWidth;
        const nH = inner.offsetHeight;
        const cW = container.clientWidth;
        if (nW <= 0) return;
        const s = cW / nW;
        setScale(s);
        setNaturalH(nH);
        inner.style.transform = `scale(${s})`;
        inner.style.transformOrigin = 'top left';
      });
    };
    const timer = setTimeout(sync, 100);
    const ro = new ResizeObserver(() => sync());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, []);

  return (
    <div ref={containerRef} className="w-full" style={{ height: naturalH > 0 ? naturalH * scale : 'auto' }}>
      <div ref={innerRef} style={{ width: 380, display: 'inline-block' }}>
        {children}
      </div>
    </div>
  );
}

export default function AprovacaoInterna() {
  const { token } = useParams<{ token: string }>();
  const isMobile = useIsMobile();
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
  const [activeTab, setActiveTab] = useState<"posts" | "highlights" | "grade" | "links">("posts");
  const [feedback, setFeedback] = useState("");
  const [gestor, setGestor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mockupRes, linksRes, taskRes, gridRes, highlightsRes] = await Promise.all([
        supabase.rpc("get_mockups_by_internal_token", { p_token: token! }),
        supabase.rpc("get_links_by_internal_token", { p_token: token! }),
        supabase.rpc("get_task_by_internal_approval_token", { p_token: token! }),
        supabase.rpc("get_grid_posts_by_internal_token", { p_token: token! }),
        supabase.rpc("get_grid_highlights_by_internal_token", { p_token: token! }),
      ]);

      if (taskRes.error) throw taskRes.error;
      const taskData = (taskRes.data || []) as TaskInfo[];
      if (taskData.length === 0) throw new Error("Token inválido ou expirado.");
      setTaskInfo(taskData[0]);

      const raw = (mockupRes.data || []) as MockupData[];
      setMockups(raw.map(m => ({ ...m, post_index: (m as any).post_index ?? 0 })));
      setTaskLinks((linksRes.data || []) as TaskLink[]);
      setGridPosts((gridRes.data || []) as GridPostData[]);
      setGridHighlights((highlightsRes.data || []) as HighlightData[]);

      // Auto-select first available tab
      if (gridRes.data && gridRes.data.length > 0) {
        setActiveTab("posts");
      } else if (raw.length > 0) {
        setActiveTab("posts");
      } else if (linksRes.data && linksRes.data.length > 0) {
        setActiveTab("links");
      }
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
      }));
  };

  const handleApproval = async (status: "aprovado" | "reprovado") => {
    if (status === "reprovado" && !feedback.trim()) {
      toast.error("Por favor, adicione um feedback antes de reprovar.");
      return;
    }
    if (!gestor.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("handle_internal_approval", {
        p_token: token!,
        p_status: status,
        p_gestor_nome: gestor.trim(),
        p_feedback: feedback.trim() || null,
      });
      if (err) throw err;

      // Notify
      if (taskInfo) {
        const evento = status === "aprovado" ? "aprovacao_cliente" : "reprovada_cliente";
        notifyTaskEvent(taskInfo.tarefa_id, evento, status === "reprovado" ? feedback : undefined);
      }

      setSubmitted(true);
      toast.success(status === "aprovado" ? "Tarefa aprovada internamente!" : "Tarefa reprovada com feedback.");
    } catch {
      toast.error("Erro ao processar aprovação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !taskInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Link inválido</h2>
          <p className="text-sm text-muted-foreground">{error || "Não foi possível carregar os dados."}</p>
        </Card>
      </div>
    );
  }

  if (submitted || taskInfo.aprovacao_interna_status === "aprovado" || taskInfo.aprovacao_interna_status === "reprovado") {
    const isApproved = submitted ? submitting === false : taskInfo.aprovacao_interna_status === "aprovado";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-10 text-center max-w-md space-y-3">
          <div className="text-4xl">{taskInfo.aprovacao_interna_status === "aprovado" || submitted ? "✅" : "📝"}</div>
          <h2 className="text-xl font-bold text-foreground">
            {taskInfo.aprovacao_interna_status === "aprovado" ? "Aprovação concluída" : taskInfo.aprovacao_interna_status === "reprovado" ? "Tarefa devolvida para revisão" : "Resposta enviada!"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {taskInfo.aprovacao_interna_status === "aprovado"
              ? "A tarefa foi aprovada internamente e seguirá para o próximo passo."
              : taskInfo.aprovacao_interna_status === "reprovado"
              ? "A tarefa foi devolvida para revisão com o feedback informado."
              : "Sua resposta foi registrada com sucesso."}
          </p>
        </Card>
      </div>
    );
  }

  const posts = groupByPost(mockups);
  const isGridMode = gridPosts.length > 0;
  const isLinkOnlyMode = mockups.length === 0 && gridPosts.length === 0 && taskLinks.length > 0;
  const hasMockups = mockups.length > 0;
  const hasLinks = taskLinks.length > 0;
  const hasHighlights = gridHighlights.length > 0;

  const tarefaTitulo = taskInfo.tarefa_titulo;
  const clienteNome = extractInstagramUsername(taskInfo.cliente_instagram) || taskInfo.cliente_nome || "";
  const clienteEmpresa = taskInfo.cliente_empresa || "";

  const sortedGridPosts = [...gridPosts].sort((a, b) => a.posicao - b.posicao);
  const sortedHighlights = [...gridHighlights].sort((a, b) => a.ordem - b.ordem);
  const currentPost = posts[Math.min(currentPostIdx, Math.max(0, posts.length - 1))];
  const currentGridPost = sortedGridPosts[Math.min(currentGridIdx, Math.max(0, sortedGridPosts.length - 1))];
  const currentHighlight = sortedHighlights[Math.min(currentHighlightIdx, Math.max(0, sortedHighlights.length - 1))];

  const previewSlides: MockupSlide[] = currentPost
    ? currentPost.mockups.map(m => ({
        ordem: m.ordem,
        subtitulo: m.subtitulo || "",
        titulo: m.titulo || "",
        legenda: m.legenda || "",
        cta: m.cta || "",
      }))
    : [];

  // Build available tabs
  const tabs: { key: string; label: string; count: number }[] = [];
  if (isGridMode) {
    tabs.push({ key: "posts", label: "Posts", count: gridPosts.length });
    if (hasHighlights) tabs.push({ key: "highlights", label: "Destaques", count: gridHighlights.length });
    tabs.push({ key: "grade", label: "Grade", count: 0 });
  }
  if (hasMockups) tabs.push({ key: "posts", label: "Posts", count: posts.length });
  if (hasLinks) tabs.push({ key: "links", label: "Links", count: taskLinks.length });

  // Dedupe tabs
  const uniqueTabs = tabs.filter((t, i) => tabs.findIndex(tt => tt.key === t.key) === i);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">
              Aprovação Interna
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-foreground">{tarefaTitulo}</h1>
          <p className="text-sm text-muted-foreground">
            Revise os itens abaixo e aprove ou reprove a tarefa
            {clienteNome ? ` • ${clienteNome}` : ""}
          </p>
        </div>

        {/* Tab navigation */}
        {uniqueTabs.length > 1 && (
          <div className="flex gap-2 justify-center">
            {uniqueTabs.map(tab => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveTab(tab.key as any); setCurrentPostIdx(0); setCurrentGridIdx(0); setCurrentHighlightIdx(0); }}
                className="gap-1.5"
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </Button>
            ))}
          </div>
        )}

        {/* Grid posts tab */}
        {activeTab === "posts" && isGridMode && (
          <>
            {sortedGridPosts.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum post encontrado.</p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {sortedGridPosts.map((g, i) => (
                    <button
                      key={g.grid_post_id}
                      onClick={() => setCurrentGridIdx(i)}
                      className={cn(
                        "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                        i === Math.min(currentGridIdx, sortedGridPosts.length - 1) ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                        "bg-muted border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {g.posicao + 1}
                    </button>
                  ))}
                </div>

                {currentGridPost && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" disabled={currentGridIdx === 0} onClick={() => setCurrentGridIdx(i => Math.max(0, i - 1))}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">Post {currentGridPost.posicao + 1} de {sortedGridPosts.length}</span>
                      <Button variant="ghost" size="sm" disabled={currentGridIdx >= sortedGridPosts.length - 1} onClick={() => setCurrentGridIdx(i => i + 1)}>
                        Próximo <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="w-full aspect-[4/5] rounded-lg border border-border overflow-hidden">
                      <img src={currentGridPost.image_url} alt={`Post ${currentGridPost.posicao + 1}`} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Highlights tab */}
        {activeTab === "highlights" && (
          <>
            {sortedHighlights.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum destaque encontrado.</p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {sortedHighlights.map((h, i) => (
                    <button
                      key={h.highlight_id}
                      onClick={() => setCurrentHighlightIdx(i)}
                      className={cn(
                        "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                        i === Math.min(currentHighlightIdx, sortedHighlights.length - 1) ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
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
                      <Button variant="ghost" size="sm" disabled={currentHighlightIdx === 0} onClick={() => setCurrentHighlightIdx(i => Math.max(0, i - 1))}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">{currentHighlight.titulo}</span>
                      <Button variant="ghost" size="sm" disabled={currentHighlightIdx >= sortedHighlights.length - 1} onClick={() => setCurrentHighlightIdx(i => i + 1)}>
                        Próximo <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="w-full aspect-[4/5] rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                      <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                        <img src={currentHighlight.image_url} alt={currentHighlight.titulo} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Grade tab */}
        {activeTab === "grade" && isGridMode && (
          <GradeScaledMockup>
            <IPhoneFrame noScroll>
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
                perfilNome={clienteNome}
                perfilCategoria={clienteEmpresa}
                perfilFotoUrl={taskInfo.cliente_foto_perfil_url}
                approvalMode={false}
              />
            </IPhoneFrame>
          </GradeScaledMockup>
        )}

        {/* Mockup posts tab (non-grid) */}
        {activeTab === "posts" && !isGridMode && hasMockups && (
          <>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {posts.map((p, i) => (
                <button
                  key={p.postIndex}
                  onClick={() => setCurrentPostIdx(i)}
                  className={cn(
                    "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                    i === Math.min(currentPostIdx, posts.length - 1) ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {p.postIndex + 1}
                </button>
              ))}
            </div>

            {currentPost && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" disabled={currentPostIdx === 0} onClick={() => setCurrentPostIdx(i => Math.max(0, i - 1))}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">Post {currentPost.postIndex + 1} de {posts.length}</span>
                  <Button variant="ghost" size="sm" disabled={currentPostIdx >= posts.length - 1} onClick={() => setCurrentPostIdx(i => i + 1)}>
                    Próximo <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <MockupPreview
                  slides={previewSlides}
                  perfilNome={clienteNome}
                  perfilCategoria={clienteEmpresa}
                  perfilFotoUrl={taskInfo.cliente_foto_perfil_url}
                  className="max-w-none"
                />
              </div>
            )}
          </>
        )}

        {/* Links tab */}
        {activeTab === "links" && hasLinks && (
          <div className="space-y-4">
            {taskLinks.map((link, i) => {
              const href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
              return (
                <Card key={i} className="p-4 space-y-3">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    {link.titulo || link.url}
                  </a>
                  <GradeScaledMockup>
                    <IPhoneFrame noScroll={false}>
                      <iframe
                        src={href}
                        title={link.titulo || link.url}
                        className="w-full h-[600px] border-0"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </IPhoneFrame>
                  </GradeScaledMockup>
                </Card>
              );
            })}
          </div>
        )}

        {/* Link-only mode (no tabs) */}
        {isLinkOnlyMode && activeTab !== "links" && (
          <div className="space-y-4">
            {taskLinks.map((link, i) => {
              const href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
              return (
                <Card key={i} className="p-4">
                  <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {link.titulo || link.url}
                  </a>
                </Card>
              );
            })}
          </div>
        )}

        {/* Approval section */}
        <Card className="p-5 space-y-4 border-primary/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Decisão da Aprovação Interna</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Seu nome *</label>
            <input
              type="text"
              value={gestor}
              onChange={e => setGestor(e.target.value)}
              placeholder="Nome do gestor..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <Textarea
            placeholder="Feedback (obrigatório para reprovar)..."
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={3}
          />

          <div className="flex gap-2">
            <Button
              onClick={() => handleApproval("aprovado")}
              disabled={submitting}
              className="flex-1 gap-1.5"
            >
              <Check className="w-4 h-4" />
              {submitting ? "Processando..." : "Aprovar"}
            </Button>
            <Button
              onClick={() => handleApproval("reprovado")}
              disabled={submitting}
              variant="destructive"
              className="flex-1 gap-1.5"
            >
              <X className="w-4 h-4" />
              Reprovar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
