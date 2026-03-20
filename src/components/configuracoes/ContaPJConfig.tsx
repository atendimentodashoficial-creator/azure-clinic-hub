import { useState, useMemo, useCallback } from "react";
import { Upload, FileSpreadsheet, TrendingUp, TrendingDown, Wallet, Filter, X, Search, Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PeriodFilter, usePeriodFilter } from "@/components/filters/PeriodFilter";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface TransacaoPJ {
  id: string;
  dataHora: Date;
  historico: string;
  cartao: string;
  nomeCartao: string;
  credito: number;
  debito: number;
  saldo: number;
  situacao: string;
  descricao: string;
  categoriaOriginal: string;
  categoriaCustom: string;
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
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(val);
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

const STORAGE_KEY_CATEGORIES = "conta-pj-categorias";
const STORAGE_KEY_TX_CATEGORIES = "conta-pj-tx-categorias";

function loadCustomCategories(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveCustomCategories(cats: string[]) {
  localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
}

function loadTxCategories(): Record<string, string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TX_CATEGORIES);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveTxCategories(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY_TX_CATEGORIES, JSON.stringify(map));
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(0, 65%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 70%, 50%)",
  "hsl(190, 60%, 45%)",
  "hsl(330, 60%, 55%)",
  "hsl(120, 50%, 40%)",
  "hsl(60, 70%, 45%)",
  "hsl(240, 50%, 55%)",
];

