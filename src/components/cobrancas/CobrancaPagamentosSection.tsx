import { useState, useRef } from "react";
import { format, parseISO, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, FileImage, CalendarIcon, Upload, ExternalLink, Loader2, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput, parseCurrencyToNumber } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCobrancaPagamentos,
  useCreateCobrancaPagamento,
  useDeleteCobrancaPagamento,
  uploadCobrancaComprovante,
} from "@/hooks/useCobrancaPagamentos";

interface CobrancaPagamentosSectionProps {
  cobrancaId: string;
  valorTotal: number;
  dataVencimento?: string;
}

export function CobrancaPagamentosSection({ cobrancaId, valorTotal, dataVencimento }: CobrancaPagamentosSectionProps) {
  const { data: pagamentos, isLoading } = useCobrancaPagamentos(cobrancaId);
  const createPagamento = useCreateCobrancaPagamento();
  const deletePagamento = useDeleteCobrancaPagamento();

  const [showForm, setShowForm] = useState(false);
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState<Date>(new Date());
  const [dataProximo, setDataProximo] = useState<Date | undefined>();
  const [observacoes, setObservacoes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalPago = pagamentos?.reduce((s, p) => s + Number(p.valor), 0) || 0;
  const percentPago = valorTotal > 0 ? Math.min((totalPago / valorTotal) * 100, 100) : 0;
  const restante = Math.max(valorTotal - totalPago, 0);

  const resetForm = () => {
    setValor("");
    setDataPagamento(new Date());
    setDataProximo(undefined);
    setObservacoes("");
    setFile(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const valorNum = parseCurrencyToNumber(valor);
    if (valorNum <= 0) {
      toast.error("Informe o valor do pagamento");
      return;
    }

    setUploading(true);
    try {
      let comprovanteUrl: string | null = null;
      if (file) {
        comprovanteUrl = await uploadCobrancaComprovante(file);
      }

      await createPagamento.mutateAsync({
        cobranca_id: cobrancaId,
        valor: valorNum,
        data_pagamento: format(dataPagamento, "yyyy-MM-dd"),
        data_proximo_pagamento: dataProximo ? format(dataProximo, "yyyy-MM-dd") : null,
        comprovante_url: comprovanteUrl,
        observacoes: observacoes || null,
      });

      toast.success("Pagamento registrado!");
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar pagamento");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePagamento.mutateAsync({ id, cobrancaId });
      toast.success("Pagamento removido");
    } catch {
      toast.error("Erro ao remover pagamento");
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Check if payment was made in a different month than the due date
  const isPagoForaDoPrazo = (dataPagStr: string) => {
    if (!dataVencimento) return false;
    const pagDate = parseISO(dataPagStr);
    const vencDate = parseISO(dataVencimento);
    return !isSameMonth(pagDate, vencDate);
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-foreground flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary" />
          Histórico de Pagamentos
        </h4>
        {!showForm && (
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            Registrar Pagamento
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5 bg-muted/30 rounded-lg p-3">
        <div className="flex justify-between text-xs">
          <span className="text-foreground font-medium">Pago: {fmt(totalPago)}</span>
          <span className="text-muted-foreground">Restante: {fmt(restante)}</span>
        </div>
        <Progress
          value={percentPago}
          className="h-2.5"
          style={{
            "--progress-color": percentPago >= 100 ? "hsl(var(--chart-2))" : "hsl(var(--primary))",
            "--progress-background": "hsl(var(--muted))",
          } as any}
        />
        <p className="text-xs text-right font-medium" style={{ color: percentPago >= 100 ? "hsl(var(--chart-2))" : undefined }}>
          {percentPago.toFixed(0)}% do total
        </p>
      </div>

      {/* Existing payments */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : pagamentos && pagamentos.length > 0 ? (
        <div className="space-y-2">
          {pagamentos.map((p, idx) => {
            const foraDoMes = isPagoForaDoPrazo(p.data_pagamento);
            return (
              <div
                key={p.id}
                className={cn(
                  "border rounded-lg px-3 py-2.5 bg-card space-y-1.5 transition-colors",
                  foraDoMes && "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-foreground">{fmt(Number(p.valor))}</span>
                      <p className="text-[11px] text-muted-foreground">
                        Pagamento #{pagamentos.length - idx}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px] px-2 py-0.5 gap-1">
                      <CalendarIcon className="h-2.5 w-2.5" />
                      {format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {foraDoMes && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 rounded-md px-2 py-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span className="text-[11px] font-medium">
                      Pago fora do mês de vencimento
                      {dataVencimento && ` (venc. ${format(parseISO(dataVencimento), "MM/yyyy")})`}
                    </span>
                  </div>
                )}

                {p.observacoes && (
                  <p className="text-xs text-muted-foreground italic pl-9">{p.observacoes}</p>
                )}
                {p.comprovante_url && (
                  <a
                    href={p.comprovante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline pl-9 font-medium"
                  >
                    <FileImage className="h-3 w-3" />
                    Ver comprovante
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {p.data_proximo_pagamento && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 pl-9 flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Próximo: {format(new Date(p.data_proximo_pagamento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum pagamento registrado</p>
      )}

      {/* New payment form */}
      {showForm && (
        <div className="border rounded-lg p-3 space-y-2.5 bg-muted/30">
          <p className="text-xs font-semibold text-foreground">Novo Pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium">Valor *</label>
              <CurrencyInput value={valor} onChange={setValor} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium">Data Pagamento *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {format(dataPagamento, "dd/MM/yy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataPagamento} onSelect={(d) => d && setDataPagamento(d)} locale={ptBR} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium">Próximo Pagamento Previsto</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal h-8 text-xs", !dataProximo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dataProximo ? format(dataProximo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione (opcional)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataProximo} onSelect={setDataProximo} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium">Comprovante</label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" />
              {file ? file.name : "Anexar comprovante (opcional)"}
            </Button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium">Observações</label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Observações do pagamento..." />
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Salvar Pagamento
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={resetForm} disabled={uploading}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
