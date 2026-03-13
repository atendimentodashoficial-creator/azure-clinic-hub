import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Video, Users } from "lucide-react";
import { useTiposReuniao, useTipoReuniaoMembros, useTiposReuniaoMutations, TipoReuniao } from "@/hooks/useTiposReuniao";
import { useTarefasMembros } from "@/hooks/useTarefasMembros";

export function TiposReuniaoConfig() {
  const { data: tipos, isLoading } = useTiposReuniao();
  const { membros } = useTarefasMembros();
  const { criarTipo, atualizarTipo, excluirTipo, setMembros } = useTiposReuniaoMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<TipoReuniao | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load membros when editing
  const { data: tipoMembros } = useTipoReuniaoMembros(editando?.id || null);

  useEffect(() => {
    if (editando) {
      setNome(editando.nome);
      setDescricao(editando.descricao || "");
    } else {
      setNome("");
      setDescricao("");
      setSelectedMembros([]);
    }
  }, [editando]);

  useEffect(() => {
    if (tipoMembros) {
      setSelectedMembros(tipoMembros.map(m => m.membro_id));
    }
  }, [tipoMembros]);

  const handleOpen = (tipo?: TipoReuniao) => {
    setEditando(tipo || null);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditando(null);
    setNome("");
    setDescricao("");
    setSelectedMembros([]);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      let tipoId: string;
      if (editando) {
        await atualizarTipo.mutateAsync({ id: editando.id, nome: nome.trim(), descricao: descricao.trim() || null });
        tipoId = editando.id;
      } else {
        const created = await criarTipo.mutateAsync({ nome: nome.trim(), descricao: descricao.trim() || undefined });
        tipoId = created.id;
      }
      await setMembros.mutateAsync({ tipoId, membroIds: selectedMembros });
      toast.success(editando ? "Tipo atualizado!" : "Tipo criado!");
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    if (!excluirId) return;
    try {
      await excluirTipo.mutateAsync(excluirId);
      toast.success("Tipo excluído!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setExcluirId(null);
    }
  };

  const toggleMembro = (membroId: string) => {
    setSelectedMembros(prev =>
      prev.includes(membroId)
        ? prev.filter(id => id !== membroId)
        : [...prev, membroId]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5" />
            Tipos de Reunião
          </h2>
          <p className="text-sm text-muted-foreground">Configure os tipos de reunião e os profissionais que realizam cada tipo</p>
        </div>
        <Button onClick={() => handleOpen()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      {(!tipos || tipos.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhum tipo de reunião cadastrado</p>
            <Button variant="link" onClick={() => handleOpen()}>Criar primeiro tipo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tipos.map(tipo => (
            <TipoReuniaoCard
              key={tipo.id}
              tipo={tipo}
              membros={membros}
              onEdit={() => handleOpen(tipo)}
              onDelete={() => setExcluirId(tipo.id)}
              onToggleAtivo={async (ativo) => {
                await atualizarTipo.mutateAsync({ id: tipo.id, nome: tipo.nome, ativo });
              }}
            />
          ))}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col min-h-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Tipo de Reunião" : "Novo Tipo de Reunião"}</DialogTitle>
            <DialogDescription>Defina o tipo e os profissionais que realizam essa reunião</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Reunião de Venda, Onboarding..." />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o tipo de reunião..." rows={2} />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Profissionais que realizam esse tipo
              </Label>
              {membros.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro da equipe cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {membros.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                      <Checkbox
                        checked={selectedMembros.includes(m.id)}
                        onCheckedChange={() => toggleMembro(m.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{m.nome}</span>
                        {m.cargo && <span className="text-xs text-muted-foreground ml-2">({m.cargo})</span>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !nome.trim()}>
              {saving ? "Salvando..." : editando ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert excluir */}
      <AlertDialog open={!!excluirId} onOpenChange={(open) => !open && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Reunião</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TipoReuniaoCard({ tipo, membros, onEdit, onDelete, onToggleAtivo }: {
  tipo: TipoReuniao;
  membros: Array<{ id: string; nome: string; cargo?: string | null }>;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: (ativo: boolean) => void;
}) {
  const { data: tipoMembros } = useTipoReuniaoMembros(tipo.id);
  const membroNomes = (tipoMembros || []).map(tm => {
    const m = membros.find(mb => mb.id === tm.membro_id);
    return m?.nome || "—";
  });

  return (
    <Card className={!tipo.ativo ? "opacity-60" : ""}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{tipo.nome}</span>
            {!tipo.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
          </div>
          {tipo.descricao && <p className="text-xs text-muted-foreground mb-1">{tipo.descricao}</p>}
          {membroNomes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {membroNomes.map((n, i) => (
                <Badge key={i} variant="outline" className="text-xs">{n}</Badge>
              ))}
            </div>
          )}
          {membroNomes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum profissional vinculado</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={tipo.ativo} onCheckedChange={onToggleAtivo} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
