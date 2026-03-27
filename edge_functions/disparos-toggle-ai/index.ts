import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function findMatchByPhone(rows: any[], phone_last8: string) {
  return rows?.find((row: any) => {
    for (const key of Object.keys(row)) {
      const val = String(row[key] || "").replace(/\D/g, "");
      if (val.length >= 8 && val.slice(-8) === phone_last8) {
        return true;
      }
    }
    return false;
  });
}

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

    const body = await req.json();
    const { action, instancia_id, phone_last8, field, new_value, contacts } = body;

    // ── BULK GET ──
    if (action === "bulk_get") {
      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return new Response(JSON.stringify({ results: {} }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: extConfig } = await supabase
        .from("disparos_supabase_config")
        .select("supabase_url, supabase_service_key")
        .eq("user_id", user.id)
        .single();

      if (!extConfig) {
        return new Response(JSON.stringify({ results: {} }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const extSupabase = createClient(extConfig.supabase_url, extConfig.supabase_service_key);

      // Group contacts by instancia_id
      const byInstancia: Record<string, string[]> = {};
      for (const c of contacts) {
        if (c.instancia_id && c.phone_last8) {
          if (!byInstancia[c.instancia_id]) byInstancia[c.instancia_id] = [];
          byInstancia[c.instancia_id].push(c.phone_last8);
        }
      }

      const instanciaIds = Object.keys(byInstancia);
      const { data: instancias } = await supabase
        .from("disparos_instancias")
        .select("id, tabela_supabase_externa")
        .in("id", instanciaIds)
        .eq("user_id", user.id);

      const results: Record<string, { bot_ativo: boolean; follow_ativo: boolean }> = {};

      for (const inst of (instancias || [])) {
        if (!inst.tabela_supabase_externa) continue;
        const phones = byInstancia[inst.id] || [];
        if (phones.length === 0) continue;

        const { data: rows } = await extSupabase
          .from(inst.tabela_supabase_externa)
          .select("*")
          .limit(1000);

        for (const ph of phones) {
          const match = findMatchByPhone(rows || [], ph);
          if (match) {
            results[ph] = {
              bot_ativo: match.BOT_ATIVO === true || match.BOT_ATIVO === "true",
              follow_ativo: match.follow_ativo === true || match.follow_ativo === "true",
            };
          }
        }
      }

      return new Response(JSON.stringify({ results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SINGLE ACTIONS (get / toggle) ──
    if (!instancia_id || !phone_last8) {
      return new Response(JSON.stringify({ error: "instancia_id e phone_last8 são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const extSupabase = createClient(extConfig.supabase_url, extConfig.supabase_service_key);
    const tableName = instancia.tabela_supabase_externa;

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

    const match = findMatchByPhone(rows || [], phone_last8);

    if (action === "get") {
      if (!match) {
        return new Response(JSON.stringify({ found: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        found: true,
        bot_ativo: match.BOT_ATIVO === true || match.BOT_ATIVO === "true",
        follow_ativo: match.follow_ativo === true || match.follow_ativo === "true",
        row_id: match.id,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "toggle") {
      if (!match) {
        return new Response(JSON.stringify({ error: "Contato não encontrado na tabela externa" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const columnName = field || "BOT_ATIVO";
      if (columnName !== "BOT_ATIVO" && columnName !== "follow_ativo") {
        return new Response(JSON.stringify({ error: "Campo inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, boolean> = {};
      updateData[columnName] = new_value;

      const { error: updateError } = await extSupabase
        .from(tableName)
        .update(updateData)
        .eq("id", match.id);

      if (updateError) {
        console.error("Error updating external table:", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar tabela externa", details: updateError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, [columnName]: new_value }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'get', 'bulk_get' ou 'toggle'" }), {
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
