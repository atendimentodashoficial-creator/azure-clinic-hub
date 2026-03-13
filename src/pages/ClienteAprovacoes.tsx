import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MockupPreview } from "@/components/tarefas/MockupPreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Check, X, CheckCheck, XCircle, FileImage } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TarefaAprovacao {
  id: string;
  titulo: string;
  approval_token: string;
  mockups: {
    id: string;
    ordem: number;
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

export default function ClienteAprovacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedTarefa, setSelectedTarefa] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["cliente-aprovacoes", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];
      
      // Find client record by email
      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("id, nome, empresa")
        .eq("email", user.email)
        .limit(1)
        .single();

      if (!clienteData) return [];

      // Get tasks with approval tokens for this client
      const { data: tarefasData, error } = await supabase
        .from("tarefas")
        .select("id, titulo, approval_token")
        .eq("cliente_id", clienteData.id)
        .not("approval_token", "is", null);

      if (error || !tarefasData?.length) return [];

      // Get mockups for each task
      const result: TarefaAprovacao[] = [];
      for (const t of tarefasData) {
        const { data: mockupsData } = await supabase
          .from("tarefa_mockups")
          .select("id, ordem, subtitulo, titulo, legenda, cta, status, feedback")
          .eq("tarefa_id", t.id)
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

  const handleAction = async (token: string, mockupId: string, status: "aprovado" | "reprovado") => {
    if (status === "reprovado" && !feedbacks[mockupId]?.trim()) {
      toast.error("Adicione um feedback antes de reprovar.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("update_mockup_approval", {
        p_token: token,
        p_mockup_id: mockupId,
        p_status: status,
        p_feedback: feedbacks[mockupId] || null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["cliente-aprovacoes"] });
      toast.success(status === "aprovado" ? "Aprovado!" : "Reprovado!");
    } catch {
      toast.error("Erro ao atualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAction = async (token: string, status: "aprovado" | "reprovado") => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("bulk_update_mockup_approval", {
        p_token: token,
        p_status: status,
        p_feedback: null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["cliente-aprovacoes"] });
      toast.success(status === "aprovado" ? "Todos aprovados!" : "Todos reprovados!");
    } catch {
      toast.error("Erro ao atualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const activeTarefa = tarefas.find(t => t.id === selectedTarefa);

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
              const aprovados = t.mockups.filter(m => m.status === "aprovado").length;
              const reprovados = t.mockups.filter(m => m.status === "reprovado").length;
              const pendentes = t.mockups.length - aprovados - reprovados;

              return (
                <Card
                  key={t.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-accent/50",
                    selectedTarefa === t.id && "ring-2 ring-primary"
                  )}
                  onClick={() => { setSelectedTarefa(t.id); setCurrentSlide(0); }}
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

          {/* Mockup detail */}
          {activeTarefa ? (
            <div className="lg:col-span-2 space-y-4">
              {/* Slide selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeTarefa.mockups.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border-2 transition-all",
                      i === currentSlide ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                      m.status === "aprovado" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                      m.status === "reprovado" ? "bg-red-500/20 border-red-500 text-red-400" :
                      "bg-muted border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {activeTarefa.mockups[currentSlide] && (() => {
                const m = activeTarefa.mockups[currentSlide];
                return (
                  <div className="space-y-4">
                    <MockupPreview
                      slides={[{
                        ordem: m.ordem,
                        subtitulo: m.subtitulo || "",
                        titulo: m.titulo || "",
                        legenda: m.legenda || "",
                        cta: m.cta || "",
                      }]}
                      perfilNome={activeTarefa.cliente_nome}
                      perfilCategoria={activeTarefa.cliente_empresa || ""}
                    />

                    <Card className="p-4 space-y-3">
                      <Textarea
                        placeholder="Feedback (obrigatório para reprovar)..."
                        value={feedbacks[m.id] || m.feedback || ""}
                        onChange={e => setFeedbacks(prev => ({ ...prev, [m.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAction(activeTarefa.approval_token, m.id, "aprovado")}
                          disabled={submitting}
                          className="flex-1 gap-1.5"
                          variant={m.status === "aprovado" ? "secondary" : "default"}
                        >
                          <Check className="w-4 h-4" />
                          {m.status === "aprovado" ? "Aprovado" : "Aprovar"}
                        </Button>
                        <Button
                          onClick={() => handleAction(activeTarefa.approval_token, m.id, "reprovado")}
                          disabled={submitting}
                          variant="destructive"
                          className="flex-1 gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          {m.status === "reprovado" ? "Reprovado" : "Reprovar"}
                        </Button>
                      </div>
                    </Card>

                    {/* Bulk actions */}
                    {activeTarefa.mockups.length > 1 && (
                      <>
                        <Separator />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleBulkAction(activeTarefa.approval_token, "aprovado")}
                            disabled={submitting}
                            variant="outline"
                            className="flex-1 gap-1.5"
                          >
                            <CheckCheck className="w-4 h-4" /> Aprovar Todos
                          </Button>
                          <Button
                            onClick={() => handleBulkAction(activeTarefa.approval_token, "reprovado")}
                            disabled={submitting}
                            variant="outline"
                            className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" /> Reprovar Todos
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
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
