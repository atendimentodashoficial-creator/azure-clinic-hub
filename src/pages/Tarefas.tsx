import { useState } from "react";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useProfissionais } from "@/hooks/useProfissionais";
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
import { Plus, MoreVertical, GripVertical, Calendar, Trash2, Edit, ArrowRight, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

function NovaTarefaDialog({ colunaId, colunas, onSubmit }: { colunaId: string; colunas: TarefaColuna[]; onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [subtarefasTotal, setSubtarefasTotal] = useState(0);
  const { data: profissionais = [] } = useProfissionais(true);

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
      prioridade,
      data_limite: dataLimite || undefined,
      coluna_id: colunaId,
      subtarefas_total: subtarefasTotal,
    });
    setTitulo(""); setDescricao(""); setResponsaveisSelecionados([]); setPrioridade("media"); setDataLimite(""); setSubtarefasTotal(0);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Título *</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Criar landing page" /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." /></div>
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
              <p className="text-xs text-muted-foreground mt-1">Nenhum funcionário cadastrado. Cadastre em Profissionais.</p>
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
          <Button onClick={handleSubmit} className="w-full">Criar Tarefa</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TarefaCard({ tarefa, colunas, onUpdate, onDelete, onMove }: {
  tarefa: Tarefa;
  colunas: TarefaColuna[];
  onUpdate: (data: Partial<Tarefa> & { id: string }) => void;
  onDelete: (id: string) => void;
  onMove: (data: { id: string; coluna_id: string; ordem: number }) => void;
}) {
  const prio = PRIORIDADES.find(p => p.value === tarefa.prioridade) || PRIORIDADES[1];
  const outrasColunas = colunas.filter(c => c.id !== tarefa.coluna_id);

  return (
    <Card className="p-3 bg-card border-l-4 hover:bg-accent/30 transition-colors group" style={{ borderLeftColor: colunas.find(c => c.id === tarefa.coluna_id)?.cor || '#f59e0b' }}>
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {outrasColunas.map(col => (
                  <DropdownMenuItem key={col.id} onClick={() => onMove({ id: tarefa.id, coluna_id: col.id, ordem: 0 })}>
                    <ArrowRight className="h-4 w-4 mr-2" /> Mover para {col.nome}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => onDelete(tarefa.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tarefa.responsavel_nome && (
            <p className="text-xs text-muted-foreground mt-1">{tarefa.responsavel_nome}</p>
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

export default function Tarefas() {
  const { colunas, tarefas, isLoading, criarTarefa, atualizarTarefa, excluirTarefa, moverTarefa, criarColuna, excluirColuna } = useTarefas();

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

  const handleMover = (data: { id: string; coluna_id: string; ordem: number }) => {
    moverTarefa.mutate(data, {
      onSuccess: () => toast.success("Tarefa movida!"),
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
            <ListChecks className="h-6 w-6" />
            Tarefas
          </h1>
          <p className="text-muted-foreground">Gerencie as tarefas da equipe</p>
        </div>
      </div>

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

                <div className="space-y-2">
                  {tarefasColuna.map(tarefa => (
                    <TarefaCard
                      key={tarefa.id}
                      tarefa={tarefa}
                      colunas={colunas}
                      onUpdate={(d) => atualizarTarefa.mutate(d)}
                      onDelete={handleExcluir}
                      onMove={handleMover}
                    />
                  ))}
                </div>

                <NovaTarefaDialog colunaId={coluna.id} colunas={colunas} onSubmit={handleCriar} />
              </div>
            </div>
          );
        })}

        {/* Add column */}
        <div className="flex-shrink-0 w-80">
          <NovaColunaButton onSubmit={(data) => criarColuna.mutate(data, { onSuccess: () => toast.success("Coluna criada!") })} />
        </div>
      </div>
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
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Em Revisão" /></div>
          <div><Label>Cor</Label><Input type="color" value={cor} onChange={e => setCor(e.target.value)} /></div>
          <Button onClick={() => { if (!nome.trim()) { toast.error("Nome obrigatório"); return; } onSubmit({ nome, cor }); setNome(""); setOpen(false); }} className="w-full">Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
