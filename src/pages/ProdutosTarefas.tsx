import { useState } from "react";
import {
  useProdutoTemplates,
  useProdutoTemplateTarefas,
  useProdutoTemplateMutations,
  ProdutoTemplate,
} from "@/hooks/useProdutoTemplates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Package,
  Trash2,
  Edit,
  ListChecks,
  GripVertical,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function NovoProdutoDialog({
  onSubmit,
  editando,
  onClose,
}: {
  onSubmit: (data: { nome: string; descricao?: string; id?: string }) => void;
  editando?: ProdutoTemplate | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [descricao, setDescricao] = useState(editando?.descricao || "");

  const resetForm = () => {
    setNome("");
    setDescricao("");
  };

  const handleSubmit = () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    onSubmit({
      ...(editando && { id: editando.id }),
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
    });
    resetForm();
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      resetForm();
      onClose?.();
    }
  };

  return (
    <Dialog
      open={isEditing ? true : open}
      onOpenChange={isEditing ? () => onClose?.() : handleOpenChange}
    >
      {!isEditing && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Plano Mensal, Consultoria..."
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do produto..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProdutoTarefasPanel({
  template,
  onClose,
}: {
  template: ProdutoTemplate;
  onClose: () => void;
}) {
  const { data: tarefas = [], isLoading } = useProdutoTemplateTarefas(
    template.id
  );
  const { adicionarTarefa, atualizarTarefa, excluirTarefa } =
    useProdutoTemplateMutations();
  const [novaTitulo, setNovaTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const handleAdicionarTarefa = () => {
    if (!novaTitulo.trim()) {
      toast.error("Título da tarefa é obrigatório");
      return;
    }
    adicionarTarefa.mutate(
      {
        produto_template_id: template.id,
        titulo: novaTitulo.trim(),
        descricao: novaDescricao.trim() || undefined,
        ordem: tarefas.length,
      },
      {
        onSuccess: () => {
          toast.success("Tarefa adicionada!");
          setNovaTitulo("");
          setNovaDescricao("");
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleSalvarEdicao = (id: string) => {
    if (!editTitulo.trim()) return;
    atualizarTarefa.mutate(
      { id, titulo: editTitulo.trim(), descricao: editDescricao.trim() || null },
      {
        onSuccess: () => {
          toast.success("Tarefa atualizada!");
          setEditandoId(null);
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleExcluir = (id: string) => {
    excluirTarefa.mutate(id, {
      onSuccess: () => toast.success("Tarefa removida"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Tarefas de "{template.nome}"
          </h2>
          <p className="text-sm text-muted-foreground">
            {tarefas.length} tarefa(s) configurada(s)
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Add task form */}
      <Card className="p-4 space-y-3 border-dashed">
        <Input
          placeholder="Título da tarefa..."
          value={novaTitulo}
          onChange={(e) => setNovaTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdicionarTarefa()}
        />
        <Textarea
          placeholder="Descrição (opcional)..."
          value={novaDescricao}
          onChange={(e) => setNovaDescricao(e.target.value)}
          className="min-h-[60px]"
        />
        <Button
          onClick={handleAdicionarTarefa}
          size="sm"
          className="gap-2"
          disabled={adicionarTarefa.isPending}
        >
          <Plus className="h-4 w-4" /> Adicionar Tarefa
        </Button>
      </Card>

      {/* Task list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Carregando...
        </p>
      ) : tarefas.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhuma tarefa configurada para este produto
        </p>
      ) : (
        <div className="space-y-2">
          {tarefas.map((tarefa, index) => (
            <Card key={tarefa.id} className="p-3 flex items-start gap-3 group">
              <div className="mt-1">
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <Badge
                variant="secondary"
                className="mt-0.5 shrink-0 text-xs font-mono"
              >
                {index + 1}
              </Badge>

              {editandoId === tarefa.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSalvarEdicao(tarefa.id)
                    }
                  />
                  <Textarea
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="min-h-[50px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSalvarEdicao(tarefa.id)}
                    >
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tarefa.titulo}</p>
                  {tarefa.descricao && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tarefa.descricao}
                    </p>
                  )}
                </div>
              )}

              {editandoId !== tarefa.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditandoId(tarefa.id);
                      setEditTitulo(tarefa.titulo);
                      setEditDescricao(tarefa.descricao || "");
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleExcluir(tarefa.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProdutosTarefas() {
  const { data: templates = [], isLoading } = useProdutoTemplates();
  const {
    criarTemplate,
    atualizarTemplate,
    excluirTemplate,
  } = useProdutoTemplateMutations();
  const [selecionado, setSelecionado] = useState<ProdutoTemplate | null>(null);
  const [editando, setEditando] = useState<ProdutoTemplate | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = templates.filter(
    (t) =>
      t.nome.toLowerCase().includes(busca.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleCriar = (data: { nome: string; descricao?: string }) => {
    criarTemplate.mutate(data, {
      onSuccess: () => toast.success("Produto criado!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: {
    id?: string;
    nome: string;
    descricao?: string;
  }) => {
    if (!data.id) return;
    atualizarTemplate.mutate(
      { id: data.id, nome: data.nome, descricao: data.descricao || null },
      {
        onSuccess: () => {
          toast.success("Produto atualizado!");
          setEditando(null);
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleExcluir = (id: string) => {
    excluirTemplate.mutate(id, {
      onSuccess: () => {
        toast.success("Produto removido");
        if (selecionado?.id === id) setSelecionado(null);
      },
      onError: (e: any) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6" />
            Produtos & Tarefas
          </h1>
          <p className="text-muted-foreground">
            Configure produtos com templates de tarefas automáticas
          </p>
        </div>
        <NovoProdutoDialog onSubmit={handleCriar} />
      </div>

      {editando && (
        <NovoProdutoDialog
          editando={editando}
          onSubmit={handleAtualizar}
          onClose={() => setEditando(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products list */}
        <div className="lg:col-span-1 space-y-3">
          <Input
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          {filtrados.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Nenhum produto cadastrado
            </p>
          ) : (
            <div className="space-y-2">
              {filtrados.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-accent/30 group",
                    selecionado?.id === template.id &&
                      "ring-2 ring-primary bg-primary/5"
                  )}
                  onClick={() => setSelecionado(template)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {template.nome}
                      </p>
                      {template.descricao && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {template.descricao}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(template);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExcluir(template.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Tasks panel */}
        <div className="lg:col-span-2">
          {selecionado ? (
            <ProdutoTarefasPanel
              key={selecionado.id}
              template={selecionado}
              onClose={() => setSelecionado(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-30" />
              <p>Selecione um produto para configurar suas tarefas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
