import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { code, redirectUri } = await req.json();

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ success: false, error: "Código ou redirect URI não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Google Calendar config to retrieve client_id and client_secret
    const { data: config, error: configError } = await supabase
      .from("google_calendar_config")
      .select("client_id, client_secret")
      .eq("user_id", user.id)
      .single();

    if (configError || !config) {
      console.error("Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Configuração do Google Calendar não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.client_id || !config.client_secret) {
      return new Response(
        JSON.stringify({ success: false, error: "Client ID ou Client Secret não configurados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
    const normalizedClientId = config.client_id.trim();
    const normalizedClientSecret = config.client_secret.trim();
    const basicAuth = btoa(`${normalizedClientId}:${normalizedClientSecret}`);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        client_id: normalizedClientId,
        client_secret: normalizedClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const rawTokenBody = await tokenResponse.text();
    let tokenData: any = {};

    try {
      tokenData = rawTokenBody ? JSON.parse(rawTokenBody) : {};
    } catch {
      tokenData = { raw: rawTokenBody };
    }

    if (!tokenResponse.ok) {
      console.error("Token exchange error:", tokenData);

      const googleError = typeof tokenData?.error === "string"
        ? tokenData.error
        : "token_exchange_failed";
      const googleDescription = typeof tokenData?.error_description === "string"
        ? tokenData.error_description
        : "Erro ao obter tokens";
      const hint = googleError === "invalid_client"
        ? "Client ID/Client Secret inválidos ou incompatíveis. Gere um novo Client Secret (valor) no Google Cloud e salve novamente."
        : null;

      return new Response(
        JSON.stringify({
          success: false,
          error: googleDescription,
          google_error: googleError,
          hint,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Token exchange successful");

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update config with tokens
    const { error: updateError } = await supabase
      .from("google_calendar_config")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tokens saved successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Google Calendar conectado com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
