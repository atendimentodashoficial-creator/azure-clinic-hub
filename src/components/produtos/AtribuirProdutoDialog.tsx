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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTarefasClientes, TarefaCliente } from "@/hooks/useTarefasClientes";
import {
  useProdutoTemplateTarefas,
  ProdutoTemplate,
} from "@/hooks/useProdutoTemplates";
import { useTarefas } from "@/hooks/useTarefas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Plus, User } from "lucide-react";
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
  const { clientes, criarCliente } = useTarefasClientes();
  const { data: templateTarefas = [] } = useProdutoTemplateTarefas(template.id);
  const { criarTarefa, colunas } = useTarefas();

  const [busca, setBusca] = useState("");
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  );

  const handleAtribuir = async (clienteId: string, clienteNome: string) => {
    if (templateTarefas.length === 0) {
      toast.error("Este produto não possui tarefas configuradas");
      return;
    }

    setSaving(true);
    try {
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

      toast.success(`Produto "${template.nome}" atribuído a ${clienteNome}`);
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

      // Fetch the newly created client
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
      await handleAtribuir(newClient.id, newClient.nome);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cliente");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Atribuir Produto</DialogTitle>
            <DialogDescription>
              Selecione um cliente para atribuir "{template.nome}"
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
                      onClick={() => handleAtribuir(cliente.id, cliente.nome)}
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
