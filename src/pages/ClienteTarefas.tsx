import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, ExternalLink, Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteTarefa {
  id: string;
  titulo: string;
  prioridade: string;
  data_limite: string | null;
  approval_status: string | null;
  approval_token: string | null;
  created_at: string;
  updated_at: string;
  coluna_nome: string;
  coluna_cor: string;
  tipo_tarefa_nome: string | null;
  responsavel_nome: string | null;
}

export default function ClienteTarefas() {
  const { user } = useAuth();

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["cliente-tarefas", user?.id],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("id")
        .eq("email", user.email)
        .limit(1)
        .single();

      if (!clienteData) return [];

      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id, titulo, prioridade, data_limite, approval_status, approval_token,
          created_at, updated_at, responsavel_nome,
          tarefas_colunas!inner(nome, cor),
          tipos_tarefas(nome)
        `)
        .eq("cliente_id", clienteData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        prioridade: t.prioridade,
        data_limite: t.data_limite,
        approval_status: t.approval_status,
        approval_token: t.approval_token,
        created_at: t.created_at,
        updated_at: t.updated_at,
        coluna_nome: t.tarefas_colunas?.nome || "—",
        coluna_cor: t.tarefas_colunas?.cor || "#6b7280",
        tipo_tarefa_nome: t.tipos_tarefas?.nome || null,
        responsavel_nome: t.responsavel_nome,
      })) as ClienteTarefa[];
    },
    enabled: !!user?.email,
  });

  const etapaLabel = (coluna: string) => {
    const map: Record<string, string> = {
      "A Fazer": "Na fila",
      "Em Progresso": "Em produção",
      "Aguardando Aprovação": "Aguardando sua aprovação",
      "Em Revisão": "Em revisão",
      "Concluído": "Concluído",
    };
    return map[coluna] || coluna;
  };

  const approvalLabel = (status: string | null) => {
    if (status === "concluido") return { text: "Aprovado", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    if (status === "em_revisao") return { text: "Mudanças solicitadas", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
    return null;
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
        <p className="text-muted-foreground">Acompanhe o progresso das suas entregas</p>
      </div>

      {tarefas.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tarefas.map((t) => {
            const approval = approvalLabel(t.approval_status);
            return (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{t.titulo}</h3>
                    {t.tipo_tarefa_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.tipo_tarefa_nome}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-[11px] font-medium border"
                    style={{
                      backgroundColor: `${t.coluna_cor}15`,
                      color: t.coluna_cor,
                      borderColor: `${t.coluna_cor}40`,
                    }}
                  >
                    {etapaLabel(t.coluna_nome)}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  {t.responsavel_nome && (
                    <span>👤 {t.responsavel_nome}</span>
                  )}
                  {t.data_limite && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(t.data_limite), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Atualizado {format(new Date(t.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {approval && (
                    <Badge variant="outline" className={cn("text-[10px]", approval.color)}>
                      {approval.text}
                    </Badge>
                  )}
                  {t.approval_token && t.coluna_nome === "Aguardando Aprovação" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      asChild
                    >
                      <a href={`/aprovacao/${t.approval_token}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                        Revisar entrega
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
