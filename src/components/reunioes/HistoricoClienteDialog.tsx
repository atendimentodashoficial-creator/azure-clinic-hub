import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Video, CheckCircle2, XCircle, TrendingUp, Clock, Calendar,
  Phone, Percent, BarChart3, Users
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLast8Digits, formatPhoneDisplay } from "@/utils/phoneFormat";
import { cn } from "@/lib/utils";

interface Reuniao {
  id: string;
  titulo: string;
  data_reuniao: string;
  duracao_minutos: number | null;
  status: string;
  converteu?: boolean;
  cliente_telefone: string | null;
  profissionais?: { nome: string } | null;
  tipos_reuniao?: { nome: string } | null;
  meet_link?: string | null;
}

interface HistoricoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  clienteTelefone: string | null;
  todasReunioes: Reuniao[];
}

export function HistoricoClienteDialog({
  open,
  onOpenChange,
  clienteNome,
  clienteTelefone,
  todasReunioes,
}: HistoricoClienteDialogProps) {
  const last8 = clienteTelefone ? getLast8Digits(clienteTelefone) : "";

  const reunioesCliente = useMemo(() => {
    if (!last8) return [];
    return todasReunioes
      .filter((r) => {
        const rLast8 = r.cliente_telefone ? getLast8Digits(r.cliente_telefone) : "";
        return rLast8 === last8;
      })
      .sort((a, b) => new Date(b.data_reuniao).getTime() - new Date(a.data_reuniao).getTime());
  }, [todasReunioes, last8]);

  const stats = useMemo(() => {
    const total = reunioesCliente.length;
    if (total === 0) return null;

    const realizadas = reunioesCliente.filter(
      (r) => r.status === "realizada" || r.status === "resumido" || r.status === "transcrito"
    ).length;
    const noShow = reunioesCliente.filter((r) => r.status === "nao_compareceu").length;
    const canceladas = reunioesCliente.filter((r) => r.status === "cancelado").length;
    const agendadas = reunioesCliente.filter((r) => r.status === "agendado" || r.status === "pendente" || r.status === "confirmado").length;
    const convertidas = reunioesCliente.filter((r) => (r as any).converteu === true).length;

    const finalizadas = realizadas + noShow;
    const taxaComparecimento = finalizadas > 0 ? Math.round((realizadas / finalizadas) * 100) : 0;
    const taxaConversao = realizadas > 0 ? Math.round((convertidas / realizadas) * 100) : 0;

    const comDuracao = reunioesCliente.filter((r) => r.duracao_minutos && r.duracao_minutos > 0);
    const duracaoMedia =
      comDuracao.length > 0
        ? Math.round(comDuracao.reduce((s, r) => s + (r.duracao_minutos || 0), 0) / comDuracao.length)
        : 0;

    const primeira = reunioesCliente[reunioesCliente.length - 1];
    const ultima = reunioesCliente[0];

    return {
      total,
      realizadas,
      noShow,
      canceladas,
      agendadas,
      convertidas,
      taxaComparecimento,
      taxaConversao,
      duracaoMedia,
      primeiraReuniao: primeira?.data_reuniao,
      ultimaReuniao: ultima?.data_reuniao,
    };
  }, [reunioesCliente]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "transcrito":
        return <Badge variant="secondary" className="text-[10px]">Transcrito</Badge>;
      case "resumido":
        return <Badge className="bg-green-500/20 text-green-700 text-[10px]">Resumido</Badge>;
      case "realizada":
        return <Badge className="bg-green-500/20 text-green-700 text-[10px]">Realizada</Badge>;
      case "nao_compareceu":
        return <Badge variant="destructive" className="text-[10px]">No-show</Badge>;
      case "cancelado":
        return <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>;
      case "agendado":
      case "confirmado":
        return <Badge variant="outline" className="text-[10px]">Agendado</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Histórico de Reuniões
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{clienteNome}</span>
            {clienteTelefone && (
              <>
                <span>·</span>
                <Phone className="h-3.5 w-3.5" />
                <span>{formatPhoneDisplay(clienteTelefone)}</span>
              </>
            )}
          </div>
        </DialogHeader>

        {!stats || stats.total === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma reunião encontrada para este cliente.
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-2">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Total" value={stats.total} icon={Video} />
                <MetricCard label="Realizadas" value={stats.realizadas} icon={CheckCircle2} accent="text-emerald-600" />
                <MetricCard label="No-shows" value={stats.noShow} icon={XCircle} accent="text-destructive" />
                <MetricCard label="Conversão" value={`${stats.taxaConversao}%`} icon={TrendingUp} accent="text-blue-600" />
              </div>

              {/* Timeline info */}
              {stats.primeiraReuniao && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <div>
                    <span className="font-medium">Primeira: </span>
                    {format(new Date(stats.primeiraReuniao), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                  <div>
                    <span className="font-medium">Última: </span>
                    {format(new Date(stats.ultimaReuniao!), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Histórico */}
              <h4 className="text-sm font-semibold text-muted-foreground">Histórico Completo</h4>
              <div className="space-y-2">
                {reunioesCliente.map((r) => {
                  const d = new Date(r.data_reuniao);
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border bg-card",
                        r.status === "nao_compareceu" || r.status === "cancelado"
                          ? "border-l-2 border-l-destructive"
                          : r.status === "realizada" || r.status === "resumido" || r.status === "transcrito"
                            ? "border-l-2 border-l-green-500"
                            : "border-l-2 border-l-primary"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(d, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(d, "HH:mm")}
                          </span>
                          {getStatusBadge(r.status)}
                          {(r as any).converteu && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-1.5">Convertido</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.titulo}
                          {(r as any).tipos_reuniao?.nome && ` · ${(r as any).tipos_reuniao.nome}`}
                          {r.duracao_minutos ? ` · ${r.duracao_minutos}min` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-2.5 flex items-center gap-2">
        <div className="h-7 w-7 rounded-md flex items-center justify-center bg-muted shrink-0">
          <Icon className={cn("h-3.5 w-3.5", accent || "text-muted-foreground")} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          <p className={cn("text-sm font-bold", accent)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
