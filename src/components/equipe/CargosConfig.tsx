import { useState } from "react";
import { useCargos, Cargo } from "@/hooks/useCargos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#6B7280", "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

export default function CargosConfig() {
  const { cargos, criarCargo, atualizarCargo, excluirCargo } = useCargos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Cargo | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#6B7280");

  const openNew = () => {
    setEditando(null);
    setNome("");
    setCor("#6B7280");
    setDialogOpen(true);
  };

  const openEdit = (cargo: Cargo) => {
    setEditando(cargo);
    setNome(cargo.nome);
    setCor(cargo.cor || "#6B7280");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do cargo");
      return;
    }
    if (editando) {
      atualizarCargo.mutate({ id: editando.id, nome: nome.trim(), cor }, {
        onSuccess: () => { toast.success("Cargo atualizado"); setDialogOpen(false); },
        onError: () => toast.error("Erro ao atualizar"),
      });
    } else {
      criarCargo.mutate({ nome: nome.trim(), cor }, {
        onSuccess: () => { toast.success("Cargo criado"); setDialogOpen(false); },
        onError: () => toast.error("Erro ao criar"),
      });
    }
  };

  const handleDelete = (id: string) => {
    excluirCargo.mutate(id, {
      onSuccess: () => toast.success("Cargo excluído"),
      onError: () => toast.error("Erro ao excluir"),
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Cargos da Equipe
        </h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Cargo
        </Button>
      </div>

      {cargos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum cargo cadastrado. Crie cargos para organizar sua equipe.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {cargos.map((cargo) => (
            <Card key={cargo.id} className="p-3 border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cargo.cor || "#6B7280" }} />
                <span className="font-medium text-sm">{cargo.nome}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cargo)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir cargo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O cargo "{cargo.nome}" será removido. Membros com este cargo não serão afetados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(cargo.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Cargo" : "Novo Cargo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cargo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Designer, Gerente, Desenvolvedor"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setCor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={criarCargo.isPending || atualizarCargo.isPending}>
              {editando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
