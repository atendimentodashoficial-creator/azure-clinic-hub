import { useState } from "react";
import { AtribuirProdutoDialog } from "@/components/produtos/AtribuirProdutoDialog";
import {
  useProdutoTemplates,
  useProdutoTemplateTarefas,
  useProdutoTemplateMutations,
  ProdutoTemplate,
  ProdutoTemplateTarefa,
} from "@/hooks/useProdutoTemplates";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useTarefas } from "@/hooks/useTarefas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Package,
  Trash2,
  Edit,
  GripVertical,
  ChevronRight,
  Calendar,
  Play,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

interface TarefaLocal {
  id: string;
  titulo: string;
  descricao: string;
  responsaveis: string[];
  prioridade: string;
  prazo: number;
  colunaId: string;
  dependencias: string[];
}

function gerarId() {
  return crypto.randomUUID();
}

function parseTarefaMeta(descricao: string | null): any {
  if (!descricao) return { texto: null };
  try {
    return JSON.parse(descricao);
  } catch {
    return { texto: descricao };
  }
}

function tarefaDbToLocal(t: ProdutoTemplateTarefa): TarefaLocal {
  const meta = parseTarefaMeta(t.descricao);
  return {
    id: t.id,
    titulo: t.titulo,
    descricao: meta.texto || "",
    responsaveis: meta.responsavel ? meta.responsavel.split(", ") : [],
    prioridade: meta.prioridade || "media",
    prazo: meta.prazo || 0,
    colunaId: meta.coluna_id || "",
    dependencias: meta.dependencias || [],
  };
}

function tarefaLocalToDesc(t: TarefaLocal, allTarefas: TarefaLocal[]): string {
  const depOrdens = t.dependencias
    .map(depId => allTarefas.findIndex(at => at.id === depId))
    .filter(i => i >= 0);
  const meta: any = {
    texto: t.descricao || null,
    responsavel: t.responsaveis.length > 0 ? t.responsaveis.join(", ") : undefined,
    prioridade: t.prioridade,
    prazo: t.prazo > 0 ? t.prazo : undefined,
    coluna_id: t.colunaId || undefined,
    dependencias: depOrdens.length > 0 ? depOrdens : undefined,
  };
  return JSON.stringify(meta);
}

