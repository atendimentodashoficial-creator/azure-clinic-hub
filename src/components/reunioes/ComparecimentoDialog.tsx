import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { getLast8Digits } from "@/utils/phoneFormat";

interface Reuniao {
  id: string;
  cliente_telefone: string | null;
  titulo: string;
}

interface KanbanColumn {
  id: string;
  nome: string;
  cor: string;
}

interface ComparecimentoDialogProps {
  reuniao: Reuniao | null;
  tipo: "compareceu" | "nao_compareceu" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function moveKanbanCard(userId: string, telefone: string, columnId: string) {
  const last8 = getLast8Digits(telefone);
  if (!last8) return;

  const { data: chats } = await supabase
    .from("whatsapp_chats")
    .select("id")
    .eq("user_id", userId)
    .like("normalized_number", `%${last8}`)
    .is("deleted_at", null);

  if (!chats || chats.length === 0) return;

  for (const chat of chats) {
    const { data: existing } = await supabase
      .from("whatsapp_chat_kanban")
      .select("id")
      .eq("chat_id", chat.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("whatsapp_chat_kanban")
        .update({ column_id: columnId })
        .eq("chat_id", chat.id);
    } else {
      await supabase
        .from("whatsapp_chat_kanban")
        .insert({ chat_id: chat.id, column_id: columnId, user_id: userId });
    }
  }
}

export function ComparecimentoDialog({
  reuniao,
  tipo,
  open,
  onOpenChange,
}: ComparecimentoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [skipMove, setSkipMove] = useState(false);

  const { data: columns, isLoading } = useQuery({
    queryKey: ["whatsapp-kanban-columns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_kanban_columns")
        .select("id, nome, cor")
        .eq("user_id", user!.id)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanColumn[];
    },
    enabled: !!user?.id && open,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!reuniao || !user) throw new Error("Dados incompletos");

      if (!skipMove && selectedColumnId && reuniao.cliente_telefone) {
        await moveKanbanCard(user.id, reuniao.cliente_telefone, selectedColumnId);
      }

      const novoStatus = tipo === "compareceu" ? "realizada" : "nao_compareceu";
      await supabase
        .from("reunioes" as any)
        .update({ status: novoStatus })
        .eq("id", reuniao.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reunioes"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-kanban"] });
      toast.success(
        tipo === "compareceu"
          ? "Reunião marcada como realizada!"
          : "Não comparecimento registrado!"
      );
      setSelectedColumnId(null);
      setSkipMove(false);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao registrar comparecimento:", error);
      toast.error("Erro ao registrar comparecimento");
    },
  });

  const handleClose = () => {
    setSelectedColumnId(null);
    setSkipMove(false);
    onOpenChange(false);
  };

  if (!reuniao || !tipo) return null;

  const isCompareceu = tipo === "compareceu";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompareceu ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            {isCompareceu ? "Compareceu" : "Não Compareceu"}
          </DialogTitle>
          <DialogDescription>
            Selecione para qual coluna do Kanban do WhatsApp o card do cliente deve ser movido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : columns && columns.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Columns3 className="w-4 h-4" />
                <span>Escolha a coluna destino:</span>
              </div>
              {columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => { setSelectedColumnId(col.id); setSkipMove(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                    selectedColumnId === col.id && !skipMove
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.cor }}
                  />
                  <span className="font-medium text-sm">{col.nome}</span>
                  {selectedColumnId === col.id && !skipMove && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
              <button
                onClick={() => { setSkipMove(true); setSelectedColumnId(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                  skipMove
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <XCircle className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium text-sm text-muted-foreground">Não movimentar card</span>
                {skipMove && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </button>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              className={`flex-1 gap-2 ${
                isCompareceu
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }`}
              disabled={!selectedColumnId || confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              {isCompareceu ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
