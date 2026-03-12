import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import {
  useProdutoTemplateTarefas,
  ProdutoTemplate,
} from "@/hooks/useProdutoTemplates";
import { useTarefas } from "@/hooks/useTarefas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, Plus, User, Video, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NovoClienteDialog } from "@/components/tarefas/NovoClienteDialog";

interface AtribuirProdutoDialogProps {
  template: ProdutoTemplate;
  open: boolean;
  onClose: () => void;
}

function parseTarefaMeta(descricao: string | null): any {
  if (!descricao) return { texto: null };
  try {
    return JSON.parse(descricao);
  } catch {
    return { texto: descricao };
  }
}

export function AtribuirProdutoDialog({ template, open, onClose }: AtribuirProdutoDialogProps) {
  const { user } = useAuth();
  const { clientes, criarCliente } = useTarefasClientes();
  const { data: templateTarefas = [] } = useProdutoTemplateTarefas(template.id);
  const { criarTarefa, colunas } = useTarefas();

  const [busca, setBusca] = useState("");
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [saving, setSaving] = useState(false);

  // Meeting scheduling state
  const [step, setStep] = useState<"select-client" | "schedule-meeting">("select-client");
  const [selectedClient, setSelectedClient] = useState<{ id: string; nome: string; telefone?: string | null } | null>(null);
  const [reuniaoTitulo, setReuniaoTitulo] = useState("");
  const [reuniaoData, setReuniaoData] = useState("");
  const [reuniaoHora, setReuniaoHora] = useState("");
  const [reuniaoDuracao, setReuniaDuracao] = useState("60");

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
      const dataLimite = prazo
        ? new Date(Date.now() + prazo * 86400000).toISOString()
        : null;

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
    if (template.requer_reuniao) {
      setSelectedClient({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone });
      setReuniaoTitulo(`Reunião - ${cliente.nome} - ${template.nome}`);
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

  const handleAtribuirComReuniao = async () => {
    if (!selectedClient) return;
    if (!reuniaoData || !reuniaoHora) {
      toast.error("Data e hora da reunião são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      // Create tasks
      if (templateTarefas.length > 0) {
        await criarTarefasDoProduto(selectedClient.id);
      }

      // Create meeting
      const dataReuniao = new Date(`${reuniaoData}T${reuniaoHora}:00`).toISOString();
      const { error } = await supabase
        .from("reunioes" as any)
        .insert({
          user_id: user!.id,
          titulo: reuniaoTitulo.trim() || `Reunião - ${selectedClient.nome}`,
          data_reuniao: dataReuniao,
          duracao_minutos: parseInt(reuniaoDuracao) || 60,
          cliente_telefone: selectedClient.telefone || null,
          status: "agendado",
          participantes: [selectedClient.nome],
        } as any);

      if (error) throw error;

      toast.success(`Produto atribuído e reunião agendada com ${selectedClient.nome}`);
      onClose();
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
      const { data: updatedClientes } = await supabase
        .from("tarefas_clientes")
        .select("*")
        .ilike("nome", data.nome)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!updatedClientes || updatedClientes.length === 0) {
        toast.error("Erro ao localizar cliente criado");
        return;
      }

      const newClient = updatedClientes[0] as TarefaCliente;
      setShowNovoCliente(false);

      if (template.requer_reuniao) {
        setSelectedClient({ id: newClient.id, nome: newClient.nome, telefone: newClient.telefone });
        setReuniaoTitulo(`Reunião - ${newClient.nome} - ${template.nome}`);
        setStep("schedule-meeting");
      } else {
        await handleAtribuirSemReuniao(newClient.id, newClient.nome);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cliente");
    }
  };

  const handleClose = () => {
    setStep("select-client");
    setSelectedClient(null);
    setReuniaoTitulo("");
    setReuniaoData("");
    setReuniaoHora("");
    setReuniaDuracao("60");
    setBusca("");
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => handleClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          {step === "select-client" ? (
            <>
              <DialogHeader>
                <DialogTitle>Atribuir Produto</DialogTitle>
                <DialogDescription>
                  Selecione um cliente para atribuir "{template.nome}"
                  {template.requer_reuniao && (
                    <span className="flex items-center gap-1 mt-1 text-primary">
                      <Video className="h-3.5 w-3.5" />
                      Este produto inclui agendamento de reunião
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setShowNovoCliente(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>

                <ScrollArea className="flex-1 max-h-[50vh]">
                  {filtrados.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                      </p>
                      <Button variant="link" size="sm" onClick={() => setShowNovoCliente(true)}>
                        Cadastrar novo cliente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filtrados.map(cliente => (
                        <button
                          key={cliente.id}
                          disabled={saving}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                            "hover:bg-accent/50 transition-colors",
                            "disabled:opacity-50"
                          )}
                          onClick={() => handleSelectClient(cliente)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{cliente.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[cliente.email, cliente.telefone].filter(Boolean).join(" • ") || "Sem contato"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Agendar Reunião</DialogTitle>
                <DialogDescription>
                  Agende a reunião com {selectedClient?.nome} para o produto "{template.nome}"
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 -ml-2"
                  onClick={() => setStep("select-client")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>

                <div className="space-y-2">
                  <Label>Título da Reunião</Label>
                  <Input
                    value={reuniaoTitulo}
                    onChange={e => setReuniaoTitulo(e.target.value)}
                    placeholder="Ex: Reunião de OnBoarding"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={reuniaoData}
                      onChange={e => setReuniaoData(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora *</Label>
                    <Input
                      type="time"
                      value={reuniaoHora}
                      onChange={e => setReuniaoHora(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duração (minutos)</Label>
                  <Input
                    type="number"
                    value={reuniaoDuracao}
                    onChange={e => setReuniaDuracao(e.target.value)}
                    min={15}
                    step={15}
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => setStep("select-client")} disabled={saving}>
                  Voltar
                </Button>
                <Button onClick={handleAtribuirComReuniao} disabled={saving} className="gap-1.5">
                  <Video className="h-4 w-4" />
                  {saving ? "Salvando..." : "Atribuir e Agendar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NovoClienteDialog
        externalOpen={showNovoCliente}
        hideTrigger
        onSubmit={handleNovoClienteCriado}
        onClose={() => setShowNovoCliente(false)}
      />
    </>
  );
}
