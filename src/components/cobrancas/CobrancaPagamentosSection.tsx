import { useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, FileImage, CalendarIcon, Upload, ExternalLink, Loader2 } from "lucide-react";
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
}

export function CobrancaPagamentosSection({ cobrancaId, valorTotal }: CobrancaPagamentosSectionProps) {
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

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-xs text-foreground">Pagamentos Parciais</h4>
        {!showForm && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3 mr-0.5" />
            Registrar
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Pago: {fmt(totalPago)}</span>
          <span>Restante: {fmt(restante)}</span>
        </div>
        <Progress
          value={percentPago}
          className="h-2"
          style={{
            "--progress-color": percentPago >= 100 ? "hsl(var(--chart-2))" : "hsl(var(--primary))",
            "--progress-background": "hsl(var(--muted))",
          } as any}
        />
        <p className="text-[10px] text-right text-muted-foreground">{percentPago.toFixed(0)}%</p>
      </div>

      {/* Existing payments */}
      {isLoading ? (
        <p className="text-[10px] text-muted-foreground">Carregando...</p>
      ) : pagamentos && pagamentos.length > 0 ? (
        <div className="space-y-1.5">
          {pagamentos.map((p) => (
            <div key={p.id} className="border rounded-md px-2.5 py-1.5 bg-card space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{fmt(Number(p.valor))}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-destructive"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
              {p.observacoes && (
                <p className="text-[10px] text-muted-foreground">{p.observacoes}</p>
              )}
              {p.comprovante_url && (
                <a
                  href={p.comprovante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                >
                  <FileImage className="h-2.5 w-2.5" />
                  Ver comprovante
                  <ExternalLink className="h-2 w-2" />
                </a>
              )}
              {p.data_proximo_pagamento && (
                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                  Próximo: {format(new Date(p.data_proximo_pagamento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* New payment form */}
      {showForm && (
        <div className="border rounded-lg p-2.5 space-y-2.5 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium">Valor *</label>
              <CurrencyInput value={valor} onChange={setValor} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium">Data Pagamento *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-[10px]">
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
            <label className="text-[10px] font-medium">Próximo Pagamento Previsto</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal h-8 text-[10px]", !dataProximo && "text-muted-foreground")}
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
            <label className="text-[10px] font-medium">Comprovante</label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="outline" size="sm" className="w-full h-8 text-[10px]" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" />
              {file ? file.name : "Anexar comprovante (opcional)"}
            </Button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium">Observações</label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="text-[10px] resize-none" placeholder="Observações do pagamento..." />
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-[10px]" onClick={handleSubmit} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Salvar
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={resetForm} disabled={uploading}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
