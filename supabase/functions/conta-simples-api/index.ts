import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const body = await req.json();
    const { action, api_key, api_secret, environment, ...params } = body;

    const baseUrl = environment === "production"
      ? "https://api.contasimples.com"
      : "https://api-sandbox.contasimples.com";

    if (action === "authenticate") {
      const credentials = btoa(`${api_key}:${api_secret}`);
      
      console.log(`[conta-simples] Authenticating with ${baseUrl}`);
      
      const tokenRes = await fetch(`${baseUrl}/oauth/v1/access-token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      const tokenData = await tokenRes.json();
      
      if (!tokenRes.ok) {
        console.error(`[conta-simples] Auth failed [${tokenRes.status}]:`, JSON.stringify(tokenData));
        return jsonResponse({ error: "Falha na autenticação", details: tokenData });
      }

      console.log("[conta-simples] Auth success, token expires in:", tokenData.expires_in);
      return jsonResponse(tokenData);
    }

    if (action === "credit-card-statements") {
      const { token, startDate, endDate, pageSize, nextPageStartKey } = params;
      if (!token) {
        return jsonResponse({ error: "Token obrigatório" });
      }

      const requestedPageSize = Number(pageSize);
      const normalizedPageSize = Number.isFinite(requestedPageSize)
        ? Math.trunc(requestedPageSize)
        : 50;
      const safePageSize = Math.min(100, Math.max(5, normalizedPageSize));

      const requestBody: Record<string, unknown> = {
        startDate,
        endDate,
        pageSize: safePageSize,
      };
      if (nextPageStartKey) {
        requestBody.nextPageStartKey = nextPageStartKey;
      }

      console.log(
        `[conta-simples] Fetching statements: ${startDate} to ${endDate} (pageSize=${safePageSize})`,
      );

      const statementsRes = await fetch(`${baseUrl}/statements/v1/credit-card`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const statementsData = await statementsRes.json();
      
      if (!statementsRes.ok) {
        console.error(`[conta-simples] Statements failed [${statementsRes.status}]:`, JSON.stringify(statementsData));
        return jsonResponse({ 
          error: `Falha ao buscar transações (${statementsRes.status})`, 
          details: statementsData 
        });
      }

      console.log("[conta-simples] Statements fetched successfully");
      return jsonResponse(statementsData);
    }

    if (action === "download-attachment") {
      const { token, attachmentId } = params;
      if (!token || !attachmentId) {
        return jsonResponse({ error: "Token e attachmentId obrigatórios" });
      }

      const attachRes = await fetch(`${baseUrl}/attachments/v1/content/${attachmentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!attachRes.ok) {
        const errText = await attachRes.text();
        console.error(`[conta-simples] Attachment failed [${attachRes.status}]:`, errText);
        return jsonResponse({ error: `Falha ao baixar anexo (${attachRes.status})` });
      }

      const contentType = attachRes.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await attachRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return jsonResponse({ content: base64, contentType });
    }

    return jsonResponse({ error: "Ação inválida" });
  } catch (error) {
    console.error("[conta-simples] Unexpected error:", error);
    return jsonResponse({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    });
  }
});
