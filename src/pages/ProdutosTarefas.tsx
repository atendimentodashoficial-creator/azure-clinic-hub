import { useState } from "react";
import { useTiposReuniao } from "@/hooks/useTiposReuniao";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
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
import { Switch } from "@/components/ui/switch";
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
  comissao: number;
  tipoTarefaId: string;
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
    comissao: meta.comissao || 0,
    tipoTarefaId: meta.tipo_tarefa_id || "",
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
    comissao: t.comissao > 0 ? t.comissao : undefined,
    tipo_tarefa_id: t.tipoTarefaId || undefined,
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
  const { tipos: tiposTarefas } = useTiposTarefas();
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
          {tarefa.comissao > 0 && (
            <span className="text-xs text-primary flex items-center gap-1">
              💰 R$ {tarefa.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prazo (dias)</Label>
              <Input type="number" min={0} value={tarefa.prazo} onChange={e => onChange({ ...tarefa, prazo: Number(e.target.value) })} className="h-8 text-sm" placeholder="Ex: 7" />
            </div>
            <div>
              <Label className="text-xs">Comissão (R$)</Label>
              <Input type="number" min={0} step={0.01} value={tarefa.comissao || ""} onChange={e => onChange({ ...tarefa, comissao: Number(e.target.value) })} className="h-8 text-sm" placeholder="0,00" />
            </div>
          </div>

          {tiposTarefas.filter(t => t.ativo !== false).length > 0 && (
            <div>
              <Label className="text-xs">Tipo de Tarefa</Label>
              <Select value={tarefa.tipoTarefaId} onValueChange={v => onChange({ ...tarefa, tipoTarefaId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {tiposTarefas.filter(t => t.ativo !== false).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
  const { data: tiposReuniao = [] } = useTiposReuniao();

  const isEditing = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [descricao, setDescricao] = useState(editando?.descricao || "");
  const [requerReuniao, setRequerReuniao] = useState(editando?.requer_reuniao || false);
  const [duracaoReuniao, setDuracaoReuniao] = useState(editando?.duracao_reuniao || 60);
  const [tipoReuniaoId, setTipoReuniaoId] = useState<string>(editando?.tipo_reuniao_id || "");
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
      comissao: 0,
      tipoTarefaId: "",
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
        await atualizarTemplate.mutateAsync({ id: templateId, nome: nome.trim(), descricao: descricao.trim() || null, requer_reuniao: requerReuniao, duracao_reuniao: duracaoReuniao, tipo_reuniao_id: tipoReuniaoId || null });
      } else {
        const created = await criarTemplate.mutateAsync({ nome: nome.trim(), descricao: descricao.trim() || undefined, requer_reuniao: requerReuniao, duracao_reuniao: duracaoReuniao, tipo_reuniao_id: tipoReuniaoId || null });
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

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Requer Reunião</Label>
              <p className="text-xs text-muted-foreground">Ao atribuir, agendar uma reunião com o cliente</p>
            </div>
            <Switch checked={requerReuniao} onCheckedChange={setRequerReuniao} />
          </div>

          {requerReuniao && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Duração da Reunião (minutos)</Label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={duracaoReuniao}
                  onChange={e => setDuracaoReuniao(Number(e.target.value) || 60)}
                  placeholder="60"
                />
              </div>
              {tiposReuniao.filter(t => t.ativo).length > 0 && (
                <div className="space-y-2">
                  <Label>Tipo de Reunião</Label>
                  <Select value={tipoReuniaoId} onValueChange={(v) => {
                    const newId = v === "none" ? "" : v;
                    setTipoReuniaoId(newId);
                    if (newId) {
                      const tipo = tiposReuniao.find(t => t.id === newId);
                      if (tipo?.duracao_minutos) setDuracaoReuniao(tipo.duracao_minutos);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {tiposReuniao.filter(t => t.ativo).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
  const { excluirTemplate, reordenarTemplates } = useProdutoTemplateMutations();
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

  const productSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleProductDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtrados.findIndex(t => t.id === active.id);
    const newIndex = filtrados.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filtrados, oldIndex, newIndex);
    const updates = reordered.map((t, i) => ({ id: t.id, ordem: i }));
    reordenarTemplates.mutate(updates);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6" />
          Produtos
        </h1>
        <p className="text-muted-foreground">Configure produtos com templates de tarefas automáticas</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum produto cadastrado</p>
      ) : (
        <DndContext sensors={productSensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
          <SortableContext items={filtrados.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtrados.map(template => (
                <SortableProdutoCard
                  key={template.id}
                  template={template}
                  onEdit={() => setDialogState({ mode: "edit", template })}
                  onDelete={() => handleExcluir(template.id)}
                  onAtribuir={() => setAtribuirTemplate(template)}
                  onDuplicar={() => {}}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

      {atribuirTemplate && (
        <AtribuirProdutoDialog
          template={atribuirTemplate}
          open={!!atribuirTemplate}
          onClose={() => setAtribuirTemplate(null)}
        />
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

// ─── Sortable Product card wrapper ───
function SortableProdutoCard(props: {
  template: ProdutoTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onAtribuir?: () => void;
  onDuplicar?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.template.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ProdutoCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── Product card ───
function ProdutoCard({
  template,
  onEdit,
  onDelete,
  onAtribuir,
  onDuplicar,
  dragHandleProps,
}: {
  template: ProdutoTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onAtribuir?: () => void;
  onDuplicar?: () => void;
  dragHandleProps?: Record<string, any>;
}) {
  const { data: tarefas = [] } = useProdutoTemplateTarefas(template.id);
  const MAX_VISIBLE = 3;
  const visibleTarefas = tarefas.slice(0, MAX_VISIBLE);
  const remaining = tarefas.length - MAX_VISIBLE;

  return (
    <Card className="p-4 flex flex-col gap-2 hover:bg-accent/30 transition-colors h-full">
      <div className="flex items-start gap-2">
        {dragHandleProps && (
          <button type="button" {...dragHandleProps} className="cursor-grab active:cursor-grabbing touch-none mt-0.5">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{template.nome}</p>
          {template.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.descricao}</p>
          )}
        </div>
      </div>

      {tarefas.length > 0 && (
        <div className="space-y-1.5 flex-1">
          <p className="text-xs text-primary font-medium">
            {tarefas.length} tarefa{tarefas.length !== 1 ? "s" : ""} incluída{tarefas.length !== 1 ? "s" : ""}:
          </p>
          <ul className="space-y-0.5">
            {visibleTarefas.map(t => (
              <li key={t.id} className="text-xs text-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                <span className="truncate">{t.titulo}</span>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground pl-3">+{remaining} mais...</p>
          )}
        </div>
      )}

      {tarefas.length === 0 && <div className="flex-1" />}

      <div className="flex items-center gap-1 pt-2 border-t border-border mt-auto">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          onClick={onAtribuir}
        >
          <Play className="h-3 w-3 fill-current" />
          Atribuir
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}>
          <Edit className="h-3 w-3" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onDuplicar}>
          <Copy className="h-3 w-3" />
          Duplicar
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
