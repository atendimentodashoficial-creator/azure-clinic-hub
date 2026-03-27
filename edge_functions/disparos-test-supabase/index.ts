import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabase_url, supabase_service_key } = await req.json();

    if (!supabase_url || !supabase_service_key) {
      return new Response(JSON.stringify({ success: false, error: "URL e Service Key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test connection by making a direct REST API call to the external Supabase
    // Using fetch instead of the client to have full control over error handling
    const testUrl = `${supabase_url.replace(/\/$/, "")}/rest/v1/`;
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "apikey": supabase_service_key,
        "Authorization": `Bearer ${supabase_service_key}`,
      },
    });

    // Any 2xx or 4xx from PostgREST means the connection and auth work
    // Only 5xx or network errors mean something is wrong
    if (response.ok || response.status < 500) {
      // Consume the body
      await response.text();
      console.log("External Supabase connection test succeeded, status:", response.status);
      return new Response(JSON.stringify({ success: true, message: "Conexão bem sucedida!" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await response.text();
    console.error("External Supabase test failed, status:", response.status, "body:", body);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Falha na conexão (HTTP ${response.status}). Verifique a URL e a chave.`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Connection test error:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Erro de conexão: " + error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
