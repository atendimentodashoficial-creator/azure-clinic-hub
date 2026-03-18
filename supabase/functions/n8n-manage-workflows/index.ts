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

  // Fetch all workflows
  const res = await fetch(`${N8N_BASE_URL}/api/v1/workflows?limit=100`, { headers });
  if (!res.ok) throw new Error(`Failed to list workflows: ${res.status}`);
  const data = await res.json();

  const workflows: WorkflowSummary[] = [];

  for (const wf of data.data || []) {
    // Get full workflow details to check MCP setting and extract agents
    const fullRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${wf.id}`, { headers });
    if (!fullRes.ok) continue;
    const fullWf = await fullRes.json();

    // Only include workflows with MCP enabled
    if (!fullWf.settings?.availableInMCP) continue;

    const agents = extractAgents(fullWf);
    if (agents.length === 0) continue;

    workflows.push({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      agents,
    });
  }

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

      const updatePayload = {
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: {
          executionOrder: workflow.settings?.executionOrder ?? "v1",
          timezone: workflow.settings?.timezone ?? "America/Sao_Paulo",
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
