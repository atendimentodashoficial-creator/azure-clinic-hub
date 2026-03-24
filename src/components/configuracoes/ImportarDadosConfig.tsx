import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Database, Loader2, CheckCircle2, XCircle, FileJson, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

export function ImportarDadosConfig() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [results, setResults] = useState<Record<string, { success: number; error: number }>>({});
  const [progress, setProgress] = useState({ current: 0, total: 0, table: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<Record<string, any[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setResults({});
    setLoadError(null);

    try {
      const text = await f.text();
      let data: Record<string, any[]>;

      if (f.name.endsWith(".json")) {
        data = JSON.parse(text) as Record<string, any[]>;
      } else if (f.name.endsWith(".sql")) {
        // Parse SQL INSERT statements into table -> rows
        data = parseSqlInserts(text);
      } else {
        // Try JSON first, then SQL
        try {
          data = JSON.parse(text) as Record<string, any[]>;
        } catch {
          data = parseSqlInserts(text);
        }
      }

      const previewMap: Record<string, number> = {};
      for (const [table, rows] of Object.entries(data)) {
        if (Array.isArray(rows)) {
          previewMap[table] = rows.length;
        }
      }

      if (Object.keys(previewMap).length === 0) {
        setLoadError("Nenhuma tabela encontrada no arquivo.");
        setPreview(null);
        setParsedData(null);
        return;
      }

      setPreview(previewMap);
      setParsedData(data);
      toast.success(`Arquivo carregado: ${Object.keys(previewMap).length} tabelas, ${Object.values(previewMap).reduce((a, b) => a + b, 0).toLocaleString()} registros`);
    } catch (err: any) {
      console.error("Erro ao ler arquivo:", err);
      setLoadError(err.message || "Erro ao ler o arquivo");
      setPreview(null);
      setParsedData(null);
    }
  };

  const parseSqlInserts = (sql: string): Record<string, any[]> => {
    const data: Record<string, any[]> = {};
    const regex = /INSERT\s+INTO\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)\s*(?:ON\s+CONFLICT|;)/gis;
    let match;

    while ((match = regex.exec(sql)) !== null) {
      const table = match[1];
      const cols = match[2].split(",").map((c) => c.trim().replace(/"/g, ""));
      const valsRaw = match[3];

      // Simple value parser
      const vals = parseValues(valsRaw);
      if (vals.length !== cols.length) continue;

      const row: Record<string, any> = {};
      cols.forEach((col, i) => {
        const v = vals[i];
        if (v === "NULL") {
          row[col] = null;
        } else if (v === "TRUE") {
          row[col] = true;
        } else if (v === "FALSE") {
          row[col] = false;
        } else if (/^-?\d+(\.\d+)?$/.test(v)) {
          row[col] = Number(v);
        } else {
          // Remove surrounding quotes and unescape
          row[col] = v.replace(/^'|'$/g, "").replace(/''/g, "'");
          // Remove ::jsonb cast and parse
          if (row[col].endsWith("::jsonb") || row[col].includes("::jsonb")) {
            const jsonStr = row[col].replace(/::jsonb$/, "");
            try {
              row[col] = JSON.parse(jsonStr);
            } catch {}
          }
        }
      });

      if (!data[table]) data[table] = [];
      data[table].push(row);
    }

    return data;
  };

  const parseValues = (raw: string): string[] => {
    const vals: string[] = [];
    let current = "";
    let inString = false;
    let depth = 0;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];

      if (inString) {
        if (ch === "'" && raw[i + 1] === "'") {
          current += "''";
          i++;
        } else if (ch === "'") {
          current += ch;
          inString = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === "'") {
          inString = true;
          current += ch;
        } else if (ch === "(" || ch === "[" || ch === "{") {
          depth++;
          current += ch;
        } else if (ch === ")" || ch === "]" || ch === "}") {
          depth--;
          current += ch;
        } else if (ch === "," && depth === 0) {
          vals.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    if (current.trim()) vals.push(current.trim());
    return vals;
  };

  const importData = async () => {
    if (!parsedData) return;

    setImporting(true);
    const tables = Object.keys(parsedData);
    setProgress({ current: 0, total: tables.length, table: "" });
    const importResults: Record<string, { success: number; error: number }> = {};

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const rows = parsedData[table];
      setProgress({ current: i + 1, total: tables.length, table });

      if (!rows || rows.length === 0) {
        importResults[table] = { success: 0, error: 0 };
        continue;
      }

      let success = 0;
      let errorCount = 0;

      const batchSize = 50;
      for (let j = 0; j < rows.length; j += batchSize) {
        const batch = rows.slice(j, j + batchSize);
        try {
          const { error } = await supabase
            .from(table as any)
            .upsert(batch as any, { onConflict: "id", ignoreDuplicates: true });

          if (error) {
            console.error(`Erro em ${table} batch ${j}:`, error.message);
            errorCount += batch.length;
          } else {
            success += batch.length;
          }
        } catch (err) {
          console.error(`Erro em ${table}:`, err);
          errorCount += batch.length;
        }
      }

      importResults[table] = { success, error: errorCount };
    }

    setResults(importResults);
    setImporting(false);

    const totalSuccess = Object.values(importResults).reduce((s, v) => s + v.success, 0);
    const totalError = Object.values(importResults).reduce((s, v) => s + v.error, 0);

    if (totalError === 0) {
      toast.success(`Importação concluída! ${totalSuccess.toLocaleString()} registros importados.`);
    } else {
      toast.warning(
        `Importação finalizada: ${totalSuccess.toLocaleString()} OK, ${totalError.toLocaleString()} erros.`
      );
    }
  };

  const totalRows = preview ? Object.values(preview).reduce((s, v) => s + v, 0) : 0;
  const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Dados
          </CardTitle>
          <CardDescription>
            Selecione o arquivo exportado (JSON ou SQL) para importar os dados no banco.
            Os registros existentes serão ignorados (sem duplicação). Aceita arquivos de qualquer tamanho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              <FileJson className="h-4 w-4" />
              {file ? file.name : "Selecionar arquivo (JSON ou SQL)"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.sql,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file && (
              <Badge variant="secondary">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            )}
          </div>

          {loadError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {loadError}
            </div>
          )}

          {preview && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                {Object.keys(preview).length} tabelas · {totalRows.toLocaleString()} registros
              </div>

              <ScrollArea className="h-[350px] border rounded-lg p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {Object.entries(preview)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([table, count]) => {
                      const result = results[table];
                      return (
                        <div
                          key={table}
                          className="flex items-center gap-2 p-2 rounded text-sm hover:bg-muted/50"
                        >
                          {result ? (
                            result.error > 0 ? (
                              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            )
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border shrink-0" />
                          )}
                          <span className="font-mono text-xs truncate flex-1">{table}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                            {count}
                          </Badge>
                          {result && result.error > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 shrink-0">
                              {result.error} err
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progressPct} className="h-2" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando {progress.current}/{progress.total}:{" "}
                <span className="font-mono text-xs">{progress.table}</span>
              </div>
            </div>
          )}

          {Object.keys(results).length > 0 && !importing && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
              <div>
                <span className="font-medium">Resultado:</span>{" "}
                {Object.values(results)
                  .reduce((s, v) => s + v.success, 0)
                  .toLocaleString()}{" "}
                importados,{" "}
                {Object.values(results)
                  .reduce((s, v) => s + v.error, 0)
                  .toLocaleString()}{" "}
                erros.
              </div>
              {Object.entries(results)
                .filter(([, v]) => v.error > 0)
                .map(([table, v]) => (
                  <div key={table} className="text-xs text-destructive font-mono">
                    ✗ {table}: {v.error} erros
                  </div>
                ))}
            </div>
          )}

          <Button
            onClick={importData}
            disabled={importing || !parsedData}
            className="w-full gap-2"
            size="lg"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing
              ? `Importando... (${progress.current}/${progress.total})`
              : `Importar Dados${preview ? ` (${totalRows.toLocaleString()} registros)` : ""}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
