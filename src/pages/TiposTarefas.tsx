import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTiposTarefas, TipoTarefa } from "@/hooks/useTiposTarefas";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Minus, Plus as PlusIcon, X } from "lucide-react";

const FILE_TYPES = [
  { key: "imagens", label: "Imagens" },
  { key: "videos", label: "Vídeos" },
  { key: "pdf", label: "PDF" },
  { key: "zip", label: "ZIP" },
  { key: "texto", label: "Texto" },
  { key: "qualquer", label: "Qualquer arquivo" },
];

// --- Sortable Item ---
function SortableTipoItem({ tipo, onEdit, onDelete, onToggleAtivo }: {
  tipo: TipoTarefa; onEdit: (t: TipoTarefa) => void; onDelete: (id: string) => void; onToggleAtivo: (t: TipoTarefa) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tipo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={cn(
      "flex items-center justify-between gap-2 p-3 rounded-lg border",
      tipo.ativo === false ? "opacity-50 bg-muted/50" : "bg-card"
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="min-w-0">
          <span className="font-medium text-sm truncate block">{tipo.nome}</span>
          {tipo.tipos_arquivo_permitidos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tipo.tipos_arquivo_permitidos.map(t => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{FILE_TYPES.find(f => f.key === t)?.label || t}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tipo)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(tipo.id)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
        <Switch checked={tipo.ativo !== false} onCheckedChange={() => onToggleAtivo(tipo)} />
      </div>
    </div>
  );
}

// --- File Limit Counter ---
function FileLimitCounter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border rounded-lg p-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(Math.max(0, value - 1))}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center text-sm font-mono">{value}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(value + 1)}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function TiposTarefas() {
  const { tipos, isLoading, createTipo, updateTipo, deleteTipo } = useTiposTarefas();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoTarefa | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formArquivos, setFormArquivos] = useState<string[]>([]);
  const [formLimites, setFormLimites] = useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleOpenCreate = () => {
    setEditingTipo(null);
    setFormNome("");
    setFormDescricao("");
    setFormArquivos([]);
    setFormLimites({});
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (tipo: TipoTarefa) => {
    setEditingTipo(tipo);
    setFormNome(tipo.nome);
    setFormDescricao(tipo.descricao || "");
    setFormArquivos(tipo.tipos_arquivo_permitidos);
    setFormLimites(tipo.limite_arquivos);
    setIsDialogOpen(true);
  };

  const toggleFileType = (key: string) => {
    if (key === "qualquer") {
      setFormArquivos(prev => prev.includes("qualquer") ? prev.filter(t => t !== "qualquer") : ["qualquer"]);
      return;
    }
    setFormArquivos(prev => {
      const filtered = prev.filter(t => t !== "qualquer");
      return filtered.includes(key) ? filtered.filter(t => t !== key) : [...filtered, key];
    });
  };

  const handleSave = async () => {
    if (!formNome.trim()) return;
    const payload = {
      nome: formNome,
      descricao: formDescricao || null,
      tipos_arquivo_permitidos: formArquivos,
      limite_arquivos: formLimites,
    };
    if (editingTipo) {
      await updateTipo.mutateAsync({ id: editingTipo.id, ...payload });
    } else {
      await createTipo.mutateAsync(payload);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await deleteTipo.mutateAsync(deleteId); setDeleteId(null); }
  };

  const handleToggleAtivo = async (tipo: TipoTarefa) => {
    await updateTipo.mutateAsync({ id: tipo.id, ativo: !tipo.ativo });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tipos.findIndex(t => t.id === active.id);
      const newIndex = tipos.findIndex(t => t.id === over.id);
      const newOrder = arrayMove(tipos, oldIndex, newIndex);
      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i].ordem !== i) {
          await updateTipo.mutateAsync({ id: newOrder[i].id, ordem: i });
        }
      }
    }
  };

  // File types that have limits shown
  const activeFileTypesForLimits = formArquivos.filter(t => t !== "qualquer");

  if (isLoading) {
    return (
      <Card><CardHeader><CardTitle className="text-lg font-semibold">Tipos de Tarefas</CardTitle></CardHeader>
        <CardContent className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg font-semibold">Tipos de Tarefas</CardTitle>
          <Button onClick={handleOpenCreate} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Tipo</Button>
        </CardHeader>
        <CardContent>
          {tipos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum tipo cadastrado.</p>
              <p className="text-sm mt-1">Crie tipos personalizados para suas tarefas.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tipos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {tipos.map(tipo => (
                    <SortableTipoItem key={tipo.id} tipo={tipo} onEdit={handleOpenEdit} onDelete={setDeleteId} onToggleAtivo={handleToggleAtivo} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Editar Tipo de Tarefa" : "Novo Tipo de Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="mb-2 block">Nome</Label>
              <Input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Design, Desenvolvimento..." />
            </div>
            <div className="space-y-2">
              <Label className="mb-2 block">Descrição (opcional)</Label>
              <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Descrição do tipo..." />
            </div>

            {/* File types */}
            <div className="space-y-2">
              <Label className="mb-2 block">Tipos de arquivo permitidos</Label>
              <div className="flex flex-wrap gap-2">
                {FILE_TYPES.map(ft => {
                  const selected = formArquivos.includes(ft.key);
                  return (
                    <button
                      key={ft.key}
                      type="button"
                      onClick={() => toggleFileType(ft.key)}
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      {ft.label}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File limits */}
            {activeFileTypesForLimits.length > 0 && (
              <div className="space-y-2">
                <Label className="mb-2 block">Quantidade de arquivos por tipo</Label>
                <p className="text-xs text-muted-foreground">Deixe 0 para quantidade ilimitada</p>
                <div className="space-y-2 mt-2">
                  {activeFileTypesForLimits.map(key => (
                    <FileLimitCounter
                      key={key}
                      label={FILE_TYPES.find(f => f.key === key)?.label || key}
                      value={formLimites[key] || 0}
                      onChange={v => setFormLimites(prev => ({ ...prev, [key]: v }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formNome.trim()}>{editingTipo ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O tipo será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
