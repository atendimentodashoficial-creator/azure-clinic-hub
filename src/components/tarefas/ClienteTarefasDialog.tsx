import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TarefaCliente } from "@/hooks/useTarefasClientes";
import { useTarefas, Tarefa, TarefaColuna } from "@/hooks/useTarefas";
import { useTiposTarefas } from "@/hooks/useTiposTarefas";
import { CheckCircle2, Clock, FileText, Layers, LayoutGrid, AlertCircle } from "lucide-react";

interface ClienteTarefasDialogProps {
  cliente: TarefaCliente | null;
  open: boolean;
  onClose: () => void;
}

const colunaIconMap: Record<string, React.ReactNode> = {
  "Concluído": <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "Em Progresso": <Clock className="h-4 w-4 text-blue-500" />,
  "Aguardando Aprovação": <AlertCircle className="h-4 w-4 text-violet-500" />,
  "Em Revisão": <AlertCircle className="h-4 w-4 text-orange-500" />,
  "A Fazer": <FileText className="h-4 w-4 text-amber-500" />,
};

export function ClienteTarefasDialog({ cliente, open, onClose }: ClienteTarefasDialogProps) {
  const { tarefas, colunas } = useTarefas();
  const { tipos } = useTiposTarefas();

  const clienteTarefas = useMemo(() => {
    if (!cliente) return [];
    return tarefas.filter(t => t.cliente_id === cliente.id);
  }, [tarefas, cliente]);

  const colunasMap = useMemo(() => {
    const map: Record<string, TarefaColuna> = {};
    colunas.forEach(c => { map[c.id] = c; });
    return map;
  }, [colunas]);

  const tiposMap = useMemo(() => {
    const map: Record<string, string> = {};
    tipos.forEach(t => { map[t.id] = t.nome; });
    return map;
  }, [tipos]);

  // Group tasks by tipo_tarefa
  const grouped = useMemo(() => {
    const groups: Record<string, Tarefa[]> = {};
    clienteTarefas.forEach(t => {
      const tipoNome = t.tipo_tarefa_id ? (tiposMap[t.tipo_tarefa_id] || "Outro") : "Sem tipo";
      if (!groups[tipoNome]) groups[tipoNome] = [];
      groups[tipoNome].push(t);
    });
    return groups;
  }, [clienteTarefas, tiposMap]);

  const getColunaBadge = (coluna_id: string) => {
    const col = colunasMap[coluna_id];
    if (!col) return null;
    const icon = colunaIconMap[col.nome] || <FileText className="h-3.5 w-3.5" />;
    return (
      <Badge variant="outline" className="text-xs gap-1 font-normal" style={{ borderColor: col.cor, color: col.cor }}>
        {icon}
        {col.nome}
      </Badge>
    );
  };

  if (!cliente) return null;

  const initials = cliente.nome.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={cliente.foto_perfil_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-lg">{cliente.nome}</DialogTitle>
              {cliente.empresa && <p className="text-sm text-muted-foreground">{cliente.empresa}</p>}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          {clienteTarefas.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Nenhuma tarefa vinculada a este cliente
            </div>
          ) : (
            <div className="space-y-6 pb-2">
              {Object.entries(grouped).map(([tipo, tasks]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">{tipo}</h3>
                    <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {tasks.map(tarefa => (
                      <Card key={tarefa.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tarefa.titulo}</p>
                          {tarefa.descricao && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{tarefa.descricao}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {tarefa.data_limite && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(tarefa.data_limite).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            {tarefa.responsavel_nome && (
                              <Badge variant="outline" className="text-xs font-normal">{tarefa.responsavel_nome}</Badge>
                            )}
                          </div>
                        </div>
                        {getColunaBadge(tarefa.coluna_id)}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
