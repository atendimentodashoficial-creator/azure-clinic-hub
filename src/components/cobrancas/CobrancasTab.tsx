import { useState, useMemo } from "react";
import { useCobrancas, Cobranca } from "@/hooks/useCobrancas";
import { NovaCobrancaDialog } from "./NovaCobrancaDialog";
import { CobrancaPagamentosSection } from "./CobrancaPagamentosSection";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DollarSign, Clock, CheckCircle2, AlertTriangle, XCircle,
  Edit, Trash2, RefreshCw, CreditCard, Receipt, TrendingUp, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  clienteId: string;
  valorContrato?: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  pago: { label: "Pago", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  atrasado: { label: "Atrasado", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
};

const metodoLabels: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

export function CobrancasTab({ clienteId, valorContrato = 0 }: Props) {
  const { cobrancas, isLoading, criarCobranca, atualizarCobranca, excluirCobranca } = useCobrancas(clienteId);
  const [editando, setEditando] = useState<Cobranca | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState("todas");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  const stats = useMemo(() => {
    const totalMrr = cobrancas.filter(c => c.tipo === "mrr" && c.status !== "cancelado").reduce((a, c) => a + c.valor, 0);
    const totalPago = cobrancas.filter(c => c.status === "pago").reduce((a, c) => a + c.valor, 0);
    const totalPendente = cobrancas.filter(c => c.status === "pendente").reduce((a, c) => a + c.valor, 0);
    const totalAtrasado = cobrancas.filter(c => c.status === "atrasado").reduce((a, c) => a + c.valor, 0);
    return { totalMrr, totalPago, totalPendente, totalAtrasado };
  }, [cobrancas]);

  const filtered = useMemo(() => {
    if (subTab === "todas") return cobrancas;
    if (subTab === "mrr") return cobrancas.filter(c => c.tipo === "mrr");
    if (subTab === "unico") return cobrancas.filter(c => c.tipo === "unico");
    return cobrancas.filter(c => c.status === subTab);
  }, [cobrancas, subTab]);

  const handleCriar = (data: any) => {
    criarCobranca.mutate(data, {
      onSuccess: () => toast.success("Cobrança criada!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleAtualizar = (data: any) => {
    const { id, ...rest } = data;
    atualizarCobranca.mutate({ id, ...rest }, {
      onSuccess: () => { toast.success("Cobrança atualizada!"); setEditando(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleExcluir = () => {
    if (!excluirId) return;
    excluirCobranca.mutate(excluirId, {
      onSuccess: () => { toast.success("Cobrança excluída"); setExcluirId(null); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleMarcarPago = (cobranca: Cobranca) => {
    atualizarCobranca.mutate({
      id: cobranca.id,
      status: "pago",
      data_pagamento: new Date().toISOString().split("T")[0],
    } as any, {
      onSuccess: () => toast.success("Marcado como pago!"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "MRR", value: formatCurrency(stats.totalMrr), icon: <TrendingUp className="h-4 w-4" />, color: "text-primary" },
          { label: "Total Pago", value: formatCurrency(stats.totalPago), icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
          { label: "Pendente", value: formatCurrency(stats.totalPendente), icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
          { label: "Atrasado", value: formatCurrency(stats.totalAtrasado), icon: <AlertTriangle className="h-4 w-4" />, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              {s.icon}
              <span className="text-xs">{s.label}</span>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Header + actions */}
      <div className="flex items-center justify-between gap-3">
        <Tabs value={subTab} onValueChange={setSubTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="todas" className="gap-1.5">
              <Receipt className="h-4 w-4" />
              Todas
            </TabsTrigger>
            <TabsTrigger value="mrr" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              MRR
            </TabsTrigger>
            <TabsTrigger value="unico" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Único
            </TabsTrigger>
            <TabsTrigger value="pendente" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="atrasado" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Atrasados
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <NovaCobrancaDialog clienteId={clienteId} onSubmit={handleCriar} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma cobrança encontrada
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(c => {
            const cfg = statusConfig[c.status] || statusConfig.pendente;
            const isOverdue = c.status === "atrasado";
            return (
              <Card
                key={c.id}
                className={`p-4 transition-colors hover:border-primary/30 ${isOverdue ? "border-destructive/30 bg-destructive/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{c.descricao}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-medium">
                        {c.tipo === "mrr" ? "MRR" : "Único"}
                      </Badge>
                      {c.recorrencia_ativa && (
                        <Badge className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5 bg-secondary text-secondary-foreground">
                          <RefreshCw className="h-2.5 w-2.5" /> Auto
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Venc: {formatDate(c.data_vencimento)}
                      </span>
                      {c.data_pagamento && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Pago: {formatDate(c.data_pagamento)}
                        </span>
                      )}
                      {c.metodo_pagamento && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {metodoLabels[c.metodo_pagamento] || c.metodo_pagamento}
                        </Badge>
                      )}
                    </div>
                    {c.observacoes && (
                      <p className="text-xs text-muted-foreground/70 truncate max-w-md italic">{c.observacoes}</p>
                    )}
                  </div>

                  {/* Right: status + value + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={cfg.variant} className="text-xs gap-1 px-2 py-0.5">
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                    <span className="text-base font-bold whitespace-nowrap tabular-nums">{formatCurrency(c.valor)}</span>
                    <div className="flex items-center gap-0.5 border-l pl-2 border-border">
                      {c.status === "pendente" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleMarcarPago(c)} title="Marcar como pago">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(c)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setExcluirId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editando && (
        <NovaCobrancaDialog
          clienteId={clienteId}
          editando={editando}
          onSubmit={handleAtualizar}
          onClose={() => setEditando(null)}
          externalOpen={true}
        />
      )}

      {/* Confirm delete */}
      <AlertDialog open={!!excluirId} onOpenChange={(v) => !v && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
