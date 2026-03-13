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
import { Video } from "lucide-react";
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
  }) => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      if (templateTarefas.length > 0) {
        await criarTarefasDoProduto(selectedClient.id);
      }

      const { error } = await supabase
        .from("reunioes" as any)
        .insert({
          user_id: user!.id,
          titulo: data.titulo,
          data_reuniao: data.dataHora,
          duracao_minutos: data.duracao,
          cliente_telefone: selectedClient.telefone || null,
          status: "agendado",
          participantes: [selectedClient.nome, data.memberNome],
        } as any);

      if (error) throw error;

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
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{step === "select-client" ? "Atribuir Produto" : "Agendar Reunião"}</DialogTitle>
            <DialogDescription>
              {step === "select-client" ? (
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
