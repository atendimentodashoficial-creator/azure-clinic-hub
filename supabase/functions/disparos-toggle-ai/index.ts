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

    const { action, instancia_id, phone_last8 } = await req.json();

    if (!instancia_id || !phone_last8) {
      return new Response(JSON.stringify({ error: "instancia_id e phone_last8 são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance config (table name)
    const { data: instancia, error: instError } = await supabase
      .from("disparos_instancias")
      .select("tabela_supabase_externa")
      .eq("id", instancia_id)
      .eq("user_id", user.id)
      .single();

    if (instError || !instancia?.tabela_supabase_externa) {
      return new Response(JSON.stringify({ error: "Instância não encontrada ou tabela externa não configurada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get external Supabase config
    const { data: extConfig, error: configError } = await supabase
      .from("disparos_supabase_config")
      .select("supabase_url, supabase_service_key")
      .eq("user_id", user.id)
      .single();

    if (configError || !extConfig) {
      return new Response(JSON.stringify({ error: "Configuração do Supabase externo não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to external Supabase
    const extSupabase = createClient(extConfig.supabase_url, extConfig.supabase_service_key);
    const tableName = instancia.tabela_supabase_externa;

    if (action === "get") {
      // Find the contact by last 8 digits of phone
      const { data: rows, error: fetchError } = await extSupabase
        .from(tableName)
        .select("*")
        .limit(1000);

      if (fetchError) {
        console.error("Error fetching from external table:", fetchError);
        return new Response(JSON.stringify({ error: "Erro ao consultar tabela externa", details: fetchError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find by last 8 digits matching any phone-like column
      const match = rows?.find((row: any) => {
        // Try common phone column names
        for (const key of Object.keys(row)) {
          const val = String(row[key] || "").replace(/\D/g, "");
          if (val.length >= 8 && val.slice(-8) === phone_last8) {
            return true;
          }
        }
        return false;
      });

      if (!match) {
        return new Response(JSON.stringify({ found: false, bot_ativo: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        found: true, 
        bot_ativo: match.BOT_ATIVO === true || match.BOT_ATIVO === "true",
        row_id: match.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "toggle") {
      const { new_value } = await req.json().catch(() => ({}));
      
      // Find the row first
      const { data: rows } = await extSupabase
        .from(tableName)
        .select("*")
        .limit(1000);

      const match = rows?.find((row: any) => {
        for (const key of Object.keys(row)) {
          const val = String(row[key] || "").replace(/\D/g, "");
          if (val.length >= 8 && val.slice(-8) === phone_last8) {
            return true;
          }
        }
        return false;
      });

      if (!match) {
        return new Response(JSON.stringify({ error: "Contato não encontrado na tabela externa" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentValue = match.BOT_ATIVO === true || match.BOT_ATIVO === "true";
      const newValue = new_value !== undefined ? new_value : !currentValue;

      const { error: updateError } = await extSupabase
        .from(tableName)
        .update({ BOT_ATIVO: newValue })
        .eq("id", match.id);

      if (updateError) {
        console.error("Error updating external table:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar tabela externa", details: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, bot_ativo: newValue }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'get' ou 'toggle'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
