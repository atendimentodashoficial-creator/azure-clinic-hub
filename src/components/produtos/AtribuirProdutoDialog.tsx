import { useState, useEffect, useMemo } from "react";
import { getLast8Digits } from "@/utils/phoneFormat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import {
  useProdutoTemplateTarefas,
  ProdutoTemplate,
} from "@/hooks/useProdutoTemplates";
import { useTarefas } from "@/hooks/useTarefas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Video, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";
import {
  SelectClientStep,
  SelectMemberAndTimeStep,
} from "./AtribuirProdutoSteps";

interface AtribuirProdutoDialogProps {
  template: ProdutoTemplate;
  open: boolean;
  onClose: () => void;
  initialContactData?: { nome?: string; telefone?: string };
}

function parseTarefaMeta(descricao: string | null): any {
  if (!descricao) return { texto: null };
  try {
    return JSON.parse(descricao);
  } catch {
    return { texto: descricao };
  }
}

type Step = "select-client" | "schedule-meeting" | "auto-matched";

export function AtribuirProdutoDialog({ template, open, onClose, initialContactData }: AtribuirProdutoDialogProps) {
  const { user } = useAuth();
  const { clientes, criarCliente } = useTarefasClientes();
  const { data: templateTarefas = [] } = useProdutoTemplateTarefas(template.id);
  const { criarTarefa, colunas } = useTarefas();

  const [busca, setBusca] = useState("");
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<Step>("select-client");
  const [selectedClient, setSelectedClient] = useState<TarefaCliente | null>(null);

  // Auto-match client by last 8 digits of phone
  const matchedClient = useMemo(() => {
    if (!initialContactData?.telefone) return null;
    const last8 = getLast8Digits(initialContactData.telefone);
    if (!last8 || last8.length < 8) return null;
    return clientes.find(c => c.telefone && getLast8Digits(c.telefone) === last8) || null;
  }, [initialContactData?.telefone, clientes]);

  // Auto-set step when opening with a matched client
  useEffect(() => {
    if (open && matchedClient && step === "select-client") {
      setStep("auto-matched");
      setSelectedClient(matchedClient);
    }
  }, [open, matchedClient]);

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  );

  const criarTarefasDoProduto = async (clienteId: string) => {
    for (const tt of templateTarefas) {
      const meta = parseTarefaMeta(tt.descricao);
      const colunaId = meta.coluna_id || colunas[0]?.id;
      if (!colunaId) {
        toast.error("Nenhuma coluna de tarefas encontrada");
        return;
      }
      const prazo = meta.prazo ? meta.prazo : null;
      const dataLimite = prazo ? new Date(Date.now() + prazo * 86400000).toISOString() : null;
      await criarTarefa.mutateAsync({
        titulo: tt.titulo,
        descricao: meta.texto || undefined,
        responsavel_nome: meta.responsavel || undefined,
        prioridade: meta.prioridade || "media",
        data_limite: dataLimite || undefined,
        coluna_id: colunaId,
        cliente_id: clienteId,
      });
    }
  };

  const handleSelectClient = (cliente: TarefaCliente) => {
    setSelectedClient(cliente);
    if (template.requer_reuniao) {
      setStep("schedule-meeting");
    } else {
      handleAtribuirSemReuniao(cliente.id, cliente.nome);
    }
  };

  const handleAtribuirSemReuniao = async (clienteId: string, clienteNome: string) => {
    if (templateTarefas.length === 0) {
      toast.error("Este produto não possui tarefas configuradas");
      return;
    }
    setSaving(true);
    try {
      await criarTarefasDoProduto(clienteId);
      toast.success(`Produto "${template.nome}" atribuído a ${clienteNome}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atribuir produto");
    } finally {
      setSaving(false);
    }
  };

  const handleAtribuirComReuniao = async (data: {
    titulo: string;
    dataHora: string;
    duracao: number;
    memberNome: string;
    memberId: string;
  }) => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      if (templateTarefas.length > 0) {
        await criarTarefasDoProduto(selectedClient.id);
      }

      // Look up the membro to find their email, then find profissional by email
      const { data: membroData } = await supabase
        .from("tarefas_membros" as any)
        .select("email")
        .eq("id", data.memberId)
        .maybeSingle() as any;

      let profissionalId: string | null = null;
      if (membroData?.email) {
        const { data: profData } = await supabase
          .from("profissionais")
          .select("id")
          .eq("email", membroData.email)
          .maybeSingle();
        profissionalId = profData?.id || null;
      }

      // Try to find the client in leads table to set cliente_id
      let clienteId: string | null = null;
      if (selectedClient.telefone) {
        const { data: leadData } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", user!.id)
          .is("deleted_at", null)
          .eq("telefone", selectedClient.telefone)
          .maybeSingle();
        clienteId = leadData?.id || null;
      }

      const { data: reuniaoData, error } = await supabase
        .from("reunioes" as any)
        .insert({
          user_id: user!.id,
          titulo: data.titulo,
          data_reuniao: data.dataHora,
          duracao_minutos: data.duracao,
          cliente_telefone: selectedClient.telefone || null,
          cliente_id: clienteId,
          profissional_id: profissionalId,
          status: "agendado",
          participantes: [selectedClient.nome, data.memberNome],
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Send immediate WhatsApp notification
      if (selectedClient.telefone && reuniaoData?.id) {
        try {
          await supabase.functions.invoke("enviar-aviso-reuniao-imediato", {
            body: {
              reuniaoId: reuniaoData.id,
              userId: user!.id,
              clienteTelefone: selectedClient.telefone,
              clienteNome: selectedClient.nome,
              tipo: "imediato",
            },
          });
        } catch (notifyErr) {
          console.error("Erro ao enviar aviso imediato:", notifyErr);
        }
      }

      toast.success(`Produto atribuído e reunião agendada com ${selectedClient.nome}`);
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atribuir produto");
    } finally {
      setSaving(false);
    }
  };

  const handleNovoClienteCriado = async (data: any) => {
    try {
      await criarCliente.mutateAsync(data);
      await new Promise(r => setTimeout(r, 500));
      setShowNovoCliente(false);
      toast.success("Cliente criado! Selecione-o na lista para atribuir o produto.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cliente");
    }
  };

  const handleClose = () => {
    setStep("select-client");
    setSelectedClient(null);
    setBusca("");
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => handleClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col min-h-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {step === "auto-matched" ? "Cliente Encontrado" : step === "select-client" ? "Atribuir Produto" : "Agendar Reunião"}
            </DialogTitle>
            <DialogDescription>
              {step === "auto-matched" && matchedClient ? (
                <>Este contato já é um cliente cadastrado</>
              ) : step === "select-client" ? (
                <>
                  Selecione um cliente para atribuir "{template.nome}"
                  {template.requer_reuniao && (
                    <span className="flex items-center gap-1 mt-1 text-primary">
                      <Video className="h-3.5 w-3.5" />
                      Este produto inclui agendamento de reunião
                    </span>
                  )}
                </>
              ) : (
                `Selecione o profissional e horário para "${template.nome}"`
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "auto-matched" && matchedClient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-accent/30">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{matchedClient.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[matchedClient.email, matchedClient.telefone].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setStep("select-client"); setSelectedClient(null); }}>
                  Escolher outro
                </Button>
                <Button onClick={() => handleSelectClient(matchedClient)} disabled={saving}>
                  {saving ? "Atribuindo..." : `Atribuir "${template.nome}"`}
                </Button>
              </div>
            </div>
          )}

          {step === "select-client" && (
            <SelectClientStep
              busca={busca}
              onBuscaChange={setBusca}
              filtrados={filtrados}
              saving={saving}
              requerReuniao={!!template.requer_reuniao}
              onSelectClient={handleSelectClient}
              onNovoCliente={() => setShowNovoCliente(true)}
            />
          )}

          {step === "schedule-meeting" && selectedClient && (
            <SelectMemberAndTimeStep
              clienteNome={selectedClient.nome}
              templateNome={template.nome}
              saving={saving}
              onBack={() => setStep("select-client")}
              onConfirm={handleAtribuirComReuniao}
            />
          )}
        </DialogContent>
      </Dialog>

      <NovoClienteDialog
        externalOpen={showNovoCliente}
        hideTrigger
        onSubmit={handleNovoClienteCriado}
        onClose={() => setShowNovoCliente(false)}
        initialData={initialContactData}
        defaultTipo="preview"
      />
    </>
  );
}
