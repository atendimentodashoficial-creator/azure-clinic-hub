import { useState, useEffect } from "react";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useMembroAtual } from "@/hooks/useMembroAtual";
import { useUserRole } from "@/hooks/useUserRole";
import { useOwnerId } from "@/hooks/useOwnerId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, MoreVertical, GripVertical, Calendar, Trash2, ListChecks, Building2, User, Users, DollarSign, Video, Play } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TarefaTimer } from "@/components/tarefas/TarefaTimer";
import { TarefaDetalhesDialog } from "@/components/tarefas/TarefaDetalhesDialog";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

// Helper to get column index (ordem) for a given coluna_id
function getColOrdem(colunas: TarefaColuna[], colunaId: string): number {
  const col = colunas.find(c => c.id === colunaId);
  return col?.ordem ?? -1;
}

// Compute timer updates when moving between columns
function computeTimerUpdates(
  tarefa: Tarefa,
  fromOrdem: number,
  toOrdem: number,
  lastColOrdem: number
): Partial<Tarefa> {
  const now = new Date().toISOString();
  const acumulado = calcAccumulated(tarefa);

  // Moving to column 1 (Em Progresso) — auto-start
  if (toOrdem === 1) {
    return { timer_inicio: now, timer_status: "rodando", tempo_acumulado_segundos: acumulado };
  }
  // Moving to column 2 (Aguardando Aprovação) — auto-pause
  if (toOrdem === 2) {
    return { timer_inicio: null, timer_status: "pausado", tempo_acumulado_segundos: acumulado };
  }
  // Moving to column 3 (Em Revisão) — pause, needs manual start
  if (toOrdem === 3) {
    return { timer_inicio: null, timer_status: "pausado_revisao", tempo_acumulado_segundos: acumulado };
  }
  // Moving to last column (Concluído) — finalize
  if (toOrdem === lastColOrdem) {
    return { timer_inicio: null, timer_status: "concluido", tempo_acumulado_segundos: acumulado };
  }
  // Moving back to A Fazer (ordem 0) — reset
  if (toOrdem === 0) {
    return { timer_inicio: null, timer_status: "parado", tempo_acumulado_segundos: acumulado };
  }

  return {};
}

function calcAccumulated(tarefa: Tarefa): number {
  if (tarefa.timer_status === "rodando" && tarefa.timer_inicio) {
    const diff = Math.floor((Date.now() - new Date(tarefa.timer_inicio).getTime()) / 1000);
    return tarefa.tempo_acumulado_segundos + Math.max(0, diff);
  }
  return tarefa.tempo_acumulado_segundos;
}

