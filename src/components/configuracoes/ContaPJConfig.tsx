import { useState, useMemo, useCallback } from "react";
import { Upload, FileSpreadsheet, TrendingUp, TrendingDown, Wallet, Filter, X, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PeriodFilter, usePeriodFilter } from "@/components/filters/PeriodFilter";
import * as XLSX from "xlsx";

interface TransacaoPJ {
  dataHora: Date;
  historico: string;
  cartao: string;
  nomeCartao: string;
  credito: number;
  debito: number;
  saldo: number;
  situacao: string;
  descricao: string;
  categoria: string;
  centroCusto: string;
  valorIOF: number;
  cotacaoDolar: number;
  cpfCnpjOrigemDestino: string;
  conciliado: string;
}

function parseCurrency(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(str) || 0;
}

function parseExcelDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(val);
  // Try DD/MM/YYYY HH:mm:ss
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    return new Date(+match[3], +match[2] - 1, +match[1], +match[4], +match[5], +match[6]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function detectTipo(historico: string): string {
  const h = historico.toLowerCase();
  if (h.includes("pix enviado")) return "PIX Enviado";
  if (h.includes("recebimento via pix") || h.includes("pix recebido")) return "PIX Recebido";
  if (h.includes("rentabilidade")) return "Rentabilidade";
  if (h.includes("transferência de limite") || h.includes("transferencia de limite")) return "Transf. Limite";
  if (h.includes("ted") || h.includes("transferência")) return "Transferência";
  if (h.includes("boleto")) return "Boleto";
  if (h.includes("tarifa") || h.includes("taxa")) return "Tarifa";
  return "Outros";
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ContaPJConfig() {
  const [transactions, setTransactions] = useState<TransacaoPJ[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterConciliado, setFilterConciliado] = useState("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const { periodFilter, setPeriodFilter, dateStart, setDateStart, dateEnd, setDateEnd } = usePeriodFilter("max");

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, raw: true }) as unknown[][];

        // Find header row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (Array.isArray(row) && row.some((c) => String(c).toLowerCase().includes("data hora"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          alert("Formato de arquivo não reconhecido. Verifique se o arquivo possui a coluna 'Data hora'.");
          setLoading(false);
          return;
        }

        const parsed: TransacaoPJ[] = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || !row[0]) continue;
          const dt = parseExcelDate(row[0]);
          if (!dt) continue;

          parsed.push({
            dataHora: dt,
            historico: String(row[1] ?? ""),
            cartao: String(row[2] ?? ""),
            nomeCartao: String(row[3] ?? ""),
            credito: parseCurrency(row[4]),
            debito: parseCurrency(row[5]),
            saldo: parseCurrency(row[6]),
            situacao: String(row[7] ?? ""),
            descricao: String(row[8] ?? ""),
            categoria: String(row[9] ?? ""),
            centroCusto: String(row[10] ?? ""),
            valorIOF: parseCurrency(row[11]),
            cotacaoDolar: parseCurrency(row[12]),
            cpfCnpjOrigemDestino: String(row[13] ?? ""),
            conciliado: String(row[14] ?? ""),
          });
        }

        parsed.sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
        setTransactions(parsed);
      } catch (err) {
        console.error("Erro ao processar arquivo:", err);
        alert("Erro ao processar o arquivo. Verifique o formato.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so re-uploading same file works
    e.target.value = "";
  }, []);

  const tipos = useMemo(() => {
    const set = new Set(transactions.map((t) => detectTipo(t.historico)));
    return Array.from(set).sort();
  }, [transactions]);

  const categorias = useMemo(() => {
    const set = new Set(transactions.map((t) => t.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const startOfPeriod = new Date(dateStart.getFullYear(), dateStart.getMonth(), dateStart.getDate(), 0, 0, 0);
    const endOfPeriod = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), dateEnd.getDate(), 23, 59, 59, 999);

    return transactions.filter((tx) => {
      if (tx.dataHora < startOfPeriod || tx.dataHora > endOfPeriod) return false;
      if (filterTipo !== "all" && detectTipo(tx.historico) !== filterTipo) return false;
      if (filterConciliado !== "all" && tx.conciliado.toUpperCase() !== filterConciliado) return false;
      if (filterCategoria !== "all" && tx.categoria !== filterCategoria) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          tx.historico.toLowerCase().includes(term) ||
          tx.cpfCnpjOrigemDestino.toLowerCase().includes(term) ||
          tx.descricao.toLowerCase().includes(term) ||
          tx.categoria.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, dateStart, dateEnd, filterTipo, filterConciliado, filterCategoria, searchTerm]);

  const totals = useMemo(() => {
    const totalCredito = filtered.reduce((s, t) => s + t.credito, 0);
    const totalDebito = filtered.reduce((s, t) => s + t.debito, 0);
    return { credito: totalCredito, debito: totalDebito, liquido: totalCredito - totalDebito, count: filtered.length };
  }, [filtered]);

  const hasActiveFilters = filterTipo !== "all" || filterConciliado !== "all" || filterCategoria !== "all" || searchTerm !== "";

  const clearFilters = () => {
    setFilterTipo("all");
    setFilterConciliado("all");
    setFilterCategoria("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <label
              htmlFor="pj-upload"
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Arraste ou clique para importar o extrato</p>
                <p className="text-xs text-muted-foreground mt-1">Arquivo .xlsx exportado da Conta Simples</p>
              </div>
              <input id="pj-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* File info + re-upload */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">{transactions.length} transações</Badge>
            </div>
            <label htmlFor="pj-reupload" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Importar novo arquivo
                </span>
              </Button>
              <input id="pj-reupload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  Entradas
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totals.credito)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  Saídas
                </div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totals.debito)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Wallet className="h-3.5 w-3.5" />
                  Líquido
                </div>
                <p className={`text-lg font-bold ${totals.liquido >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totals.liquido)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Filter className="h-3.5 w-3.5" />
                  Transações
                </div>
                <p className="text-lg font-bold">{totals.count}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter
              value={periodFilter}
              onChange={setPeriodFilter}
              dateStart={dateStart}
              dateEnd={dateEnd}
              onDateStartChange={setDateStart}
              onDateEndChange={setDateEnd}
            />

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterConciliado} onValueChange={setFilterConciliado}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Conciliado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SIM">Conciliado</SelectItem>
                <SelectItem value="NÃO">Não conciliado</SelectItem>
              </SelectContent>
            </Select>

            {categorias.length > 0 && (
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[180px] h-9"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Transactions table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead className="whitespace-nowrap">Tipo</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Crédito</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Débito</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Saldo</TableHead>
                      <TableHead className="whitespace-nowrap">CPF/CNPJ</TableHead>
                      <TableHead className="whitespace-nowrap">Categoria</TableHead>
                      <TableHead className="whitespace-nowrap">Conciliado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((tx, i) => {
                        const tipo = detectTipo(tx.historico);
                        return (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDate(tx.dataHora)}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate" title={tx.historico}>
                              {tx.historico}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                {tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-green-600 font-medium whitespace-nowrap">
                              {tx.credito > 0 ? formatCurrency(tx.credito) : ""}
                            </TableCell>
                            <TableCell className="text-right text-xs text-red-600 font-medium whitespace-nowrap">
                              {tx.debito > 0 ? formatCurrency(tx.debito) : ""}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium whitespace-nowrap">
                              {formatCurrency(tx.saldo)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{tx.cpfCnpjOrigemDestino}</TableCell>
                            <TableCell className="text-xs">{tx.categoria || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={tx.conciliado.toUpperCase() === "SIM" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {tx.conciliado || "—"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
}
