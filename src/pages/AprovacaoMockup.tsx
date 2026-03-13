import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview, MockupSlide } from "@/components/tarefas/MockupPreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, X, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MockupData {
  mockup_id: string;
  tarefa_id: string;
  ordem: number;
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

export default function AprovacaoMockup() {
  const { token } = useParams<{ token: string }>();
  const [mockups, setMockups] = useState<MockupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadMockups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadMockups = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase.rpc("get_mockups_by_approval_token", { p_token: token! });
      if (err) throw err;
      setMockups(data || []);
      const fb: Record<string, string> = {};
      (data || []).forEach((m: MockupData) => {
        if (m.feedback) fb[m.mockup_id] = m.feedback;
      });
      setFeedbacks(fb);
    } catch (e: any) {
      setError(e.message || "Link inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  const advanceToNext = () => {
    // Find next undecided item after current
    const nextUndecided = mockups.findIndex((m, i) => i > currentIndex && m.status === "pendente");
    if (nextUndecided !== -1) {
      setCurrentIndex(nextUndecided);
    } else {
      // Try from beginning
      const firstUndecided = mockups.findIndex(m => m.status === "pendente");
      if (firstUndecided !== -1 && firstUndecided !== currentIndex) {
        setCurrentIndex(firstUndecided);
      }
      // If none left, stay on current (all decided)
    }
  };

  const handleApprove = async (mockupId: string) => {
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_mockup_approval", {
        p_token: token!,
        p_mockup_id: mockupId,
        p_status: "aprovado",
        p_feedback: feedbacks[mockupId] || null,
      });
      if (err) throw err;
      setMockups(prev => {
        const updated = prev.map(m => m.mockup_id === mockupId ? { ...m, status: "aprovado", feedback: feedbacks[mockupId] || null } : m);
        // Schedule advance after state update
        setTimeout(() => {
          const nextUndecided = updated.findIndex((m, i) => i > currentIndex && m.status === "pendente");
          if (nextUndecided !== -1) {
            setCurrentIndex(nextUndecided);
          } else {
            const first = updated.findIndex(m => m.status === "pendente");
            if (first !== -1) setCurrentIndex(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Mockup aprovado!");
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (mockupId: string) => {
    if (!feedbacks[mockupId]?.trim()) {
      toast.error("Por favor, adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc("update_mockup_approval", {
        p_token: token!,
        p_mockup_id: mockupId,
        p_status: "reprovado",
        p_feedback: feedbacks[mockupId],
      });
      if (err) throw err;
      setMockups(prev => {
        const updated = prev.map(m => m.mockup_id === mockupId ? { ...m, status: "reprovado", feedback: feedbacks[mockupId] } : m);
        setTimeout(() => {
          const nextUndecided = updated.findIndex((m, i) => i > currentIndex && m.status === "pendente");
          if (nextUndecided !== -1) {
            setCurrentIndex(nextUndecided);
          } else {
            const first = updated.findIndex(m => m.status === "pendente");
            if (first !== -1) setCurrentIndex(first);
          }
        }, 300);
        return updated;
      });
      toast.success("Mockup reprovado com feedback.");
    } catch {
      toast.error("Erro ao reprovar");
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

  if (error || mockups.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {submitted ? "Respostas enviadas!" : "Nenhum item pendente"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {error || (submitted ? "Suas respostas foram registradas com sucesso. Obrigado!" : "Todos os mockups já foram aprovados ou não há itens para revisar.")}
          </p>
        </Card>
      </div>
    );
  }

  const currentMockup = mockups[currentIndex];
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

  const allDecided = mockups.every(m => m.status === "aprovado" || m.status === "reprovado");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{tarefaTitulo}</h1>
          <p className="text-sm text-muted-foreground">Aprovação de Mockups • {clienteNome}</p>
        </div>

        {/* Status overview */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {mockups.map((m, i) => (
            <button
              key={m.mockup_id}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                i === currentIndex ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                m.status === "aprovado" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                m.status === "reprovado" ? "bg-red-500/20 border-red-500 text-red-400" :
                "bg-muted border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {m.ordem + 1}
            </button>
          ))}
        </div>

        {/* Current mockup preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(i => i - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Badge className={cn("border-0", statusColor(currentMockup.status))}>
              {statusLabel(currentMockup.status)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex === mockups.length - 1}
              onClick={() => setCurrentIndex(i => i + 1)}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <MockupPreview
            slides={[{
              ordem: currentMockup.ordem,
              subtitulo: currentMockup.subtitulo || "",
              titulo: currentMockup.titulo || "",
              legenda: currentMockup.legenda || "",
              cta: currentMockup.cta || "",
            }]}
            perfilNome={clienteNome}
            perfilCategoria={clienteEmpresa}
          />

          {/* Individual feedback + actions */}
          {!allDecided && (
            <Card className="p-4 space-y-3">
              <Textarea
                placeholder="Feedback para este slide (obrigatório para reprovar)..."
                value={feedbacks[currentMockup.mockup_id] || ""}
                onChange={e => setFeedbacks(prev => ({ ...prev, [currentMockup.mockup_id]: e.target.value }))}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(currentMockup.mockup_id)}
                  disabled={submitting || currentMockup.status === "aprovado"}
                  className="flex-1 gap-1.5"
                  variant={currentMockup.status === "aprovado" ? "secondary" : "default"}
                >
                  <Check className="w-4 h-4" />
                  {currentMockup.status === "aprovado" ? "Aprovado" : "Aprovar"}
                </Button>
                <Button
                  onClick={() => handleReject(currentMockup.mockup_id)}
                  disabled={submitting || currentMockup.status === "reprovado"}
                  variant="destructive"
                  className="flex-1 gap-1.5"
                >
                  <X className="w-4 h-4" />
                  {currentMockup.status === "reprovado" ? "Reprovado" : "Reprovar"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {allDecided && (
          <Card className="p-5 space-y-4 text-center border-primary/30">
            <p className="text-sm font-medium text-foreground">
              Todos os itens foram revisados!
            </p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {mockups.filter(m => m.status === "aprovado").length} aprovado(s) • {mockups.filter(m => m.status === "reprovado").length} reprovado(s)
              </p>
              <Button
                onClick={() => setSubmitted(true)}
                className="gap-2"
                size="lg"
              >
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
