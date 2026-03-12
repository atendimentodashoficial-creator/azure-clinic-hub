import { useState } from "react";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useProdutoTemplates, useProdutoTemplateTarefas } from "@/hooks/useProdutoTemplates";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable, closestCenter } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, MoreVertical, GripVertical, Calendar, Trash2, ListChecks, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

function NovaTarefaDialog({ colunas, onSubmit }: { colunas: TarefaColuna[]; onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [subtarefasTotal, setSubtarefasTotal] = useState(0);
  const [colunaId, setColunaId] = useState(colunas[0]?.id || "");
  const { membros: profissionais } = useTarefasMembros();
  const { clientes } = useTarefasClientes();

  const toggleResponsavel = (nome: string) => {
    setResponsaveisSelecionados(prev =>
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  const handleSubmit = () => {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    onSubmit({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      responsavel_nome: responsaveisSelecionados.length > 0 ? responsaveisSelecionados.join(", ") : undefined,
      cliente_id: clienteId && clienteId !== "none" ? clienteId : undefined,
      prioridade,
      data_limite: dataLimite || undefined,
      coluna_id: colunaId,
      subtarefas_total: subtarefasTotal,
    });
    setTitulo(""); setDescricao(""); setResponsaveisSelecionados([]); setClienteId(""); setPrioridade("media"); setDataLimite(""); setSubtarefasTotal(0); setColunaId(colunas[0]?.id || "");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div><Label>Título *</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Criar landing page" /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." /></div>
          
          <div>
            <Label>Coluna *</Label>
            <Select value={colunaId} onValueChange={setColunaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
              <SelectContent>
                {colunas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.empresa ? `(${c.empresa})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável(is)</Label>
            {profissionais.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                {profissionais.map(prof => (
                  <div key={prof.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`prof-${prof.id}`}
                      checked={responsaveisSelecionados.includes(prof.nome)}
                      onCheckedChange={() => toggleResponsavel(prof.nome)}
                    />
                    <label htmlFor={`prof-${prof.id}`} className="text-sm cursor-pointer">{prof.nome}</label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Nenhum funcionário cadastrado.</p>
            )}
            {responsaveisSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {responsaveisSelecionados.map(nome => (
                  <Badge key={nome} variant="secondary" className="text-xs">{nome}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data limite</Label><Input type="date" value={dataLimite} onChange={e => setDataLimite(e.target.value)} /></div>
          </div>
          <div>
            <Label>Subtarefas (total)</Label>
            <Input type="number" min={0} value={subtarefasTotal} onChange={e => setSubtarefasTotal(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={handleSubmit} className="w-full mt-4">Criar Tarefa</Button>
      </DialogContent>
    </Dialog>
  );
}

function DraggableTarefaCard({ tarefa, colunas, clientes, onDelete }: {
  tarefa: Tarefa;
  colunas: TarefaColuna[];
  clientes: { id: string; nome: string; empresa: string | null }[];
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
    data: { type: "tarefa", tarefa },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TarefaCardContent
        tarefa={tarefa}
        colunas={colunas}
        clientes={clientes}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function TarefaCardContent({ tarefa, colunas, clientes, onDelete, dragHandleProps }: {
  tarefa: Tarefa;
  colunas: TarefaColuna[];
  clientes: { id: string; nome: string; empresa: string | null }[];
  onDelete?: (id: string) => void;
  dragHandleProps?: Record<string, any>;
}) {
  const prio = PRIORIDADES.find(p => p.value === tarefa.prioridade) || PRIORIDADES[1];
  const cliente = tarefa.cliente_id ? clientes.find(c => c.id === tarefa.cliente_id) : null;

  return (
    <Card className="p-3 bg-card border-l-4 hover:bg-accent/30 transition-colors group" style={{ borderLeftColor: colunas.find(c => c.id === tarefa.coluna_id)?.cor || '#f59e0b' }}>
      <div className="flex items-start gap-2">
        <div {...dragHandleProps} className="mt-1 shrink-0 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">{tarefa.titulo}</span>
              {tarefa.subtarefas_total > 0 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {tarefa.subtarefas_concluidas}/{tarefa.subtarefas_total}
                </Badge>
              )}
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(tarefa.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {tarefa.responsavel_nome && (
            <p className="text-xs text-muted-foreground mt-1">{tarefa.responsavel_nome}</p>
          )}
          {cliente && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {cliente.nome}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge className={cn("text-xs border-0", prio.color)}>{prio.label}</Badge>
            {tarefa.data_limite && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(tarefa.data_limite + "T00:00:00"), "dd/MM/yyyy")}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DroppableColumn({ coluna, children }: { coluna: TarefaColuna; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${coluna.id}`,
    data: { type: "column", colunaId: coluna.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("space-y-2 min-h-[60px] rounded-lg transition-colors p-1", isOver && "bg-primary/5")}
    >
      {children}
    </div>
  );
}

export default function Tarefas() {
  const { colunas, tarefas, isLoading, criarTarefa, excluirTarefa, moverTarefa, criarColuna, excluirColuna } = useTarefas();
  const { clientes } = useTarefasClientes();
  const [activeTarefa, setActiveTarefa] = useState<Tarefa | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCriar = (data: any) => {
    criarTarefa.mutate(data, {
      onSuccess: () => toast.success("Tarefa criada!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleExcluir = (id: string) => {
    excluirTarefa.mutate(id, {
      onSuccess: () => toast.success("Tarefa excluída"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tarefa = tarefas.find(t => t.id === active.id);
    if (tarefa) setActiveTarefa(tarefa);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTarefa(null);
    const { active, over } = event;
    if (!over) return;

    const tarefaId = active.id as string;
    let targetColunaId: string | null = null;

    // Dropped over a column
    if (over.data.current?.type === "column") {
      targetColunaId = over.data.current.colunaId;
    }
    // Dropped over another task — get its column
    else if (over.data.current?.type === "tarefa") {
      targetColunaId = over.data.current.tarefa.coluna_id;
    }

    if (!targetColunaId) return;

    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa || tarefa.coluna_id === targetColunaId) return;

    const targetTarefas = tarefas.filter(t => t.coluna_id === targetColunaId);
    moverTarefa.mutate(
      { id: tarefaId, coluna_id: targetColunaId, ordem: targetTarefas.length },
      {
        onSuccess: () => toast.success("Tarefa movida!"),
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Tarefas
          </h1>
          <p className="text-muted-foreground">Gerencie as tarefas da equipe</p>
        </div>
        <NovaTarefaDialog colunas={colunas} onSubmit={handleCriar} />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 220px)" }}>
          {colunas.map(coluna => {
            const tarefasColuna = tarefas.filter(t => t.coluna_id === coluna.id);
            return (
              <div key={coluna.id} className="flex-shrink-0 w-80">
                <div className="rounded-xl border-2 p-4 space-y-3 h-full" style={{ borderColor: coluna.cor }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{coluna.nome}</h3>
                      <p className="text-xs text-muted-foreground">{tarefasColuna.length} tarefa(s)</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => excluirColuna.mutate(coluna.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir coluna
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <DroppableColumn coluna={coluna}>
                    {tarefasColuna.map(tarefa => (
                      <DraggableTarefaCard
                        key={tarefa.id}
                        tarefa={tarefa}
                        colunas={colunas}
                        clientes={clientes}
                        onDelete={handleExcluir}
                      />
                    ))}
                  </DroppableColumn>

                  
                </div>
              </div>
            );
          })}

          <div className="flex-shrink-0 w-80">
            <NovaColunaButton onSubmit={(data) => criarColuna.mutate(data, { onSuccess: () => toast.success("Coluna criada!") })} />
          </div>
        </div>

        <DragOverlay>
          {activeTarefa && (
            <div className="w-80 rotate-2">
              <TarefaCardContent
                tarefa={activeTarefa}
                colunas={colunas}
                clientes={clientes}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function NovaColunaButton({ onSubmit }: { onSubmit: (data: { nome: string; cor: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#f59e0b");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-20 border-dashed gap-2">
          <Plus className="h-5 w-5" /> Nova Coluna
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Em Revisão" /></div>
          <div><Label>Cor</Label><Input type="color" value={cor} onChange={e => setCor(e.target.value)} /></div>
        </div>
        <Button onClick={() => { if (!nome.trim()) { toast.error("Nome obrigatório"); return; } onSubmit({ nome, cor }); setNome(""); setOpen(false); }} className="w-full mt-4">Criar</Button>
      </DialogContent>
    </Dialog>
  );
}
