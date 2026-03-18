import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_BASE_URL = "https://n8n.srv1179055.hstgr.cloud";

interface StepResult {
  step: string;
  success: boolean;
  detail?: string;
  error?: string;
}

const N8N_ALLOWED_NODE_KEYS = new Set([
  "id",
  "name",
  "type",
  "typeVersion",
  "position",
  "parameters",
  "credentials",
  "disabled",
  "notes",
  "notesInFlow",
  "continueOnFail",
  "alwaysOutputData",
  "executeOnce",
  "retryOnFail",
  "maxTries",
  "waitBetweenTries",
  "onError",
]);

const sanitizeN8nNode = (node: any) => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(node || {})) {
    if (N8N_ALLOWED_NODE_KEYS.has(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  // Remove fields that commonly break create API validation
  delete sanitized.webhookId;
  delete sanitized.pinData;
  delete sanitized.issues;

  if (!sanitized.parameters || typeof sanitized.parameters !== "object") {
    sanitized.parameters = {};
  }

  return sanitized;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const results: StepResult[] = [];

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ──
    const body = await req.json();
    const instance_id = body.instance_id || body.instancia_id;
    const { phone_last4 } = body;

    if (!instance_id || !phone_last4) {
      return new Response(JSON.stringify({ success: false, error: "instance_id e phone_last4 são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`=== Setup workflows for instance ${instance_id}, phone_last4: ${phone_last4} ===`);

    // ── Get instance details ──
    const { data: instance, error: instErr } = await supabase
      .from("disparos_instancias")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ success: false, error: "Instância não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get external Supabase config ──
    const { data: extConfig } = await supabase
      .from("disparos_supabase_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!extConfig?.supabase_url || !extConfig?.supabase_service_key) {
      return new Response(JSON.stringify({ success: false, error: "Configure o Supabase externo primeiro (Agente I.A. → Supabase)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extSupabase = createClient(extConfig.supabase_url, extConfig.supabase_service_key);

    // ── Get n8n API key ──
    const N8N_API_KEY = Deno.env.get("N8N_API_KEY");
    if (!N8N_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "N8N_API_KEY não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const n8nHeaders = { "X-N8N-API-KEY": N8N_API_KEY, "Content-Type": "application/json" };

    // ═══════════════════════════════════════════
    // STEP 1: Determine next table number
    // ═══════════════════════════════════════════
    console.log("Step 1: Determining next table number...");

    let nextTableNum = 1;
    try {
      // Fallback strategy: detect the first missing leads_whatsappN table via PostgREST
      // (works even when external SQL RPC functions are unavailable)
      for (let i = 1; i <= 200; i++) {
        const checkRes = await fetch(
          `${extConfig.supabase_url}/rest/v1/leads_whatsapp${i}?select=id&limit=1`,
          {
            headers: {
              "apikey": extConfig.supabase_service_key,
              "Authorization": `Bearer ${extConfig.supabase_service_key}`,
            },
          }
        );

        if (checkRes.status === 404 || checkRes.status === 400) {
          nextTableNum = i;
          break;
        }

        if (i === 200) {
          nextTableNum = 201;
        }
      }
    } catch (e: any) {
      console.error("Error determining table number:", e);
      // Will use default 1
    }

    const tableName = `leads_whatsapp${nextTableNum}`;
    console.log(`Next table: ${tableName}`);
    results.push({ step: "determine_table_number", success: true, detail: tableName });

    // ═══════════════════════════════════════════
    // STEP 2: Copy table structure from existing table
    // ═══════════════════════════════════════════
    console.log("Step 2: Creating table in external Supabase...");

    try {
      // Find an existing leads_whatsapp table to copy structure from
      let sourceTable = "leads_whatsapp";
      if (nextTableNum > 1) {
        // Try the previous numbered table first
        const checkRes = await fetch(
          `${extConfig.supabase_url}/rest/v1/leads_whatsapp${nextTableNum - 1}?select=id&limit=1`,
          {
            headers: {
              "apikey": extConfig.supabase_service_key,
              "Authorization": `Bearer ${extConfig.supabase_service_key}`,
            },
          }
        );
        if (checkRes.ok) {
          sourceTable = `leads_whatsapp${nextTableNum - 1}`;
        }
      }

      // Use SQL to create table with same structure
      const createTableSQL = `CREATE TABLE IF NOT EXISTS public.${tableName} (LIKE public.${sourceTable} INCLUDING ALL);`;

      // Execute via Supabase Management API or direct SQL
      // Since we're using service_role, we can use the SQL endpoint
      const sqlRes = await fetch(`${extConfig.supabase_url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "apikey": extConfig.supabase_service_key,
          "Authorization": `Bearer ${extConfig.supabase_service_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: createTableSQL }),
      });

      if (!sqlRes.ok) {
        // Fallback: try pg-meta or another approach
        // Try using the Supabase SQL editor API
        const pgMetaRes = await fetch(`${extConfig.supabase_url}/pg/query`, {
          method: "POST",
          headers: {
            "apikey": extConfig.supabase_service_key,
            "Authorization": `Bearer ${extConfig.supabase_service_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: createTableSQL }),
        });

        if (!pgMetaRes.ok) {
          // Last resort: try using a known RPC function
          const lastRes = await fetch(`${extConfig.supabase_url}/rest/v1/rpc/execute_sql`, {
            method: "POST",
            headers: {
              "apikey": extConfig.supabase_service_key,
              "Authorization": `Bearer ${extConfig.supabase_service_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql: createTableSQL }),
          });

          if (!lastRes.ok) {
            const errText = await lastRes.text().catch(() => "");
            throw new Error(`Não foi possível criar tabela. Verifique se a função exec_sql ou execute_sql existe no Supabase externo. Erro: ${errText}`);
          }
        }
      }

      results.push({ step: "create_table", success: true, detail: `Tabela ${tableName} criada a partir de ${sourceTable}` });
    } catch (e: any) {
      console.error("Error creating table:", e);
      const msg = `Falha ao criar tabela no Supabase externo: ${e.message}`;
      results.push({ step: "create_table", success: false, error: msg });

      return new Response(JSON.stringify({
        success: false,
        error: msg,
        message: msg,
        table_name: tableName,
        steps: results,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════
    // STEP 3: Find template workflows in n8n by tags
    // ═══════════════════════════════════════════
    console.log("Step 3: Finding template workflows in n8n...");

    let sdrTemplateId: string | null = null;
    let followUpTemplateId: string | null = null;

    try {
      const wfRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows?limit=100`, { headers: n8nHeaders });
      if (!wfRes.ok) throw new Error(`Failed to list workflows: ${wfRes.status}`);
      const wfData = await wfRes.json();

      for (const wf of wfData.data || []) {
        const fullRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${wf.id}`, { headers: n8nHeaders });
        if (!fullRes.ok) continue;
        const fullWf = await fullRes.json();

        const tags = (fullWf.tags || []).map((t: any) => (t.name || t).toLowerCase());

        if (tags.includes("sdr") && !sdrTemplateId) {
          sdrTemplateId = wf.id;
          console.log(`Found SDR template: ${wf.id} (${wf.name})`);
        }
        if ((tags.includes("follow up") || tags.includes("followup") || tags.includes("follow-up")) && !followUpTemplateId) {
          followUpTemplateId = wf.id;
          console.log(`Found Follow-up template: ${wf.id} (${wf.name})`);
        }

        if (sdrTemplateId && followUpTemplateId) break;
      }

      if (!sdrTemplateId) results.push({ step: "find_sdr_template", success: false, error: "Nenhum workflow com tag 'sdr' encontrado no n8n" });
      else results.push({ step: "find_sdr_template", success: true, detail: `ID: ${sdrTemplateId}` });

      if (!followUpTemplateId) results.push({ step: "find_followup_template", success: false, error: "Nenhum workflow com tag 'follow up' encontrado no n8n" });
      else results.push({ step: "find_followup_template", success: true, detail: `ID: ${followUpTemplateId}` });
    } catch (e: any) {
      console.error("Error finding templates:", e);
      results.push({ step: "find_templates", success: false, error: e.message });
    }

    // ═══════════════════════════════════════════
    // STEP 4: Clone SDR workflow and configure
    // ═══════════════════════════════════════════
    let clonedSdrId: string | null = null;
    let sdrWebhookUrl: string | null = null;

    if (sdrTemplateId) {
      console.log("Step 4: Cloning SDR workflow...");
      try {
        // Get full template workflow
        const templateRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${sdrTemplateId}`, { headers: n8nHeaders });
        if (!templateRes.ok) throw new Error(`Failed to get SDR template: ${templateRes.status}`);
        const templateWf = await templateRes.json();

        // Modify nodes: update Supabase table references and webhook path
        const newNodes = templateWf.nodes.map((node: any) => {
          const modified = { ...sanitizeN8nNode(node), id: crypto.randomUUID() };

          // Update Supabase nodes - look for table name references
          if (node.type?.includes("supabase") || node.type?.includes("Supabase")) {
            const params = modified.parameters || {};
            // Update table name in various parameter locations
            if (params.tableId) params.tableId = tableName;
            if (params.table) params.table = tableName;
            if (params.resource === "row" && params.additionalFields?.table) {
              params.additionalFields.table = tableName;
            }
            // Check for SQL-like text fields
            for (const key of Object.keys(params)) {
              if (typeof params[key] === "string" && params[key].match(/leads_whatsapp\d*/)) {
                params[key] = params[key].replace(/leads_whatsapp\d*/g, tableName);
              }
            }
            modified.parameters = params;
          }

          // Update HTTP Request nodes that reference Supabase REST API
          if (node.type === "n8n-nodes-base.httpRequest" || node.type === "n8n-nodes-base.httpRequestTool") {
            const params = modified.parameters || {};
            if (typeof params.url === "string" && params.url.includes("leads_whatsapp")) {
              params.url = params.url.replace(/leads_whatsapp\d*/g, tableName);
            }
            // Also check body parameters
            if (params.bodyParameters?.parameters) {
              for (const bp of params.bodyParameters.parameters) {
                if (typeof bp.value === "string" && bp.value.includes("leads_whatsapp")) {
                  bp.value = bp.value.replace(/leads_whatsapp\d*/g, tableName);
                }
              }
            }
            // Check sendBody content
            if (typeof params.body === "string" && params.body.includes("leads_whatsapp")) {
              params.body = params.body.replace(/leads_whatsapp\d*/g, tableName);
            }
            modified.parameters = params;
          }

          // Update webhook trigger path
          if (node.type === "n8n-nodes-base.webhook" || node.type?.includes("webhook")) {
            const params = modified.parameters || {};
            params.path = phone_last4;
            modified.parameters = params;
          }

          // Deep replace table name in any string parameter
          const replaceInObj = (obj: any): any => {
            if (typeof obj === "string") {
              return obj.replace(/leads_whatsapp\d*/g, tableName);
            }
            if (Array.isArray(obj)) return obj.map(replaceInObj);
            if (obj && typeof obj === "object") {
              const result: any = {};
              for (const [k, v] of Object.entries(obj)) {
                result[k] = replaceInObj(v);
              }
              return result;
            }
            return obj;
          };

          modified.parameters = replaceInObj(modified.parameters);
          return modified;
        });

        // Create new workflow
        const newWfName = `SDR - ${instance.nome} (${phone_last4})`;
        const createRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
          method: "POST",
          headers: n8nHeaders,
          body: JSON.stringify({
            name: newWfName,
            nodes: newNodes,
            connections: templateWf.connections,
            settings: {
              executionOrder: templateWf.settings?.executionOrder ?? "v1",
              timezone: templateWf.settings?.timezone ?? "America/Sao_Paulo",
            },
          }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Failed to create SDR workflow: ${createRes.status} ${errText}`);
        }

        const createdWf = await createRes.json();
        clonedSdrId = createdWf.id;
        sdrWebhookUrl = `${N8N_BASE_URL}/webhook/${phone_last4}`;

        // Activate the workflow
        await fetch(`${N8N_BASE_URL}/api/v1/workflows/${clonedSdrId}/activate`, {
          method: "POST",
          headers: n8nHeaders,
        });

        results.push({ step: "clone_sdr", success: true, detail: `Workflow "${newWfName}" criado (ID: ${clonedSdrId})` });
      } catch (e: any) {
        console.error("Error cloning SDR:", e);
        const msg = `Falha ao clonar workflow SDR: ${e.message}`;
        results.push({ step: "clone_sdr", success: false, error: msg });

        return new Response(JSON.stringify({
          success: false,
          error: msg,
          message: msg,
          table_name: tableName,
          steps: results,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 5: Clone Follow-up workflow and configure
    // ═══════════════════════════════════════════
    let clonedFollowUpId: string | null = null;
    const followUpWebhookPath = `fupnokta${nextTableNum}`;

    if (followUpTemplateId) {
      console.log("Step 5: Cloning Follow-up workflow...");
      try {
        const templateRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${followUpTemplateId}`, { headers: n8nHeaders });
        if (!templateRes.ok) throw new Error(`Failed to get Follow-up template: ${templateRes.status}`);
        const templateWf = await templateRes.json();

        const newNodes = templateWf.nodes.map((node: any) => {
          const modified = { ...sanitizeN8nNode(node), id: crypto.randomUUID() };

          // Deep replace table name
          const replaceInObj = (obj: any): any => {
            if (typeof obj === "string") {
              return obj.replace(/leads_whatsapp\d*/g, tableName);
            }
            if (Array.isArray(obj)) return obj.map(replaceInObj);
            if (obj && typeof obj === "object") {
              const result: any = {};
              for (const [k, v] of Object.entries(obj)) {
                result[k] = replaceInObj(v);
              }
              return result;
            }
            return obj;
          };

          modified.parameters = replaceInObj(modified.parameters);

          // Update webhook trigger path
          if (node.type === "n8n-nodes-base.webhook" || node.type?.includes("webhook")) {
            const params = modified.parameters || {};
            params.path = followUpWebhookPath;
            modified.parameters = params;
          }

          // Update Edit Fields node with instance token
          if (node.type === "n8n-nodes-base.set" || node.name?.toLowerCase().includes("edit fields") || node.name?.toLowerCase().includes("tratar dados")) {
            const params = modified.parameters || {};
            // Look for token_instancia or similar field and update
            if (params.assignments?.assignments) {
              for (const assignment of params.assignments.assignments) {
                if (assignment.name === "token_instancia" || assignment.name?.includes("token")) {
                  assignment.value = instance.api_key;
                }
              }
            }
            // Also check values array (older n8n format)
            if (params.values?.string) {
              for (const val of params.values.string) {
                if (val.name === "token_instancia" || val.name?.includes("token")) {
                  val.value = instance.api_key;
                }
              }
            }
            modified.parameters = params;
          }

          return modified;
        });

        const newWfName = `Follow-up - ${instance.nome} (${phone_last4})`;
        const createRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
          method: "POST",
          headers: n8nHeaders,
          body: JSON.stringify({
            name: newWfName,
            nodes: newNodes,
            connections: templateWf.connections,
            settings: {
              executionOrder: templateWf.settings?.executionOrder ?? "v1",
              timezone: templateWf.settings?.timezone ?? "America/Sao_Paulo",
            },
          }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Failed to create Follow-up workflow: ${createRes.status} ${errText}`);
        }

        const createdWf = await createRes.json();
        clonedFollowUpId = createdWf.id;

        // Activate the workflow
        await fetch(`${N8N_BASE_URL}/api/v1/workflows/${clonedFollowUpId}/activate`, {
          method: "POST",
          headers: n8nHeaders,
        });

        results.push({ step: "clone_followup", success: true, detail: `Workflow "${newWfName}" criado (ID: ${clonedFollowUpId})` });
      } catch (e: any) {
        console.error("Error cloning Follow-up:", e);
        results.push({ step: "clone_followup", success: false, error: e.message });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 6: Execute follow-up SQL in external Supabase
    // ═══════════════════════════════════════════
    if (clonedFollowUpId) {
      console.log("Step 6: Executing follow-up SQL...");
      try {
        const funcName = `disparar_followup${nextTableNum}`;
        const cronName = `followup_check${nextTableNum}`;
        const followUpWebhookUrl = `${N8N_BASE_URL}/webhook/${followUpWebhookPath}`;

        const followUpSQL = `
          CREATE EXTENSION IF NOT EXISTS pg_net;
          CREATE EXTENSION IF NOT EXISTS pg_cron;

          CREATE OR REPLACE FUNCTION ${funcName}()
          RETURNS void
          LANGUAGE plpgsql
          AS $$
          DECLARE
            r record;
            horas_diff int;
            agora timestamp := now();
          BEGIN
            FOR r IN
              SELECT id, hora_ultima_mensagem
              FROM ${tableName}
              WHERE (
                agora - hora_ultima_mensagem BETWEEN interval '1 hour' - interval '10 minutes'
                AND interval '1 hour' + interval '10 minutes'
              )
              OR (
                agora - hora_ultima_mensagem BETWEEN interval '24 hours' - interval '10 minutes'
                AND interval '24 hours' + interval '10 minutes'
              )
              OR (
                agora - hora_ultima_mensagem BETWEEN interval '72 hours' - interval '10 minutes'
                AND interval '72 hours' + interval '10 minutes'
              )
            LOOP
              horas_diff := floor((extract(epoch from (agora - r.hora_ultima_mensagem)) / 3600)::numeric);
              RAISE NOTICE 'Disparando para id %, horas: %', r.id, horas_diff;
              PERFORM net.http_post(
                url := '${followUpWebhookUrl}',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                  'cliente_id', r.id,
                  'horas_apos_ultima_mensagem', horas_diff
                )
              );
            END LOOP;
          END;
          $$;

          SELECT cron.schedule(
            '${cronName}',
            '*/10 * * * *',
            $$ SELECT ${funcName}(); $$
          );
        `;

        // Try executing SQL via various methods
        let sqlSuccess = false;

        // Method 1: exec_sql RPC
        const res1 = await fetch(`${extConfig.supabase_url}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "apikey": extConfig.supabase_service_key,
            "Authorization": `Bearer ${extConfig.supabase_service_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: followUpSQL }),
        });
        if (res1.ok) sqlSuccess = true;

        if (!sqlSuccess) {
          // Method 2: execute_sql RPC
          const res2 = await fetch(`${extConfig.supabase_url}/rest/v1/rpc/execute_sql`, {
            method: "POST",
            headers: {
              "apikey": extConfig.supabase_service_key,
              "Authorization": `Bearer ${extConfig.supabase_service_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql: followUpSQL }),
          });
          if (res2.ok) sqlSuccess = true;
        }

        if (sqlSuccess) {
          results.push({ step: "followup_sql", success: true, detail: `Função ${funcName} e cron ${cronName} criados` });
        } else {
          results.push({ step: "followup_sql", success: false, error: `Não foi possível executar SQL no Supabase externo. Execute manualmente:\n\n${followUpSQL}` });
        }
      } catch (e: any) {
        console.error("Error executing follow-up SQL:", e);
        results.push({ step: "followup_sql", success: false, error: e.message });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 7: Register SDR webhook in UAZAPI
    // ═══════════════════════════════════════════
    if (sdrWebhookUrl) {
      console.log("Step 7: Registering SDR webhook in UAZAPI...");
      try {
        const normalizedBaseUrl = instance.base_url.replace(/\/+$/, '');

        const webhookPayload = {
          url: sdrWebhookUrl,
          enabled: true,
          webhook_by_events: true,
          addUrlEvents: true,
          addUrlTypesMessages: true,
          events: ["messages"],
        };

        const endpoints = [
          { url: `${normalizedBaseUrl}/webhook/set`, method: "PUT" },
          { url: `${normalizedBaseUrl}/webhook/set`, method: "POST" },
          { url: `${normalizedBaseUrl}/webhook`, method: "PUT" },
          { url: `${normalizedBaseUrl}/webhook`, method: "POST" },
        ];

        let webhookSuccess = false;

        for (const ep of endpoints) {
          try {
            const res = await fetch(ep.url, {
              method: ep.method,
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "token": instance.api_key,
              },
              body: JSON.stringify(webhookPayload),
            });

            if (res.ok) {
              webhookSuccess = true;
              break;
            }
          } catch {}
        }

        if (webhookSuccess) {
          results.push({ step: "register_sdr_webhook", success: true, detail: `Webhook SDR registrado: ${sdrWebhookUrl}` });
        } else {
          results.push({ step: "register_sdr_webhook", success: false, error: "Não foi possível registrar webhook SDR na UAZAPI" });
        }
      } catch (e: any) {
        console.error("Error registering SDR webhook:", e);
        results.push({ step: "register_sdr_webhook", success: false, error: e.message });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 8: Save workflow references to instance
    // ═══════════════════════════════════════════
    console.log("Step 8: Saving workflow references...");
    try {
      await supabase
        .from("disparos_instancias")
        .update({
          n8n_sdr_workflow_id: clonedSdrId,
          n8n_followup_workflow_id: clonedFollowUpId,
          n8n_table_name: tableName,
          n8n_setup_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", instance_id);

      results.push({ step: "save_references", success: true, detail: "Referências salvas na instância" });
    } catch (e: any) {
      console.error("Error saving references:", e);
      results.push({ step: "save_references", success: false, error: e.message });
    }

    // ── Summary ──
    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: allSuccess,
      message: allSuccess
        ? `Automação completa! ${successCount} etapas concluídas com sucesso.`
        : `${successCount}/${results.length} etapas concluídas. Verifique os detalhes.`,
      table_name: tableName,
      sdr_workflow_id: clonedSdrId,
      followup_workflow_id: clonedFollowUpId,
      sdr_webhook_url: sdrWebhookUrl,
      followup_webhook_path: followUpWebhookPath,
      steps: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in setup-instance-workflows:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Erro desconhecido",
      steps: results,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
