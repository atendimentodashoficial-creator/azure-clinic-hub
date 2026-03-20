import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, api_key, api_secret, environment, ...params } = body;

    const baseUrl = environment === "production"
      ? "https://api.contasimples.com"
      : "https://api-sandbox.contasimples.com";

    if (action === "authenticate") {
      // OAuth 2.0 Client Credentials
      const credentials = btoa(`${api_key}:${api_secret}`);
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
        return new Response(
          JSON.stringify({ error: "Falha na autenticação", details: tokenData }),
          { status: tokenRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "credit-card-statements") {
      const { token, startDate, endDate, pageSize, nextPageStartKey } = params;
      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestBody: Record<string, unknown> = {
        startDate,
        endDate,
        pageSize: pageSize || 50,
      };
      if (nextPageStartKey) {
        requestBody.nextPageStartKey = nextPageStartKey;
      }

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
        return new Response(
          JSON.stringify({ error: "Falha ao buscar transações", details: statementsData }),
          { status: statementsRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(statementsData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download-attachment") {
      const { token, attachmentId } = params;
      if (!token || !attachmentId) {
        return new Response(JSON.stringify({ error: "Token e attachmentId obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const attachRes = await fetch(`${baseUrl}/attachments/v1/content/${attachmentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!attachRes.ok) {
        return new Response(
          JSON.stringify({ error: "Falha ao baixar anexo" }),
          { status: attachRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const contentType = attachRes.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await attachRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return new Response(
        JSON.stringify({ content: base64, contentType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Conta Simples API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