function NovaTarefaDialog({ colunas, onSubmit }: { colunas: TarefaColuna[]; onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [comissao, setComissao] = useState("");
  const [tipoTarefaId, setTipoTarefaId] = useState<string>("");
  const { membros: profissionais } = useTarefasMembros();
  const { clientes } = useTarefasClientes();
  const { tipos: tiposTarefas } = useTiposTarefas();
  const toggleResponsavel = (nome: string) => {
    setResponsaveisSelecionados(prev =>
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  const handleSubmit = () => {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    const primeiraColuna = colunas[0]?.id || "";
    onSubmit({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      responsavel_nome: responsaveisSelecionados.length > 0 ? responsaveisSelecionados.join(", ") : undefined,
      cliente_id: clienteId && clienteId !== "none" ? clienteId : undefined,
      prioridade,
      data_limite: dataLimite || undefined,
      coluna_id: primeiraColuna,
      comissao: comissao ? parseFloat(comissao) : undefined,
      tipo_tarefa_id: tipoTarefaId && tipoTarefaId !== "none" ? tipoTarefaId : undefined,
    });
    setTitulo(""); setDescricao(""); setResponsaveisSelecionados([]); setClienteId(""); setPrioridade("media"); setDataLimite(""); setComissao(""); setTipoTarefaId("");
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
          <div>
            <Label className="mb-1.5 block text-sm">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Criar landing page" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">Cliente</Label>
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
            <Label className="mb-1.5 block text-sm">Responsável(is)</Label>
            {profissionais.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
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
              <Label className="mb-1.5 block text-sm">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Data limite</Label>
              <Input type="date" value={dataLimite} onChange={e => setDataLimite(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Comissão (R$)
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={comissao}
              onChange={e => setComissao(e.target.value)}
              placeholder="0,00 (opcional)"
            />
            <p className="text-xs text-muted-foreground mt-1">Valor da comissão ao concluir a tarefa</p>
          </div>

          {tiposTarefas.filter(t => t.ativo !== false).length > 0 && (
            <div>
              <Label className="mb-1.5 block text-sm">Tipo de Tarefa</Label>
              <Select value={tipoTarefaId} onValueChange={setTipoTarefaId}>
                <SelectTrigger><SelectValue placeholder="Selecione um tipo (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {tiposTarefas.filter(t => t.ativo !== false).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={handleSubmit} className="w-full mt-4">Criar Tarefa</Button>
      </DialogContent>
    </Dialog>
  );
}

function DraggableTarefaCard({ tarefa, colunas, clientes, membrosNomes, reunioesMap, isFuncionario, onDelete, onStartTimer }: {
  tarefa: Tarefa;
  colunas: TarefaColuna[];
  clientes: { id: string; nome: string; empresa: string | null }[];
  membrosNomes: string[];
  reunioesMap?: Record<string, { data_reuniao: string; status: string }>;
  isFuncionario: boolean;
  onDelete: (id: string) => void;
  onStartTimer: (id: string) => void;
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
        membrosNomes={membrosNomes}
        reunioesMap={reunioesMap}
        isFuncionario={isFuncionario}
        onDelete={onDelete}
        onStartTimer={onStartTimer}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function TarefaCardContent({ tarefa, colunas, clientes, membrosNomes, reunioesMap, isFuncionario, onDelete, onStartTimer, dragHandleProps }: {
  tarefa: Tarefa;
  colunas: TarefaColuna[];
  clientes: { id: string; nome: string; empresa: string | null }[];
  membrosNomes?: string[];
  reunioesMap?: Record<string, { data_reuniao: string; status: string }>;
  isFuncionario?: boolean;
  onDelete?: (id: string) => void;
  onStartTimer?: (id: string) => void;
  dragHandleProps?: Record<string, any>;
}) {
  const prio = PRIORIDADES.find(p => p.value === tarefa.prioridade) || PRIORIDADES[1];
  const cliente = tarefa.cliente_id ? clientes.find(c => c.id === tarefa.cliente_id) : null;
  const reuniao = tarefa.reuniao_id && reunioesMap ? reunioesMap[tarefa.reuniao_id] : null;
  const colOrdem = getColOrdem(colunas, tarefa.coluna_id);

  // Employees can't see details when task is in "A Fazer" (ordem 0)
  const hideDetails = isFuncionario && colOrdem === 0;
  // In "Em Revisão" (ordem 3) with pausado_revisao, employee needs to start timer to see details
  const needsManualStart = isFuncionario && colOrdem === 3 && tarefa.timer_status === "pausado_revisao";

  const renderResponsaveis = () => {
    if (!tarefa.responsavel_nome) return null;
    const nomes = tarefa.responsavel_nome.split(",").map(n => n.trim());
    return (
      <p className="text-xs mt-1 flex flex-wrap gap-x-1">
        {nomes.map((nome, i) => {
          const existe = !membrosNomes || membrosNomes.some(m => m.toLowerCase() === nome.toLowerCase());
          return (
            <span key={i} className={existe ? "text-muted-foreground" : "text-destructive"}>
              {nome}{i < nomes.length - 1 ? "," : ""}
            </span>
          );
        })}
      </p>
    );
  };

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
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {needsManualStart && onStartTimer && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary"
                  onClick={() => onStartTimer(tarefa.id)}
                  title="Iniciar revisão"
                >
                  <Play className="h-3 w-3" />
                </Button>
              )}
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
          </div>

          {hideDetails ? (
            <p className="text-xs text-muted-foreground mt-1 italic">Detalhes disponíveis ao iniciar</p>
          ) : needsManualStart ? (
            <p className="text-xs text-muted-foreground mt-1 italic">Clique ▶ para ver as revisões</p>
          ) : (
            <>
              {renderResponsaveis()}
              {cliente && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {cliente.nome}
                </p>
              )}
              {reuniao && (
                <p className="text-xs mt-1 flex items-center gap-1 text-primary">
                  <Video className="h-3 w-3" />
                  {format(new Date(reuniao.data_reuniao), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge className={cn("text-xs border-0", prio.color)}>{prio.label}</Badge>
            {tarefa.data_limite && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(tarefa.data_limite + "T00:00:00"), "dd/MM/yyyy")}
              </span>
            )}
            <TarefaTimer
              timerStatus={tarefa.timer_status}
              timerInicio={tarefa.timer_inicio}
              tempoAcumulado={tarefa.tempo_acumulado_segundos}
            />
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
  const { colunas, tarefas, isLoading, criarTarefa, atualizarTarefa, excluirTarefa, moverTarefa, criarColuna, excluirColuna } = useTarefas();
  const { clientes } = useTarefasClientes();
  const { membros } = useTarefasMembros();
  const membrosNomes = membros.map(m => m.nome);
  const { membro } = useMembroAtual();
  const { role } = useUserRole();
  const { ownerId } = useOwnerId();
  const [activeTarefa, setActiveTarefa] = useState<Tarefa | null>(null);
  const isFuncionario = role === "funcionario";
  const [filtro, setFiltro] = useState<"minhas" | "todas">(isFuncionario ? "minhas" : "todas");

  const lastColOrdem = colunas.length > 0 ? colunas[colunas.length - 1].ordem : 4;

  // Fetch reunioes for tasks that have reuniao_id
  const reuniaoIds = tarefas.filter(t => t.reuniao_id).map(t => t.reuniao_id!);
  const { data: reunioesData } = useQuery({
    queryKey: ["tarefas-reunioes", reuniaoIds.sort().join(",")],
    queryFn: async () => {
      if (reuniaoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("reunioes")
        .select("id, data_reuniao, status")
        .in("id", reuniaoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: reuniaoIds.length > 0,
  });

  const reunioesMap: Record<string, { data_reuniao: string; status: string }> = {};
  (reunioesData || []).forEach((r: any) => { reunioesMap[r.id] = r; });

  // Filter tasks for employee "minhas" view
  const tarefasFiltradas = filtro === "minhas" && membro
    ? tarefas.filter(t => {
        if (!t.responsavel_nome) return false;
        const nomes = t.responsavel_nome.split(",").map(n => n.trim().toLowerCase());
        return nomes.includes(membro.nome?.toLowerCase());
      })
    : tarefas;

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

  const handleStartTimer = (id: string) => {
    atualizarTarefa.mutate({
      id,
      timer_inicio: new Date().toISOString(),
      timer_status: "rodando",
    } as any, {
      onSuccess: () => toast.success("Timer iniciado!"),
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

    if (over.data.current?.type === "column") {
      targetColunaId = over.data.current.colunaId;
    } else if (over.data.current?.type === "tarefa") {
      targetColunaId = over.data.current.tarefa.coluna_id;
    }

    if (!targetColunaId) return;

    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa || tarefa.coluna_id === targetColunaId) return;

    const fromOrdem = getColOrdem(colunas, tarefa.coluna_id);
    const toOrdem = getColOrdem(colunas, targetColunaId);

    // Compute timer updates
    const timerUpdates = computeTimerUpdates(tarefa, fromOrdem, toOrdem, lastColOrdem);

    const targetTarefas = tarefas.filter(t => t.coluna_id === targetColunaId);

    // First move the task
    moverTarefa.mutate(
      { id: tarefaId, coluna_id: targetColunaId, ordem: targetTarefas.length },
      {
        onSuccess: async () => {
          toast.success("Tarefa movida!");

          // Apply timer updates
          if (Object.keys(timerUpdates).length > 0) {
            await supabase.from("tarefas").update({
              ...timerUpdates,
              updated_at: new Date().toISOString(),
            } as any).eq("id", tarefaId);
          }

          // Auto-create commission when moved to last column (Concluído) and has commission
          const targetColuna = colunas.find(c => c.id === targetColunaId);
          const lastColuna = colunas[colunas.length - 1];
          if (tarefa.comissao && tarefa.comissao > 0 && targetColuna?.id === lastColuna?.id && tarefa.responsavel_nome && ownerId) {
            const responsaveis = tarefa.responsavel_nome.split(",").map(n => n.trim());
            const comissaoPorPessoa = tarefa.comissao / responsaveis.length;
            for (const nome of responsaveis) {
              await supabase.from("comissoes").insert({
                tarefa_id: tarefa.id,
                user_id: ownerId,
                membro_nome: nome,
                valor: comissaoPorPessoa,
                status: "pendente",
              });
            }
            toast.info("Comissão criada! Aguardando aprovação.");
          }
        },
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
        <div className="flex items-center gap-3">
          {isFuncionario && (
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as "minhas" | "todas")}>
              <TabsList>
                <TabsTrigger value="minhas" className="gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Minhas
                </TabsTrigger>
                <TabsTrigger value="todas" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Todas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <NovaTarefaDialog colunas={colunas} onSubmit={handleCriar} />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 220px)" }}>
          {colunas.map(coluna => {
            const tarefasColuna = tarefasFiltradas.filter(t => t.coluna_id === coluna.id);
            return (
              <div key={coluna.id} className="flex-shrink-0 w-80">
                <div className="rounded-xl border-2 p-4 space-y-3 h-full" style={{ borderColor: coluna.cor }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{coluna.nome}</h3>
                      <p className="text-xs text-muted-foreground">{tarefasColuna.length} tarefa(s)</p>
                    </div>
                    {!isFuncionario && (
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
                    )}
                  </div>

                  <DroppableColumn coluna={coluna}>
                    {tarefasColuna.map(tarefa => (
                      <DraggableTarefaCard
                        key={tarefa.id}
                        tarefa={tarefa}
                        colunas={colunas}
                        clientes={clientes}
                        membrosNomes={membrosNomes}
                        reunioesMap={reunioesMap}
                        isFuncionario={isFuncionario}
                        onDelete={handleExcluir}
                        onStartTimer={handleStartTimer}
                      />
                    ))}
                  </DroppableColumn>
                </div>
              </div>
            );
          })}

          {!isFuncionario && (
            <div className="flex-shrink-0 w-80">
              <NovaColunaButton onSubmit={(data) => criarColuna.mutate(data, { onSuccess: () => toast.success("Coluna criada!") })} />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTarefa && (
            <div className="w-80 rotate-2">
              <TarefaCardContent
                tarefa={activeTarefa}
                colunas={colunas}
                clientes={clientes}
                membrosNomes={membrosNomes}
                reunioesMap={reunioesMap}
                isFuncionario={isFuncionario}
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