// ─── Sortable task list wrapper ───
function SortableTaskList({
  tarefas,
  setTarefas,
  updateTarefa,
  removeTarefa,
  membros,
  colunas,
}: {
  tarefas: TarefaLocal[];
  setTarefas: React.Dispatch<React.SetStateAction<TarefaLocal[]>>;
  updateTarefa: (index: number, t: TarefaLocal) => void;
  removeTarefa: (index: number) => void;
  membros: any[];
  colunas: any[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTarefas(prev => {
        const oldIndex = prev.findIndex(t => t.id === active.id);
        const newIndex = prev.findIndex(t => t.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tarefas.map((t, i) => (
            <TarefaInlineEditor
              key={t.id}
              tarefa={t}
              tarefaIndex={i}
              allTarefas={tarefas}
              onChange={updated => updateTarefa(i, updated)}
              onRemove={() => removeTarefa(i)}
              membros={membros}
              colunas={colunas}
              isNew={t.titulo === "" && t.descricao === ""}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Inline task editor row ───
function TarefaInlineEditor({
  tarefa,
  tarefaIndex,
  allTarefas,
  onChange,
  onRemove,
  membros,
  colunas,
  isNew = false,
}: {
  tarefa: TarefaLocal;
  tarefaIndex: number;
  allTarefas: TarefaLocal[];
  onChange: (t: TarefaLocal) => void;
  onRemove: () => void;
  membros: any[];
  colunas: any[];
  isNew?: boolean;
}) {
  const [expanded, setExpanded] = useState(isNew);
  const prio = PRIORIDADES.find(p => p.value === tarefa.prioridade);
  const coluna = tarefa.colunaId ? colunas.find((c: any) => c.id === tarefa.colunaId) : null;

  const toggleResponsavel = (nome: string) => {
    const next = tarefa.responsaveis.includes(nome)
      ? tarefa.responsaveis.filter(n => n !== nome)
      : [...tarefa.responsaveis, nome];
    onChange({ ...tarefa, responsaveis: next });
  };

  const otherTarefas = allTarefas.filter((_, i) => i !== tarefaIndex);
  const toggleDependencia = (depId: string) => {
    const next = tarefa.dependencias.includes(depId)
      ? tarefa.dependencias.filter(d => d !== depId)
      : [...tarefa.dependencias, depId];
    onChange({ ...tarefa, dependencias: next });
  };
  const depNames = tarefa.dependencias
    .map(depId => allTarefas.find(t => t.id === depId))
    .filter(Boolean);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        </button>
        <Input
          value={tarefa.titulo}
          onChange={e => onChange({ ...tarefa, titulo: e.target.value })}
          placeholder="Título da tarefa *"
          className="flex-1 h-8 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!expanded && (
        <div className="flex items-center gap-2 flex-wrap pl-6">
          {coluna && (
            <Badge variant="outline" className="text-xs" style={{ borderColor: coluna.cor, color: coluna.cor }}>{coluna.nome}</Badge>
          )}
          {prio && <Badge className={cn("text-xs border-0", prio.color)}>{prio.label}</Badge>}
          {tarefa.responsaveis.length > 0 && <span className="text-xs text-muted-foreground">👤 {tarefa.responsaveis.join(", ")}</span>}
          {tarefa.prazo > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />{tarefa.prazo} {tarefa.prazo === 1 ? "dia" : "dias"}
            </span>
          )}
          {depNames.length > 0 && (
            <span className="text-xs text-muted-foreground">🔗 Depende de: {depNames.map(d => d!.titulo || "Sem título").join(", ")}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-3 pl-6 pt-1">
          <div><Label className="text-xs">Descrição</Label><Textarea value={tarefa.descricao} onChange={e => onChange({ ...tarefa, descricao: e.target.value })} placeholder="Detalhes..." className="text-sm min-h-[60px]" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Coluna</Label>
              <Select value={tarefa.colunaId} onValueChange={v => onChange({ ...tarefa, colunaId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colunas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={tarefa.prioridade} onValueChange={v => onChange({ ...tarefa, prioridade: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Responsável(is)</Label>
            {membros.length > 0 ? (
              <div className="mt-1 space-y-1.5 max-h-32 overflow-y-auto rounded-md border p-2">
                {membros.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`t-${tarefa.id}-m-${m.id}`}
                      checked={tarefa.responsaveis.includes(m.nome)}
                      onCheckedChange={() => toggleResponsavel(m.nome)}
                    />
                    <label htmlFor={`t-${tarefa.id}-m-${m.id}`} className="text-xs cursor-pointer">{m.nome}</label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Nenhum funcionário cadastrado.</p>
            )}
          </div>

          <div>
            <Label className="text-xs">Prazo (dias)</Label>
            <Input type="number" min={0} value={tarefa.prazo} onChange={e => onChange({ ...tarefa, prazo: Number(e.target.value) })} className="h-8 text-sm" placeholder="Ex: 7" />
          </div>

          {otherTarefas.length > 0 && (
            <details className="group">
              <summary className="text-xs font-medium cursor-pointer select-none flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Depende de {tarefa.dependencias.length > 0 && `(${tarefa.dependencias.length})`}
              </summary>
              <div className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto rounded-md border p-2">
                {otherTarefas.map((ot) => {
                  const otIndex = allTarefas.findIndex(at => at.id === ot.id);
                  return (
                    <div key={ot.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`dep-${tarefa.id}-${ot.id}`}
                        checked={tarefa.dependencias.includes(ot.id)}
                        onCheckedChange={() => toggleDependencia(ot.id)}
                      />
                      <label htmlFor={`dep-${tarefa.id}-${ot.id}`} className="text-xs cursor-pointer">
                        <span className="font-mono text-muted-foreground mr-1">#{otIndex + 1}</span>
                        {ot.titulo || "Sem título"}
                      </label>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Product Dialog (create/edit) ───
function ProdutoDialog({
  editando,
  existingTarefas,
  onClose,
}: {
  editando?: ProdutoTemplate | null;
  existingTarefas?: ProdutoTemplateTarefa[];
  onClose: () => void;
}) {
  const { criarTemplate, atualizarTemplate, adicionarTarefa, atualizarTarefa, excluirTarefa } = useProdutoTemplateMutations();
  const { membros } = useTarefasMembros();
  const { colunas } = useTarefas();

  const isEditing = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [descricao, setDescricao] = useState(editando?.descricao || "");
  const [tarefas, setTarefas] = useState<TarefaLocal[]>(
    existingTarefas ? existingTarefas.map(tarefaDbToLocal) : []
  );
  // After loading, resolve dependencias from ordem indexes to local IDs
  useState(() => {
    if (existingTarefas && existingTarefas.length > 0) {
      setTarefas(prev => {
        const resolved = prev.map(t => {
          const meta = parseTarefaMeta(existingTarefas.find(et => et.id === t.id)?.descricao || null);
          if (meta.dependencias && Array.isArray(meta.dependencias)) {
            const depIds = (meta.dependencias as number[])
              .map(ordem => prev[ordem]?.id)
              .filter(Boolean);
            return { ...t, dependencias: depIds };
          }
          return t;
        });
        return resolved;
      });
    }
  });
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addTarefa = () => {
    setTarefas(prev => [...prev, {
      id: gerarId(),
      titulo: "",
      descricao: "",
      responsaveis: [],
      prioridade: "media",
      prazo: 0,
      colunaId: colunas[0]?.id || "",
      dependencias: [],
    }]);
  };

  const updateTarefa = (index: number, t: TarefaLocal) => {
    setTarefas(prev => prev.map((item, i) => i === index ? t : item));
  };

  const removeTarefa = (index: number) => {
    const t = tarefas[index];
    if (existingTarefas?.some(et => et.id === t.id)) {
      setRemovedIds(prev => [...prev, t.id]);
    }
    // Remove task and clean up dependencias referencing it
    setTarefas(prev => prev
      .filter((_, i) => i !== index)
      .map(item => ({
        ...item,
        dependencias: item.dependencias.filter(d => d !== t.id),
      }))
    );
  };

  const handleSubmit = async () => {
    if (!nome.trim()) { toast.error("Nome do produto é obrigatório"); return; }
    const invalidTasks = tarefas.filter(t => !t.titulo.trim());
    if (invalidTasks.length > 0) { toast.error("Todas as tarefas precisam ter um título"); return; }

    setSaving(true);
    try {
      let templateId = editando?.id;

      if (isEditing && templateId) {
        await atualizarTemplate.mutateAsync({ id: templateId, nome: nome.trim(), descricao: descricao.trim() || null });
      } else {
        const created = await criarTemplate.mutateAsync({ nome: nome.trim(), descricao: descricao.trim() || undefined });
        templateId = (created as any).id;
      }

      // Delete removed tasks
      for (const id of removedIds) {
        await excluirTarefa.mutateAsync(id);
      }

      // Upsert tasks
      for (let i = 0; i < tarefas.length; i++) {
        const t = tarefas[i];
        const desc = tarefaLocalToDesc(t, tarefas);
        const isExisting = existingTarefas?.some(et => et.id === t.id);

        if (isExisting) {
          await atualizarTarefa.mutateAsync({ id: t.id, titulo: t.titulo.trim(), descricao: desc, ordem: i });
        } else {
          await adicionarTarefa.mutateAsync({ produto_template_id: templateId!, titulo: t.titulo.trim(), descricao: desc, ordem: i });
        }
      }

      toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>Crie um pacote de tarefas que pode ser atribuído a clientes</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-2">
            <Label>Nome do Produto *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Pacote Redes Sociais" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o produto..." />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Tarefas do Produto</Label>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={addTarefa}>
                <Plus className="h-3.5 w-3.5" /> Adicionar Tarefa
              </Button>
            </div>

            {tarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma tarefa adicionada. Clique em "Adicionar Tarefa" para começar.
              </p>
            ) : (
              <SortableTaskList
                tarefas={tarefas}
                setTarefas={setTarefas}
                updateTarefa={updateTarefa}
                removeTarefa={removeTarefa}
                membros={membros}
                colunas={colunas}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───
export default function ProdutosTarefas() {
  const { data: templates = [], isLoading } = useProdutoTemplates();
  const { excluirTemplate } = useProdutoTemplateMutations();
  const [dialogState, setDialogState] = useState<{ mode: "create" | "edit"; template?: ProdutoTemplate } | null>(null);
  const [atribuirTemplate, setAtribuirTemplate] = useState<ProdutoTemplate | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = templates.filter(t =>
    t.nome.toLowerCase().includes(busca.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleExcluir = (id: string) => {
    excluirTemplate.mutate(id, {
      onSuccess: () => toast.success("Produto removido"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6" />
            Produtos
          </h1>
          <p className="text-muted-foreground">Configure produtos com templates de tarefas automáticas</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />

      {filtrados.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum produto cadastrado</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(template => (
            <ProdutoCard
              key={template.id}
              template={template}
              onEdit={() => setDialogState({ mode: "edit", template })}
              onDelete={() => handleExcluir(template.id)}
              onAtribuir={() => {}}
              onDuplicar={() => {}}
            />
          ))}
        </div>
      )}

      {dialogState && (
        dialogState.mode === "create" ? (
          <ProdutoDialog onClose={() => setDialogState(null)} />
        ) : (
          <ProdutoDialogEditWrapper
            template={dialogState.template!}
            onClose={() => setDialogState(null)}
          />
        )
      )}
    </div>
  );
}

// Wrapper to load existing tasks before opening edit dialog
function ProdutoDialogEditWrapper({ template, onClose }: { template: ProdutoTemplate; onClose: () => void }) {
  const { data: tarefas, isLoading } = useProdutoTemplateTarefas(template.id);

  if (isLoading) return null;

  return (
    <ProdutoDialog
      editando={template}
      existingTarefas={tarefas || []}
      onClose={onClose}
    />
  );
}

// ─── Product card ───
function ProdutoCard({
  template,
  onEdit,
  onDelete,
  onAtribuir,
  onDuplicar,
}: {
  template: ProdutoTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onAtribuir?: () => void;
  onDuplicar?: () => void;
}) {
  const { data: tarefas = [] } = useProdutoTemplateTarefas(template.id);
  const MAX_VISIBLE = 3;
  const visibleTarefas = tarefas.slice(0, MAX_VISIBLE);
  const remaining = tarefas.length - MAX_VISIBLE;

  return (
    <Card className="p-4 flex flex-col gap-3 hover:bg-accent/30 transition-colors">
      <div>
        <p className="font-semibold text-sm">{template.nome}</p>
        {template.descricao && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.descricao}</p>
        )}
      </div>

      {tarefas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground italic">
            {tarefas.length} tarefa{tarefas.length !== 1 ? "s" : ""} incluída{tarefas.length !== 1 ? "s" : ""}:
          </p>
          <ul className="space-y-0.5">
            {visibleTarefas.map(t => (
              <li key={t.id} className="text-xs text-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 shrink-0" />
                <span className="truncate">{t.titulo}</span>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground pl-3">+{remaining} mais...</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 pt-1 border-t border-border mt-auto">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          onClick={onAtribuir}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Atribuir
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={onDuplicar}>
          <Copy className="h-3.5 w-3.5" />
          Duplicar
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
