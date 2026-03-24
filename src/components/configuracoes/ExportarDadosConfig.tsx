import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Database, Loader2, CheckSquare, Square, FileJson } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

const ALL_TABLES = [
  "admin_client_notifications", "admin_notification_instances", "admin_users",
  "agendamentos", "agendamentos_excluidos_log", "ai_ads_reports", "apify_config",
  "assistente_contexto", "audios_predefinidos", "ausencias_membros", "ausencias_profissionais",
  "avisos_agendamento", "avisos_enviados_log", "avisos_reuniao", "avisos_reuniao_log",
  "blocos_audios_predefinidos", "blocos_mensagens_predefinidas", "categorias_despesas",
  "cliente_plataformas_ia", "cobranca_pagamentos", "cobrancas", "comissoes",
  "conta_pj_extratos", "despesas", "despesas_ajustes", "despesas_exclusoes_mensais",
  "disparos_aquecimento_config", "disparos_campanha_contatos", "disparos_campanha_snapshots",
  "disparos_campanha_variacoes", "disparos_campanhas", "disparos_chat_deletions",
  "disparos_chat_kanban", "disparos_chats", "disparos_config", "disparos_instancias",
  "disparos_kanban_columns", "disparos_kanban_config", "disparos_messages",
  "disparos_supabase_config", "disparos_template_variacoes", "disparos_templates",
  "documents", "escalas_membros", "escalas_profissionais", "facebook_ad_accounts",
  "facebook_config", "fatura_agendamentos", "fatura_pagamentos", "fatura_upsells",
  "faturas", "faturas_excluidas_log", "fireflies_config", "formularios_config",
  "formularios_etapas", "formularios_leads", "formularios_leads_historico",
  "formularios_sessoes", "formularios_templates", "google_ads_accounts",
  "google_ads_config", "google_calendar_config", "historico_leads", "instagram_config",
  "instagram_fluxos", "instagram_formularios", "instagram_formularios_respostas",
  "instagram_gatilhos", "instagram_interacoes", "instagram_mensagens",
  "lead_status_custom", "leads", "lista_campos_sistema", "lista_importada_contatos",
  "listas_extrator", "listas_importadas", "mensagens_predefinidas",
  "meta_conversion_events", "meta_pixel_config", "metricas_preferencias",
  "openai_config", "panel_tabs_config", "personalizacao_config",
  "procedimento_profissional", "procedimentos", "produto_template_tarefas",
  "produto_templates", "produtos", "profiles", "profissionais",
  "reuniao_campos_preenchidos", "reuniao_template_campos", "reunioes",
  "reunioes_agendadas", "stripe_config", "subscription_audit",
  "tarefa_grid_highlights", "tarefa_grid_posts", "tarefa_links", "tarefa_mockups",
  "tarefa_revisoes", "tarefas", "tarefas_cargos", "tarefas_clientes",
  "tarefas_colunas", "tarefas_membros", "tarefas_notificacao_config",
  "tipo_agendamento_custom", "tipos_reuniao", "tipos_reuniao_membros",
  "tipos_tarefas", "uazapi_config", "user_feature_access", "user_roles",
  "user_subscriptions", "webhook_logs", "webhook_message_dedup",
  "whatsapp_chat_deletions", "whatsapp_chat_kanban", "whatsapp_chat_labels",
  "whatsapp_chats", "whatsapp_kanban_columns", "whatsapp_kanban_config",
  "whatsapp_labels", "whatsapp_messages", "whatsapp_sync_status",
];

export function ExportarDadosConfig() {
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_TABLES));
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, table: "" });
  const [results, setResults] = useState<Record<string, number>>({});

  const toggleTable = (table: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_TABLES));
  const selectNone = () => setSelected(new Set());

  const fetchAllRows = async (tableName: string) => {
    const allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return allRows;
  };

  const exportData = async () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos uma tabela");
      return;
    }

    setExporting(true);
    setResults({});
    const tables = Array.from(selected);
    setProgress({ current: 0, total: tables.length, table: "" });

    const exportObj: Record<string, any[]> = {};
    const exportResults: Record<string, number> = {};

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      setProgress({ current: i + 1, total: tables.length, table });

      try {
        const rows = await fetchAllRows(table);
        exportObj[table] = rows;
        exportResults[table] = rows.length;
      } catch (err: any) {
        console.error(`Erro ao exportar ${table}:`, err);
        exportObj[table] = [];
        exportResults[table] = -1;
      }
    }

    setResults(exportResults);

    // Generate JSON file
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supabase_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also generate SQL INSERT statements
    const sqlParts: string[] = [];
    for (const table of tables) {
      const rows = exportObj[table];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
          if (typeof v === "number") return String(v);
          if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sqlParts.push(
          `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT DO NOTHING;`
        );
      }
    }

    if (sqlParts.length > 0) {
      const sqlBlob = new Blob([sqlParts.join("\n")], { type: "text/sql" });
      const sqlUrl = URL.createObjectURL(sqlBlob);
      const sqlA = document.createElement("a");
      sqlA.href = sqlUrl;
      sqlA.download = `supabase_export_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(sqlA);
      sqlA.click();
      document.body.removeChild(sqlA);
      URL.revokeObjectURL(sqlUrl);
    }

    setExporting(false);
    toast.success("Exportação concluída! Arquivos JSON e SQL baixados.");
  };

  const totalSelected = selected.size;
  const totalRows = Object.values(results).reduce((s, v) => s + (v > 0 ? v : 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Exportar Dados do Banco
          </CardTitle>
          <CardDescription>
            Selecione as tabelas que deseja exportar. Os dados serão baixados em formato JSON e SQL
            (INSERT statements) para importação no novo projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5">
              <CheckSquare className="h-4 w-4" />
              Selecionar Tudo
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone} className="gap-1.5">
              <Square className="h-4 w-4" />
              Limpar Seleção
            </Button>
            <Badge variant="secondary">
              {totalSelected} de {ALL_TABLES.length} tabelas selecionadas
            </Badge>
          </div>

          <ScrollArea className="h-[400px] border rounded-lg p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALL_TABLES.map((table) => (
                <label
                  key={table}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selected.has(table)}
                    onCheckedChange={() => toggleTable(table)}
                  />
                  <span className="font-mono text-xs truncate">{table}</span>
                  {results[table] !== undefined && (
                    <Badge
                      variant={results[table] === -1 ? "destructive" : "secondary"}
                      className="ml-auto text-[10px] px-1.5"
                    >
                      {results[table] === -1 ? "erro" : `${results[table]} rows`}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </ScrollArea>

          {exporting && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div className="text-sm">
                <span className="font-medium">
                  Exportando {progress.current}/{progress.total}:
                </span>{" "}
                <span className="font-mono text-xs">{progress.table}</span>
              </div>
            </div>
          )}

          {Object.keys(results).length > 0 && !exporting && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <span className="font-medium">Exportação finalizada:</span>{" "}
              {totalRows.toLocaleString()} registros exportados de{" "}
              {Object.values(results).filter((v) => v >= 0).length} tabelas.
            </div>
          )}

          <Button
            onClick={exportData}
            disabled={exporting || totalSelected === 0}
            className="w-full gap-2"
            size="lg"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting
              ? `Exportando... (${progress.current}/${progress.total})`
              : `Exportar ${totalSelected} Tabelas (JSON + SQL)`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
