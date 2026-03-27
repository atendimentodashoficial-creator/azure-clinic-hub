import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, user_id, instancia_id, api_key } = await req.json();

    // Validate API key
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!api_key || api_key !== cronSecret) {
      return new Response(JSON.stringify({ error: "API key inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phone || !user_id || !instancia_id) {
      return new Response(JSON.stringify({ error: "phone, user_id e instancia_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get last 8 digits
    const phoneLast8 = phone.replace(/\D/g, "").slice(-8);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get instance config
    const { data: instancia } = await supabase
      .from("disparos_instancias")
      .select("tabela_supabase_externa")
      .eq("id", instancia_id)
      .eq("user_id", user_id)
      .single();

    if (!instancia?.tabela_supabase_externa) {
      return new Response(JSON.stringify({ 
        pode_responder: true, 
        motivo: "Instância sem tabela externa configurada" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get external Supabase config
    const { data: extConfig } = await supabase
      .from("disparos_supabase_config")
      .select("supabase_url, supabase_service_key")
      .eq("user_id", user_id)
      .single();

    if (!extConfig) {
      return new Response(JSON.stringify({ 
        pode_responder: true, 
        motivo: "Sem config externa" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extSupabase = createClient(extConfig.supabase_url, extConfig.supabase_service_key);

    // Fetch rows and find match by phone
    const { data: rows } = await extSupabase
      .from(instancia.tabela_supabase_externa)
      .select("*")
      .limit(1000);

    const match = (rows || []).find((row: any) => {
      for (const key of Object.keys(row)) {
        const val = String(row[key] || "").replace(/\D/g, "");
        if (val.length >= 8 && val.slice(-8) === phoneLast8) {
          return true;
        }
      }
      return false;
    });

    if (!match) {
      return new Response(JSON.stringify({ 
        pode_responder: true, 
        motivo: "Contato não encontrado na tabela externa",
        bot_ativo: true,
        follow_ativo: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botAtivo = match.BOT_ATIVO === true || match.BOT_ATIVO === "true";
    const followAtivo = match.follow_ativo === true || match.follow_ativo === "true";

    return new Response(JSON.stringify({ 
      pode_responder: botAtivo,
      bot_ativo: botAtivo,
      follow_ativo: followAtivo,
      motivo: botAtivo ? "Bot ativo" : "Bot desativado pelo usuário",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message, pode_responder: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
