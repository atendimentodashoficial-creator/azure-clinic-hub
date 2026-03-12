import { useState } from "react";
import {
  useProdutoTemplates,
  useProdutoTemplateTarefas,
  useProdutoTemplateMutations,
  ProdutoTemplate,
  ProdutoTemplateTarefa,
} from "@/hooks/useProdutoTemplates";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";
import { useTarefasClientes } from "@/hooks/useTarefasClientes";
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
  Building2,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "media", label: "Média", color: "bg-amber-500/20 text-amber-400" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-400" },
  { value: "urgente", label: "Urgente", color: "bg-red-700/20 text-red-300" },
];

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

  const resetForm = () => { setNome(""); setDescricao(""); };

  const handleSubmit = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    onSubmit({ ...(editando && { id: editando.id }), nome: nome.trim(), descricao: descricao.trim() || undefined });
    resetForm(); setOpen(false); onClose?.();
  };

  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) { resetForm(); onClose?.(); } };

  return (
    <Dialog open={isEditing ? true : open} onOpenChange={isEditing ? () => onClose?.() : handleOpenChange}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Produto</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Plano Mensal, Consultoria..." /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do produto..." /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEditing ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NovaTarefaTemplatDialog({
  templateId,
  ordem,
  onSuccess,
  editando,
  onClose,
}: {
  templateId: string;
  ordem: number;
  onSuccess: () => void;
  editando?: ProdutoTemplateTarefa | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEditing = !!editando;
  const { adicionarTarefa, atualizarTarefa } = useProdutoTemplateMutations();
  const { membros } = useTarefasMembros();
  const { clientes } = useTarefasClientes();
  const { colunas } = useTarefas();

  const [titulo, setTitulo] = useState(editando?.titulo || "");
  const [descricao, setDescricao] = useState(editando?.descricao || "");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [prioridade, setPrioridade] = useState("media");
  const [dataLimite, setDataLimite] = useState("");
  const [colunaId, setColunaId] = useState(colunas[0]?.id || "");
  const [subtarefasTotal, setSubtarefasTotal] = useState(0);

  const toggleResponsavel = (nome: string) => {
    setResponsaveisSelecionados(prev =>
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  const resetForm = () => {
    setTitulo(""); setDescricao(""); setResponsaveisSelecionados([]);
    setClienteId(""); setPrioridade("media"); setDataLimite("");
    setColunaId(colunas[0]?.id || ""); setSubtarefasTotal(0);
  };

  const handleSubmit = () => {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }

    // Build description with embedded metadata
    const meta = {
      responsavel: responsaveisSelecionados.length > 0 ? responsaveisSelecionados.join(", ") : undefined,
      cliente_id: clienteId && clienteId !== "none" ? clienteId : undefined,
      prioridade,
      data_limite: dataLimite || undefined,
      coluna_id: colunaId || undefined,
      subtarefas_total: subtarefasTotal > 0 ? subtarefasTotal : undefined,
    };

    const descComMeta = JSON.stringify({ texto: descricao.trim() || null, ...meta });

    if (isEditing && editando) {
      atualizarTarefa.mutate(
        { id: editando.id, titulo: titulo.trim(), descricao: descComMeta },
        {
          onSuccess: () => { toast.success("Tarefa atualizada!"); resetForm(); onClose?.(); onSuccess(); },
          onError: (e: any) => toast.error(e.message),
        }
      );
    } else {
      adicionarTarefa.mutate(
        { produto_template_id: templateId, titulo: titulo.trim(), descricao: descComMeta, ordem },
        {
          onSuccess: () => { toast.success("Tarefa adicionada!"); resetForm(); setOpen(false); onSuccess(); },
          onError: (e: any) => toast.error(e.message),
        }
      );
    }
  };

  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) { resetForm(); onClose?.(); } };

  // Parse existing metadata when editing
  useState(() => {
    if (editando?.descricao) {
      try {
        const parsed = JSON.parse(editando.descricao);
        if (parsed.texto) setDescricao(parsed.texto);
        if (parsed.responsavel) setResponsaveisSelecionados(parsed.responsavel.split(", "));
        if (parsed.cliente_id) setClienteId(parsed.cliente_id);
        if (parsed.prioridade) setPrioridade(parsed.prioridade);
        if (parsed.data_limite) setDataLimite(parsed.data_limite);
        if (parsed.coluna_id) setColunaId(parsed.coluna_id);
        if (parsed.subtarefas_total) setSubtarefasTotal(parsed.subtarefas_total);
      } catch {
        setDescricao(editando.descricao);
      }
    }
  });

  return (
    <Dialog open={isEditing ? true : open} onOpenChange={isEditing ? () => onClose?.() : handleOpenChange}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Adicionar Tarefa</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>{isEditing ? "Editar Tarefa" : "Nova Tarefa do Produto"}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div><Label>Título *</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Criar landing page" /></div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." /></div>

          <div>
            <Label>Coluna</Label>
            <Select value={colunaId} onValueChange={setColunaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
              <SelectContent>
                {colunas.map(c => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
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
                  <SelectItem key={c.id} value={c.id}>{c.nome} {c.empresa ? `(${c.empresa})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável(is)</Label>
            {membros.length > 0 ? (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                {membros.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`membro-${m.id}`}
                      checked={responsaveisSelecionados.includes(m.nome)}
                      onCheckedChange={() => toggleResponsavel(m.nome)}
                    />
                    <label htmlFor={`membro-${m.id}`} className="text-sm cursor-pointer">{m.nome}</label>
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
        <Button onClick={handleSubmit} className="w-full mt-4">{isEditing ? "Salvar" : "Adicionar Tarefa"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function parseTarefaMeta(descricao: string | null) {
  if (!descricao) return { texto: null };
  try {
    return JSON.parse(descricao);
  } catch {
    return { texto: descricao };
  }
}

function ProdutoTarefasPanel({ template, onClose }: { template: ProdutoTemplate; onClose: () => void }) {
  const { data: tarefas = [], isLoading } = useProdutoTemplateTarefas(template.id);
  const { excluirTarefa } = useProdutoTemplateMutations();
  const { colunas } = useTarefas();
  const [editandoTarefa, setEditandoTarefa] = useState<ProdutoTemplateTarefa | null>(null);

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
          <p className="text-sm text-muted-foreground">{tarefas.length} tarefa(s) configurada(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <NovaTarefaTemplatDialog
            templateId={template.id}
            ordem={tarefas.length}
            onSuccess={() => {}}
          />
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {editandoTarefa && (
        <NovaTarefaTemplatDialog
          templateId={template.id}
          ordem={editandoTarefa.ordem}
          editando={editandoTarefa}
          onClose={() => setEditandoTarefa(null)}
          onSuccess={() => setEditandoTarefa(null)}
        />
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
      ) : tarefas.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhuma tarefa configurada para este produto</p>
      ) : (
        <div className="space-y-2">
          {tarefas.map((tarefa, index) => {
            const meta = parseTarefaMeta(tarefa.descricao);
            const coluna = meta.coluna_id ? colunas.find(c => c.id === meta.coluna_id) : null;
            const prio = PRIORIDADES.find(p => p.value === meta.prioridade);

            return (
              <Card key={tarefa.id} className="p-3 flex items-start gap-3 group">
                <div className="mt-1"><GripVertical className="h-4 w-4 text-muted-foreground/50" /></div>
                <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs font-mono">{index + 1}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tarefa.titulo}</p>
                  {meta.texto && <p className="text-xs text-muted-foreground mt-0.5">{meta.texto}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {coluna && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: coluna.cor, color: coluna.cor }}>{coluna.nome}</Badge>
                    )}
                    {prio && <Badge className={cn("text-xs border-0", prio.color)}>{prio.label}</Badge>}
                    {meta.responsavel && <span className="text-xs text-muted-foreground">👤 {meta.responsavel}</span>}
                    {meta.data_limite && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{meta.data_limite}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditandoTarefa(tarefa)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleExcluir(tarefa.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProdutosTarefas() {
  const { data: templates = [], isLoading } = useProdutoTemplates();
  const { criarTemplate, atualizarTemplate, excluirTemplate } = useProdutoTemplateMutations();
  const [selecionado, setSelecionado] = useState<ProdutoTemplate | null>(null);
  const [editando, setEditando] = useState<ProdutoTemplate | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = templates.filter(t =>
    t.nome.toLowerCase().includes(busca.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleCriar = (data: { nome: string; descricao?: string }) => {
    criarTemplate.mutate(data, {
      onSuccess: () => toast.success("Produto criado!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: { id?: string; nome: string; descricao?: string }) => {
    if (!data.id) return;
    atualizarTemplate.mutate(
      { id: data.id, nome: data.nome, descricao: data.descricao || null },
      {
        onSuccess: () => { toast.success("Produto atualizado!"); setEditando(null); },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleExcluir = (id: string) => {
    excluirTemplate.mutate(id, {
      onSuccess: () => { toast.success("Produto removido"); if (selecionado?.id === id) setSelecionado(null); },
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
            Produtos & Tarefas
          </h1>
          <p className="text-muted-foreground">Configure produtos com templates de tarefas automáticas</p>
        </div>
        <NovoProdutoDialog onSubmit={handleCriar} />
      </div>

      {editando && (
        <NovoProdutoDialog editando={editando} onSubmit={handleAtualizar} onClose={() => setEditando(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <Input placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {filtrados.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum produto cadastrado</p>
          ) : (
            <div className="space-y-2">
              {filtrados.map((template) => (
                <Card
                  key={template.id}
                  className={cn("p-4 cursor-pointer transition-colors hover:bg-accent/30 group", selecionado?.id === template.id && "ring-2 ring-primary bg-primary/5")}
                  onClick={() => setSelecionado(template)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{template.nome}</p>
                      {template.descricao && <p className="text-xs text-muted-foreground truncate mt-0.5">{template.descricao}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setEditando(template); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleExcluir(template.id); }}>
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

        <div className="lg:col-span-2">
          {selecionado ? (
            <ProdutoTarefasPanel key={selecionado.id} template={selecionado} onClose={() => setSelecionado(null)} />
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
