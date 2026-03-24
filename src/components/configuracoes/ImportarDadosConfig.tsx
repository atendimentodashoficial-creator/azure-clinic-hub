import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Database, Loader2, CheckCircle2, XCircle, FileJson } from "lucide-react";
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith(".json")) {
      toast.error("Selecione um arquivo JSON exportado");
      return;
    }

    setFile(f);
    setResults({});

    try {
      const text = await f.text();
      const data = JSON.parse(text) as Record<string, any[]>;
      const previewMap: Record<string, number> = {};
      for (const [table, rows] of Object.entries(data)) {
        if (Array.isArray(rows)) {
          previewMap[table] = rows.length;
        }
      }
      setPreview(previewMap);
      setParsedData(data);
      toast.success(`Arquivo carregado: ${Object.keys(previewMap).length} tabelas encontradas`);
    } catch {
      toast.error("Erro ao ler o arquivo JSON");
      setPreview(null);
      setParsedData(null);
    }
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

      // Insert in batches of 100
      const batchSize = 100;
      for (let j = 0; j < rows.length; j += batchSize) {
        const batch = rows.slice(j, j + batchSize);
        try {
          const { error } = await supabase
            .from(table as any)
            .upsert(batch as any, { onConflict: "id", ignoreDuplicates: true });

          if (error) {
            console.error(`Erro em ${table} batch ${j}:`, error);
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
            Selecione o arquivo JSON exportado anteriormente para importar os dados no banco.
            Os registros existentes serão ignorados (sem duplicação).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              <FileJson className="h-4 w-4" />
              {file ? file.name : "Selecionar arquivo JSON"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file && (
              <Badge variant="secondary">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            )}
          </div>

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
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
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
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
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
