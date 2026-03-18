import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_BASE_URL = "https://n8n.srv1179055.hstgr.cloud";

interface AgentNode {
  nodeName: string;
  nodeType: string;
  systemPrompt: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  agents: AgentNode[];
  tags: string[];
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

function getN8nHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("N8N_API_KEY");
  if (!apiKey) throw new Error("N8N_API_KEY not configured");
  return { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" };
}

// Agent node types in n8n langchain
const AGENT_TYPES = [
  "@n8n/n8n-nodes-langchain.agent",
  "@n8n/n8n-nodes-langchain.agentTool",
];

function extractAgents(workflow: any): AgentNode[] {
  const agents: AgentNode[] = [];

  for (const node of workflow.nodes || []) {
    if (!AGENT_TYPES.some(t => node.type === t)) continue;

    const params = node.parameters || {};
    let systemPrompt = "";

    // Extract system prompt from various n8n agent parameter structures
    if (typeof params.options?.systemMessage === "string") {
      systemPrompt = params.options.systemMessage;
    } else if (typeof params.systemMessage === "string") {
      systemPrompt = params.systemMessage;
    }

    // Clean n8n expression prefix "="
    if (systemPrompt.startsWith("=")) {
      systemPrompt = systemPrompt.slice(1);
    }

    agents.push({
      nodeName: node.name,
      nodeType: node.type,
      systemPrompt,
    });
  }

  return agents;
}

async function listWorkflows(): Promise<WorkflowSummary[]> {
  const headers = getN8nHeaders();

  // Fetch all workflows with pagination
  const allWfData: any[] = [];
  let cursor: string | undefined;
  
  while (true) {
    const url = cursor
      ? `${N8N_BASE_URL}/api/v1/workflows?limit=250&cursor=${cursor}`
      : `${N8N_BASE_URL}/api/v1/workflows?limit=250`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to list workflows: ${res.status}`);
    const data = await res.json();
    allWfData.push(...(data.data || []));
    cursor = data.nextCursor;
    if (!cursor) break;
  }

  console.log(`[n8n] Total workflows fetched: ${allWfData.length}`);

  const workflows: WorkflowSummary[] = [];

  for (const wf of allWfData) {
    const fullRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${wf.id}`, { headers });
    if (!fullRes.ok) {
      console.log(`[n8n] Failed to get workflow ${wf.id} (${wf.name}): ${fullRes.status}`);
      continue;
    }
    const fullWf = await fullRes.json();

    const agents = extractAgents(fullWf);
    const tags = (fullWf.tags || []).map((t: any) => t.name || t);

    if (agents.length === 0) {
      console.log(`[n8n] Skipping "${wf.name}" - no agent nodes found`);
      continue;
    }

    console.log(`[n8n] Including "${wf.name}" with ${agents.length} agent(s), tags: [${tags.join(', ')}]`);

    workflows.push({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      agents,
      tags,
    });
  }

  console.log(`[n8n] Total workflows with agents: ${workflows.length}`);
  return workflows;
}

async function updateAgentPrompts(
  workflowIds: string[],
  updates: { nodeName: string; newPrompt: string }[]
): Promise<{ updated: string[]; errors: string[] }> {
  const headers = getN8nHeaders();
  const updated: string[] = [];
  const errors: string[] = [];

  for (const wfId of workflowIds) {
    try {
      const getRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${wfId}`, { headers });
      if (!getRes.ok) {
        errors.push(`${wfId}: failed to get (${getRes.status})`);
        continue;
      }
      const workflow = await getRes.json();
      let modified = false;

      for (const update of updates) {
        const node = workflow.nodes.find((n: any) => n.name === update.nodeName);
        if (!node) continue;

        // Preserve dynamic n8n suffix if present
        const dynamicSuffix = `\n\n### INFORMACOES ADICIONAIS \n-  SEMPRE considere Data e hora atual: {{ $now.toISO() }} \n- Dia da semana atual: {{ $now.setLocale('pt-BR').toFormat('cccc') }}`;

        const promptWithoutSuffix = update.newPrompt.replace(
          /\n\n### INFORMACOES ADICIONAIS[\s\S]*$/,
          ""
        );

        const finalPrompt = `=${promptWithoutSuffix}${dynamicSuffix}`;

        // Set prompt in the correct location based on current structure
        if (node.parameters?.options?.systemMessage !== undefined) {
          node.parameters.options.systemMessage = finalPrompt;
          modified = true;
        } else if (node.parameters?.systemMessage !== undefined) {
          node.parameters.systemMessage = finalPrompt;
          modified = true;
        } else {
          // Default: set in options.systemMessage
          if (!node.parameters) node.parameters = {};
          if (!node.parameters.options) node.parameters.options = {};
          node.parameters.options.systemMessage = finalPrompt;
          modified = true;
        }
      }

      if (!modified) {
        errors.push(`${wfId}: no matching agent nodes found`);
        continue;
      }

      // Sanitize nodes: use PATCH approach - use n8n's own GET response
      // but strip known problematic fields that the API rejects on PUT
      const BLOCKED_NODE_KEYS = new Set([
        "createdAt", "updatedAt", "extendsCredential",
        "pinData", "pinnedData",
      ]);

      const sanitizedNodes = workflow.nodes.map((node: any) => {
        const clean: any = {};
        for (const [key, value] of Object.entries(node)) {
          if (!BLOCKED_NODE_KEYS.has(key)) {
            clean[key] = value;
          }
        }
        return clean;
      });

      const updatePayload = {
        name: workflow.name,
        nodes: sanitizedNodes,
        connections: workflow.connections,
        settings: workflow.settings || {
          executionOrder: "v1",
          timezone: "America/Sao_Paulo",
        },
      };

      const putRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${wfId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatePayload),
      });

      if (!putRes.ok) {
        const errorText = await putRes.text();
        errors.push(`${wfId}: update failed (${putRes.status}) ${errorText}`);
        continue;
      }

      updated.push(wfId);
    } catch (e: any) {
      errors.push(`${wfId}: ${e.message}`);
    }
  }

  return { updated, errors };
}

async function updatePromptsPerWorkflow(
  perWorkflowUpdates: Record<string, { nodeName: string; newPrompt: string }[]>
): Promise<{ updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  for (const [wfId, updates] of Object.entries(perWorkflowUpdates)) {
    const result = await updateAgentPrompts([wfId], updates);
    updated.push(...result.updated);
    errors.push(...result.errors);
  }

  return { updated, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await authenticateUser(req);
    const { action, ...params } = await req.json();

    let result: any;

    switch (action) {
      case "list":
        result = await listWorkflows();
        break;
      case "update_prompts":
        result = await updateAgentPrompts(params.workflow_ids, params.updates);
        break;
      case "update_prompts_per_workflow":
        result = await updatePromptsPerWorkflow(params.per_workflow_updates);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
