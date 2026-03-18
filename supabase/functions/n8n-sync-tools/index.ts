import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_BASE_URL = "https://n8n.srv1179055.hstgr.cloud";
const WORKFLOW_ID = "bNebgIhMT0VtlYK6";
const AGENT_NODE_NAME = "Agente Principal";

interface ToolField {
  key: string;
  value: string;
}

interface ToolConfig {
  id: string;
  name: string;
  fields: ToolField[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tools, system_prompt } = await req.json() as {
      tools: ToolConfig[];
      system_prompt: string;
    };

    const N8N_API_KEY = Deno.env.get("N8N_API_KEY");
    if (!N8N_API_KEY) {
      throw new Error("N8N_API_KEY not configured");
    }

    // 1. Get current workflow
    const getRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY },
    });

    if (!getRes.ok) {
      const errorText = await getRes.text();
      throw new Error(`Failed to get workflow [${getRes.status}]: ${errorText}`);
    }

    const workflow = await getRes.json();

    // 2. Remove existing httpRequestTool nodes (contato_*)\\
    const existingToolNodes = workflow.nodes.filter(
      (n: any) => n.type === "n8n-nodes-base.httpRequestTool" && n.name.startsWith("contato_")
    );
    const existingToolNames = new Set(existingToolNodes.map((n: any) => n.name));

    // Keep non-tool nodes
    const nonToolNodes = workflow.nodes.filter(
      (n: any) => !(n.type === "n8n-nodes-base.httpRequestTool" && n.name.startsWith("contato_"))
    );

    // 3. Build new tool nodes based on config
    // Use the first existing tool as a template for position/structure
    const templateNode = existingToolNodes[0];
    const baseX = templateNode?.position?.[0] ?? 3152;
    const baseY = templateNode?.position?.[1] ?? 704;

    const newToolNodes = tools.map((tool, index) => {
      // Build body parameters from fields
      const bodyParameters = tool.fields.map((f) => ({
        name: f.key,
        value: f.value,
      }));

      return {
        parameters: {
          method: "POST",
          url: "https://nokta.uazapi.com/send/contact",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: "token",
                value: "={{ $('Tratar Dados').item.json.token_instancia }}",
              },
            ],
          },
          sendBody: true,
          bodyParameters: { parameters: bodyParameters },
          options: {},
        },
        type: "n8n-nodes-base.httpRequestTool",
        typeVersion: 4.3,
        position: [baseX + index * 176, baseY],
        id: crypto.randomUUID(),
        name: tool.name,
      };
    });

    // 4. Update agent system prompt
    const agentNode = nonToolNodes.find((n: any) => n.name === AGENT_NODE_NAME);
    if (agentNode && system_prompt) {
      // Preserve dynamic n8n expressions at the end
      const dynamicSuffix = `

### INFORMACOES ADICIONAIS 
-  SEMPRE considere Data e hora atual: {{ $now.toISO() }} 
- Dia da semana atual: {{ $now.setLocale('pt-BR').toFormat('cccc') }}`;
      
      // Check if system_prompt already contains dynamic suffix
      const promptWithoutSuffix = system_prompt.replace(/\n\n### INFORMACOES ADICIONAIS[\s\S]*$/, "");
      agentNode.parameters.options.systemMessage = `=${promptWithoutSuffix}${dynamicSuffix}`;
    }

    // 5. Rebuild connections: link first tool to agent, chain others
    // Remove old tool connections
    const newConnections = { ...workflow.connections };

    // Remove old contato_ connections
    for (const toolName of existingToolNames) {
      delete newConnections[toolName];
    }

    // Link first new tool to agent via ai_tool
    if (newToolNodes.length > 0) {
      newConnections[newToolNodes[0].name] = {
        ai_tool: [
          [{ node: AGENT_NODE_NAME, type: "ai_tool", index: 0 }],
        ],
      };
    }

    // 6. Build final workflow
    workflow.nodes = [...nonToolNodes, ...newToolNodes];
    workflow.connections = newConnections;

    // 7. PUT updated workflow
    const putRes = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
      method: "PUT",
      headers: {
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workflow),
    });

    if (!putRes.ok) {
      const errorText = await putRes.text();
      throw new Error(`Failed to update workflow [${putRes.status}]: ${errorText}`);
    }

    const result = await putRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        tools_synced: newToolNodes.length,
        tool_names: newToolNodes.map((n: any) => n.name),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error syncing tools to n8n:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
