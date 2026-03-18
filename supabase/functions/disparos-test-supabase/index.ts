import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabase_url, supabase_service_key } = await req.json();

    if (!supabase_url || !supabase_service_key) {
      return new Response(JSON.stringify({ error: "URL e Service Key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test connection to external Supabase
    const extSupabase = createClient(supabase_url, supabase_service_key);

    // Try a simple RPC or query to verify the connection works
    // We'll query the pg_tables to check connectivity
    const { error: testError } = await extSupabase
      .from("_test_connection_dummy_")
      .select("*")
      .limit(1);

    // We expect a "relation does not exist" error (42P01) which means the connection works
    // but the table doesn't exist. Any auth/network error means bad credentials.
    if (testError) {
      const msg = testError.message || "";
      const code = (testError as any).code || "";
      
      // These errors mean the connection itself worked (auth OK, network OK)
      if (code === "42P01" || msg.includes("does not exist") || msg.includes("relation")) {
        return new Response(JSON.stringify({ success: true, message: "Conexão bem sucedida!" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Real connection/auth errors
      console.error("External Supabase test failed:", testError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Falha na conexão: " + msg 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No error at all means connection works (unlikely for a dummy table, but OK)
    return new Response(JSON.stringify({ success: true, message: "Conexão bem sucedida!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ success: false, error: "Erro de conexão: " + error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
