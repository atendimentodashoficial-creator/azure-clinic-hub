import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview } from "@/components/tarefas/MockupPreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, ChevronLeft, ChevronRight, FileImage, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TarefaAprovacao {
  id: string;
  titulo: string;
  approval_token: string;
  mockups: {
    id: string;
    ordem: number;
    post_index: number;
    subtitulo: string | null;
    titulo: string | null;
    legenda: string | null;
    cta: string | null;
    status: string;
    feedback: string | null;
  }[];
  cliente_nome: string;
  cliente_empresa: string | null;
}

interface PostForApproval {
  postIndex: number;
  mockups: TarefaAprovacao["mockups"];
  status: string;
}

function derivePostStatus(mockups: TarefaAprovacao["mockups"]): string {
  const statuses = new Set(mockups.map(m => m.status));
  if (statuses.size === 1) return mockups[0].status;
  return "pendente";
}

function groupByPost(mockups: TarefaAprovacao["mockups"]): PostForApproval[] {
  const map = new Map<number, TarefaAprovacao["mockups"]>();
  mockups.forEach(m => {
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
}

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

export default function ClienteAprovacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedTarefa, setSelectedTarefa] = useState<string | null>(null);
  const [currentPostIdx, setCurrentPostIdx] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["cliente-aprovacoes", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("id, nome, empresa")
        .eq("email", user.email)
        .limit(1)
        .single();

      if (!clienteData) return [];

      const { data: tarefasData, error } = await supabase
        .from("tarefas")
        .select("id, titulo, approval_token")
        .eq("cliente_id", clienteData.id)
        .not("approval_token", "is", null);

      if (error || !tarefasData?.length) return [];

      const result: TarefaAprovacao[] = [];
      for (const t of tarefasData) {
        const { data: mockupsData } = await supabase
          .from("tarefa_mockups")
          .select("id, ordem, post_index, subtitulo, titulo, legenda, cta, status, feedback")
          .eq("tarefa_id", t.id)
          .order("post_index")
          .order("ordem");

        if (mockupsData?.length) {
          result.push({
            ...t,
            approval_token: t.approval_token!,
            mockups: mockupsData,
            cliente_nome: clienteData.nome,
            cliente_empresa: clienteData.empresa,
          });
        }
      }
      return result;
    },
    enabled: !!user?.email,
  });

  const activeTarefa = tarefas.find(t => t.id === selectedTarefa);
  const posts = activeTarefa ? groupByPost(activeTarefa.mockups) : [];
  const clampedPostIdx = Math.min(currentPostIdx, Math.max(0, posts.length - 1));
  const currentPost = posts[clampedPostIdx];

  const allDecided = posts.length > 0 && posts.every(p => p.status !== "pendente");

  const handleApprovePost = async () => {
    if (!currentPost || !activeTarefa) return;
    setSubmitting(true);
    try {
      for (const m of currentPost.mockups) {
        const { error } = await supabase.rpc("update_mockup_approval", {
          p_token: activeTarefa.approval_token,
          p_mockup_id: m.id,
          p_status: "aprovado",
          p_feedback: feedbacks[currentPost.postIndex] || null,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["cliente-aprovacoes"] });
      toast.success("Post aprovado!");
      // Advance to next pending
      const nextIdx = posts.findIndex((p, i) => i > clampedPostIdx && p.status === "pendente");
      if (nextIdx >= 0) setCurrentPostIdx(nextIdx);
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPost = async () => {
    if (!currentPost || !activeTarefa) return;
    if (!feedbacks[currentPost.postIndex]?.trim()) {
      toast.error("Adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      for (const m of currentPost.mockups) {
        const { error } = await supabase.rpc("update_mockup_approval", {
          p_token: activeTarefa.approval_token,
          p_mockup_id: m.id,
          p_status: "reprovado",
          p_feedback: feedbacks[currentPost.postIndex],
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["cliente-aprovacoes"] });
      toast.success("Post reprovado com feedback.");
      const nextIdx = posts.findIndex((p, i) => i > clampedPostIdx && p.status === "pendente");
      if (nextIdx >= 0) setCurrentPostIdx(nextIdx);
    } catch {
      toast.error("Erro ao reprovar");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aprovações</h1>
        <p className="text-muted-foreground">Revise e aprove os mockups de suas tarefas</p>
      </div>

      {tarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <FileImage className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma aprovação pendente.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task list */}
          <div className="space-y-2">
            {tarefas.map(t => {
              const grouped = groupByPost(t.mockups);
              const aprovados = grouped.filter(p => p.status === "aprovado").length;
              const reprovados = grouped.filter(p => p.status === "reprovado").length;
              const pendentes = grouped.length - aprovados - reprovados;

              return (
                <Card
                  key={t.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-accent/50",
                    selectedTarefa === t.id && "ring-2 ring-primary"
                  )}
                  onClick={() => { setSelectedTarefa(t.id); setCurrentPostIdx(0); setSubmitted(false); }}
                >
                  <p className="font-medium text-sm text-foreground">{t.titulo}</p>
                  <div className="flex gap-1.5 mt-2">
                    {pendentes > 0 && <Badge variant="outline" className="text-[10px]">{pendentes} pendente{pendentes > 1 ? "s" : ""}</Badge>}
                    {aprovados > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-400">{aprovados} aprovado{aprovados > 1 ? "s" : ""}</Badge>}
                    {reprovados > 0 && <Badge variant="outline" className="text-[10px] border-red-500 text-red-400">{reprovados} reprovado{reprovados > 1 ? "s" : ""}</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Mockup detail — matching AprovacaoMockup layout */}
          {activeTarefa && posts.length > 0 ? (
            <div className="lg:col-span-2 max-w-xl mx-auto w-full space-y-4">
              {/* Post selector dots */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {posts.map((p, i) => (
                  <button
                    key={p.postIndex}
                    onClick={() => setCurrentPostIdx(i)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                      i === clampedPostIdx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
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
                  {/* Navigation + status */}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" disabled={clampedPostIdx === 0} onClick={() => setCurrentPostIdx(i => Math.max(0, i - 1))}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                    </Button>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border-0", statusColor(currentPost.status))}>
                        {statusLabel(currentPost.status)}
                      </Badge>
                      {currentPost.mockups.length > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          Carrossel ({currentPost.mockups.length} slides)
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" disabled={clampedPostIdx === posts.length - 1} onClick={() => setCurrentPostIdx(i => i + 1)}>
                      Próximo <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  {/* MockupPreview — full width like other mockups */}
                  <MockupPreview
                    slides={currentPost.mockups.map(m => ({
                      ordem: m.ordem,
                      subtitulo: m.subtitulo || "",
                      titulo: m.titulo || "",
                      legenda: m.legenda || "",
                      cta: m.cta || "",
                    }))}
                    perfilNome={activeTarefa.cliente_nome}
                    perfilCategoria={activeTarefa.cliente_empresa || ""}
                    className="max-w-none"
                  />

                  {/* Feedback + actions card */}
                  <Card className="p-4 space-y-3">
                    <Textarea
                      placeholder="Feedback para este post (obrigatório para reprovar)..."
                      value={feedbacks[currentPost.postIndex] || ""}
                      onChange={e => setFeedbacks(prev => ({ ...prev, [currentPost.postIndex]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleApprovePost}
                        disabled={submitting}
                        className="flex-1 gap-1.5"
                        variant={currentPost.status === "aprovado" ? "secondary" : "default"}
                      >
                        <Check className="w-4 h-4" />
                        {currentPost.status === "aprovado" ? "Aprovado" : "Aprovar"}
                      </Button>
                      <Button
                        onClick={handleRejectPost}
                        disabled={submitting}
                        variant="destructive"
                        className="flex-1 gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        {currentPost.status === "reprovado" ? "Reprovado" : "Reprovar"}
                      </Button>
                    </div>
                  </Card>

                  {/* Existing feedback display */}
                  {currentPost.status === "reprovado" && currentPost.mockups[0]?.feedback && !feedbacks[currentPost.postIndex] && (
                    <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">
                      💬 {currentPost.mockups[0].feedback}
                    </p>
                  )}
                </div>
              )}

              {/* All decided summary */}
              {allDecided && !submitted && (
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
          ) : (
            <div className="lg:col-span-2 flex items-center justify-center">
              <p className="text-muted-foreground">Selecione uma tarefa para revisar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