export function ContaPJConfig() {
  const [transactions, setTransactions] = useState<TransacaoPJ[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterConciliado, setFilterConciliado] = useState("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const { periodFilter, setPeriodFilter, dateStart, setDateStart, dateEnd, setDateEnd } = usePeriodFilter("max");

  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  const [txCategoryMap, setTxCategoryMap] = useState<Record<string, string>>(loadTxCategories);

  // Bulk category dialog
  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean;
    cpfCnpj: string;
    category: string;
    matchingIds: string[];
  }>({ open: false, cpfCnpj: "", category: "", matchingIds: [] });

  const applyCategory = (txId: string, category: string) => {
    const cat = category === "__none__" ? "" : category;
    const newMap = { ...txCategoryMap, [txId]: cat };
    setTxCategoryMap(newMap);
    saveTxCategories(newMap);
    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, categoriaCustom: cat } : tx
    ));
  };

  const updateTxCategory = (txId: string, category: string) => {
    applyCategory(txId, category);

    // Check if there are other transactions with the same CPF/CNPJ
    const tx = transactions.find(t => t.id === txId);
    if (!tx || !tx.cpfCnpjOrigemDestino.trim()) return;

    const cat = category === "__none__" ? "" : category;
    const sameDoc = transactions.filter(
      t => t.id !== txId &&
        t.cpfCnpjOrigemDestino.trim() === tx.cpfCnpjOrigemDestino.trim() &&
        (t.categoriaCustom || t.categoriaOriginal) !== cat
    );

    if (sameDoc.length > 0) {
      setBulkDialog({
        open: true,
        cpfCnpj: tx.cpfCnpjOrigemDestino.trim(),
        category: cat,
        matchingIds: sameDoc.map(t => t.id),
      });
    }
  };

  const applyBulkCategory = () => {
    const { matchingIds, category } = bulkDialog;
    const newMap = { ...txCategoryMap };
    matchingIds.forEach(id => { newMap[id] = category; });
    setTxCategoryMap(newMap);
    saveTxCategories(newMap);
    setTransactions(prev => prev.map(tx =>
      matchingIds.includes(tx.id) ? { ...tx, categoriaCustom: category } : tx
    ));
    setBulkDialog({ open: false, cpfCnpj: "", category: "", matchingIds: [] });
    toast.success(`Categoria aplicada a ${matchingIds.length} transações`);
  };

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (customCategories.includes(name)) { toast.error("Categoria já existe"); return; }
    const updated = [...customCategories, name].sort();
    setCustomCategories(updated);
    saveCustomCategories(updated);
    setNewCatName("");
    toast.success("Categoria criada");
  };

  const startEditCat = (cat: string) => { setEditingCat(cat); setEditCatName(cat); };

  const saveEditCat = () => {
    const name = editCatName.trim();
    if (!name || !editingCat) return;
    if (name !== editingCat && customCategories.includes(name)) { toast.error("Categoria já existe"); return; }
    const updated = customCategories.map(c => c === editingCat ? name : c).sort();
    setCustomCategories(updated);
    saveCustomCategories(updated);
    const newMap = { ...txCategoryMap };
    for (const key in newMap) { if (newMap[key] === editingCat) newMap[key] = name; }
    setTxCategoryMap(newMap);
    saveTxCategories(newMap);
    setTransactions(prev => prev.map(tx =>
      tx.categoriaCustom === editingCat ? { ...tx, categoriaCustom: name } : tx
    ));
    setEditingCat(null);
    toast.success("Categoria atualizada");
  };

  const deleteCategory = (cat: string) => {
    const updated = customCategories.filter(c => c !== cat);
    setCustomCategories(updated);
    saveCustomCategories(updated);
    const newMap = { ...txCategoryMap };
    for (const key in newMap) { if (newMap[key] === cat) delete newMap[key]; }
    setTxCategoryMap(newMap);
    saveTxCategories(newMap);
    setTransactions(prev => prev.map(tx =>
      tx.categoriaCustom === cat ? { ...tx, categoriaCustom: "" } : tx
    ));
    toast.success("Categoria removida");
  };

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
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (Array.isArray(row) && row.some((c) => String(c).toLowerCase().includes("data hora"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          alert("Formato de arquivo não reconhecido.");
          setLoading(false);
          return;
        }

        const savedMap = loadTxCategories();
        const parsed: TransacaoPJ[] = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || !row[0]) continue;
          const dt = parseExcelDate(row[0]);
          if (!dt) continue;
          const id = `${dt.getTime()}-${i}`;
          parsed.push({
            id,
            dataHora: dt,
            historico: String(row[1] ?? ""),
            cartao: String(row[2] ?? ""),
            nomeCartao: String(row[3] ?? ""),
            credito: parseCurrency(row[4]),
            debito: parseCurrency(row[5]),
            saldo: parseCurrency(row[6]),
            situacao: String(row[7] ?? ""),
            descricao: String(row[8] ?? ""),
            categoriaOriginal: String(row[9] ?? ""),
            categoriaCustom: savedMap[id] || String(row[9] ?? ""),
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
        alert("Erro ao processar o arquivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);

  const tipos = useMemo(() => {
    const set = new Set(transactions.map((t) => detectTipo(t.historico)));
    return Array.from(set).sort();
  }, [transactions]);

  const allCategories = useMemo(() => {
    const fromTx = new Set(transactions.map(t => t.categoriaCustom || t.categoriaOriginal).filter(Boolean));
    customCategories.forEach(c => fromTx.add(c));
    return Array.from(fromTx).sort();
  }, [transactions, customCategories]);

  const filtered = useMemo(() => {
    const startOfPeriod = new Date(dateStart.getFullYear(), dateStart.getMonth(), dateStart.getDate(), 0, 0, 0);
    const endOfPeriod = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), dateEnd.getDate(), 23, 59, 59, 999);

    return transactions.filter((tx) => {
      if (tx.dataHora < startOfPeriod || tx.dataHora > endOfPeriod) return false;
      if (filterTipo !== "all" && detectTipo(tx.historico) !== filterTipo) return false;
      if (filterConciliado !== "all" && tx.conciliado.toUpperCase() !== filterConciliado) return false;
      if (filterCategoria !== "all") {
        const cat = tx.categoriaCustom || tx.categoriaOriginal;
        if (cat !== filterCategoria) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          tx.historico.toLowerCase().includes(term) ||
          tx.cpfCnpjOrigemDestino.toLowerCase().includes(term) ||
          tx.descricao.toLowerCase().includes(term) ||
          (tx.categoriaCustom || tx.categoriaOriginal).toLowerCase().includes(term);
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

  // Chart data by category
  const categoryChartData = useMemo(() => {
    const map: Record<string, { credito: number; debito: number }> = {};
    filtered.forEach(tx => {
      const cat = tx.categoriaCustom || tx.categoriaOriginal || "Sem categoria";
      if (!map[cat]) map[cat] = { credito: 0, debito: 0 };
      map[cat].credito += tx.credito;
      map[cat].debito += tx.debito;
    });
    return Object.entries(map)
      .map(([name, vals]) => ({ name, credito: vals.credito, debito: vals.debito, total: vals.credito + vals.debito }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const pieData = useMemo(() => {
    return categoryChartData
      .filter(d => d.debito > 0)
      .map(d => ({ name: d.name, value: d.debito }));
  }, [categoryChartData]);

  const hasActiveFilters = filterTipo !== "all" || filterConciliado !== "all" || filterCategoria !== "all" || searchTerm !== "";

  const clearFilters = () => {
    setFilterTipo("all");
    setFilterConciliado("all");
    setFilterCategoria("all");
    setSearchTerm("");
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-xl text-xs">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name === "credito" ? "Entradas" : "Saídas"}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-xl text-xs">
        <p className="font-medium">{payload[0].name}</p>
        <p>{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">{transactions.length} transações</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCatDialog(true)}>
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Categorias
          </Button>
          <label htmlFor="pj-upload" className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {transactions.length > 0 ? "Importar novo" : "Importar extrato"}
              </span>
            </Button>
            <input id="pj-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {/* Upload area when empty */}
      {transactions.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <label
              htmlFor="pj-upload-main"
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Arraste ou clique para importar o extrato</p>
                <p className="text-xs text-muted-foreground mt-1">Arquivo .xlsx exportado da Conta Simples</p>
              </div>
              <input id="pj-upload-main" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {transactions.length > 0 && (
        <>
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

          {/* Charts */}
          {categoryChartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Bar Chart */}
              <Card>
                <CardContent className="pt-4 pb-2 px-4">
                  <p className="text-sm font-medium mb-3">Entradas e Saídas por Categoria</p>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData} margin={{ top: 5, right: 5, left: 5, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          className="fill-muted-foreground"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="credito" name="credito" fill="hsl(150, 60%, 45%)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="debito" name="debito" fill="hsl(0, 65%, 55%)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardContent className="pt-4 pb-2 px-4">
                  <p className="text-sm font-medium mb-3">Distribuição de Saídas por Categoria</p>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                          style={{ fontSize: 10 }}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterConciliado} onValueChange={setFilterConciliado}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Conciliado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SIM">Conciliado</SelectItem>
                <SelectItem value="NÃO">Não conciliado</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-[180px] h-9" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
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
                      <TableHead className="whitespace-nowrap">CPF/CNPJ</TableHead>
                      <TableHead className="whitespace-nowrap min-w-[140px]">Categoria</TableHead>
                      <TableHead className="whitespace-nowrap">Conciliado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((tx) => {
                        const tipo = detectTipo(tx.historico);
                        const currentCat = tx.categoriaCustom || tx.categoriaOriginal;
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDate(tx.dataHora)}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate" title={tx.historico}>
                              {tx.historico}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">{tipo}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-green-600 font-medium whitespace-nowrap">
                              {tx.credito > 0 ? formatCurrency(tx.credito) : ""}
                            </TableCell>
                            <TableCell className="text-right text-xs text-red-600 font-medium whitespace-nowrap">
                              {tx.debito > 0 ? formatCurrency(tx.debito) : ""}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{tx.cpfCnpjOrigemDestino}</TableCell>
                            <TableCell>
                              <Select
                                value={currentCat || "__none__"}
                                onValueChange={(val) => updateTxCategory(tx.id, val)}
                              >
                                <SelectTrigger className="h-7 text-xs w-[130px]">
                                  <SelectValue placeholder="Sem categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sem categoria</SelectItem>
                                  {allCategories.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
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

      {/* Bulk category dialog */}
      <Dialog open={bulkDialog.open} onOpenChange={(open) => !open && setBulkDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aplicar a mesmas transações?</DialogTitle>
            <DialogDescription>
              Encontramos <strong>{bulkDialog.matchingIds.length}</strong> outra(s) transação(ões) com o CPF/CNPJ <strong>{bulkDialog.cpfCnpj}</strong>.
              Deseja aplicar a categoria "<strong>{bulkDialog.category || "Sem categoria"}</strong>" a todas?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(prev => ({ ...prev, open: false }))}>
              Não, apenas esta
            </Button>
            <Button onClick={applyBulkCategory}>
              Sim, aplicar a todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories management dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button size="sm" onClick={addCategory} disabled={!newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {customCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma categoria criada. Adicione acima.
                </p>
              ) : (
                customCategories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50">
                    {editingCat === cat ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEditCat()}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={saveEditCat}>OK</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingCat(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm">{cat}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditCat(cat)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCategory(cat)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
