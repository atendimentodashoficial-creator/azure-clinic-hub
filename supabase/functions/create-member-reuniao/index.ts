import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAuth.auth.getUser();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { memberId, titulo, dataHora, duracao = 60, clienteNome, clienteTelefone } = await req.json();

    if (!memberId || !titulo || !dataHora) {
      return new Response(JSON.stringify({ success: false, error: "Dados obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("tarefas_membros")
      .select("id, user_id, nome, email, auth_user_id")
      .eq("id", memberId)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (!member) {
      return new Response(JSON.stringify({ success: false, error: "Membro não encontrado para este administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = member.auth_user_id || caller.id;

    let profissionalId: string | null = null;
    if (member.email) {
      const { data: profissional } = await supabaseAdmin
        .from("profissionais")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("email", member.email)
        .maybeSingle();
      profissionalId = profissional?.id || null;
    }

    let clienteId: string | null = null;
    if (clienteTelefone) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("user_id", targetUserId)
        .is("deleted_at", null)
        .eq("telefone", clienteTelefone)
        .maybeSingle();
      clienteId = lead?.id || null;
    }

    const participantes = [clienteNome || "Cliente", member.nome].filter(Boolean);

    const { data: reuniao, error: reuniaoError } = await supabaseAdmin
      .from("reunioes")
      .insert({
        user_id: targetUserId,
        titulo,
        data_reuniao: dataHora,
        duracao_minutos: duracao,
        cliente_telefone: clienteTelefone || null,
        cliente_id: clienteId,
        profissional_id: profissionalId,
        status: "agendado",
        participantes,
      })
      .select("id")
      .single();

    if (reuniaoError || !reuniao) {
      throw reuniaoError || new Error("Falha ao criar reunião");
    }

    let notificationSent = false;
    if (clienteTelefone) {
      try {
        const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-aviso-reuniao-imediato`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            reuniaoId: reuniao.id,
            userId: targetUserId,
            clienteTelefone,
            clienteNome,
            tipo: "imediato",
          }),
        });

        notificationSent = notifyResponse.ok;
      } catch (notifyError) {
        console.error("Erro ao disparar aviso imediato:", notifyError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, reuniaoId: reuniao.id, targetUserId, notificationSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in create-member-reuniao:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
