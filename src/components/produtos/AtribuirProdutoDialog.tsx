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
import { toast } from "sonner";
import { Search, Plus, User, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [view, setView] = useState<"select" | "create">("select");
  const [saving, setSaving] = useState(false);

  // New client form
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");

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

  const handleCriarEAtribuir = async () => {
    if (!novoNome.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    setSaving(true);
    try {
      // Create client first
      await criarCliente.mutateAsync({
        nome: novoNome.trim(),
        email: novoEmail.trim() || null,
        telefone: novoTelefone.trim() || null,
        empresa: null,
        cnpj: null,
        site: null,
        instagram: null,
        linktree: null,
        google_meu_negocio: null,
        observacoes: null,
        grupo_whatsapp: null,
        tipo: "preview",
        senha_acesso: null,
      });

      // Refetch to get the new client's ID
      // Small delay to let invalidation work
      await new Promise(r => setTimeout(r, 500));

      // Get the latest client list
      const { data: updatedClientes } = await (await import("@/integrations/supabase/client")).supabase
        .from("tarefas_clientes")
        .select("*")
        .ilike("nome", novoNome.trim())
        .order("created_at", { ascending: false })
        .limit(1);

      if (!updatedClientes || updatedClientes.length === 0) {
        toast.error("Erro ao localizar cliente criado");
        return;
      }

      const newClient = updatedClientes[0] as TarefaCliente;
      await handleAtribuir(newClient.id, newClient.nome);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cliente");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {view === "create" ? "Novo Cliente" : "Atribuir Produto"}
          </DialogTitle>
          <DialogDescription>
            {view === "create"
              ? "Cadastre um novo cliente para atribuir o produto"
              : `Selecione um cliente para atribuir "${template.nome}"`}
          </DialogDescription>
        </DialogHeader>

        {view === "select" ? (
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
                onClick={() => setView("create")}
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
                  <Button variant="link" size="sm" onClick={() => setView("create")}>
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
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 -ml-2"
              onClick={() => setView("select")}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            <div className="space-y-3">
              <div>
                <Label className="text-sm">Nome *</Label>
                <Input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  value={novoEmail}
                  onChange={e => setNovoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label className="text-sm">Telefone</Label>
                <Input
                  value={novoTelefone}
                  onChange={e => setNovoTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setView("select")} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCriarEAtribuir} disabled={saving}>
                {saving ? "Salvando..." : "Criar e Atribuir"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
