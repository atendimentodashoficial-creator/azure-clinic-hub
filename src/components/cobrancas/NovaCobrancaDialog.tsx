import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus } from "lucide-react";
import { Cobranca } from "@/hooks/useCobrancas";

interface Props {
  onSubmit: (data: any) => void;
  clienteId: string;
  editando?: Cobranca | null;
  onClose?: () => void;
  externalOpen?: boolean;
}

const metodoOptions = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

export function NovaCobrancaDialog({ onSubmit, clienteId, editando, onClose, externalOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"mrr" | "unico">("unico");
  const [status, setStatus] = useState<string>("pendente");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(false);

  const isOpen = externalOpen ?? open;

  useEffect(() => {
    if (editando) {
      setDescricao(editando.descricao);
      setValor(String(editando.valor).replace(".", ","));
      setTipo(editando.tipo);
      setStatus(editando.status);
      setDataVencimento(editando.data_vencimento);
      setDataPagamento(editando.data_pagamento || "");
      setMetodoPagamento(editando.metodo_pagamento || "");
      setObservacoes(editando.observacoes || "");
      setRecorrenciaAtiva(editando.recorrencia_ativa);
    }
  }, [editando]);

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setTipo("unico");
    setStatus("pendente");
    setDataVencimento("");
    setDataPagamento("");
    setMetodoPagamento("");
    setObservacoes("");
    setRecorrenciaAtiva(false);
  };

  const handleSubmit = () => {
    const parsedValor = parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;

    const data: any = {
      cliente_id: clienteId,
      descricao: descricao.trim(),
      valor,
      tipo,
      status,
      data_vencimento: dataVencimento,
      data_pagamento: dataPagamento || null,
      metodo_pagamento: metodoPagamento || null,
      observacoes: observacoes.trim() || null,
      recorrencia_ativa: tipo === "mrr" ? recorrenciaAtiva : false,
    };

    if (editando) data.id = editando.id;

    onSubmit(data);
    resetForm();
    if (externalOpen) {
      onClose?.();
    } else {
      setOpen(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (externalOpen !== undefined) {
      if (!v) onClose?.();
    } else {
      setOpen(v);
      if (!v) resetForm();
    }
  };

  const content = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{editando ? "Editar Cobrança" : "Nova Cobrança"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Descrição *</Label>
          <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Mensalidade Marketing" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor *</Label>
            <CurrencyInput value={valor} onValueChange={setValor} />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mrr">MRR (Recorrente)</SelectItem>
                <SelectItem value="unico">Produto Único</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vencimento *</Label>
            <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {status === "pago" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {metodoOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {tipo === "mrr" && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Recorrência Automática</p>
              <p className="text-xs text-muted-foreground">Gera nova cobrança automaticamente no próximo mês</p>
            </div>
            <Switch checked={recorrenciaAtiva} onCheckedChange={setRecorrenciaAtiva} />
          </div>
        )}

        <div>
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas adicionais..." rows={2} />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={!descricao.trim() || !dataVencimento}>
          {editando ? "Salvar Alterações" : "Criar Cobrança"}
        </Button>
      </div>
    </DialogContent>
  );

  if (externalOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova Cobrança
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
}
