import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55") && cleaned.length <= 11) cleaned = "55" + cleaned;
  return cleaned;
}

function buildPhoneCandidates(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, "");
  const candidates = new Set<string>();
  const base = normalizePhone(cleaned);
  candidates.add(base);
  if (base.startsWith("55") && base.length === 12) {
    candidates.add(base.slice(0, 4) + "9" + base.slice(4));
  }
  if (base.startsWith("55") && base.length === 13) {
    candidates.add(base.slice(0, 4) + base.slice(5));
  }
  return Array.from(candidates).filter((x) => x.length >= 12);
}

function processSpintax(text: string): string {
  const regex = /\{([^{}]+)\}/g;
  return text.replace(regex, (_, options) => {
    if (options.includes("|")) {
      const choices = options.split("|");
      return choices[Math.floor(Math.random() * choices.length)];
    }
    return `{${options}}`;
  });
}

function replaceVariables(
  message: string,
  vars: Record<string, string>
): string {
  let result = message;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "gi"), value || "");
  }
  return processSpintax(result);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const {
      evento, // "atribuida" | "aprovacao_interna" | "aprovacao_cliente" | "reprovada_cliente" | "ajustada" | "aprovada_concluida"
      tarefa_id,
      user_id,
      // Optional context overrides
      feedback,
      link_aprovacao,
    } = body;

    if (!evento || !tarefa_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "evento, tarefa_id, and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Task notification: evento=${evento}, tarefa_id=${tarefa_id}, user_id=${user_id}`);

    // 1. Get the task with its tipo_tarefa
    const { data: tarefa, error: tarefaError } = await supabase
      .from("tarefas")
      .select("*, tipos_tarefas(*)")
      .eq("id", tarefa_id)
      .single();

    if (tarefaError || !tarefa) {
      console.error("Task not found:", tarefaError);
      return new Response(
        JSON.stringify({ success: false, error: "Tarefa não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if this tipo has avisos configured for this event
    const tipoTarefa = tarefa.tipos_tarefas;
    if (!tipoTarefa) {
      console.log("No tipo_tarefa linked to this task");
      return new Response(
        JSON.stringify({ success: true, message: "Tarefa sem tipo definido", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const avisos = tipoTarefa.avisos || {};
    const avisoConfig = avisos[evento];

    if (!avisoConfig || !avisoConfig.ativo) {
      console.log(`Aviso "${evento}" not active for tipo "${tipoTarefa.nome}"`);
      return new Response(
        JSON.stringify({ success: true, message: `Aviso "${evento}" não configurado`, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const destinos = avisoConfig.destinos || {};
    if (!destinos.grupo_cliente && !destinos.grupo_membro && !destinos.pessoal_membro && !destinos.pessoal_gestor) {
      console.log(`Aviso "${evento}" has no destinations selected`);
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum destino selecionado para este aviso", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get the notification instance
    const { data: notifConfig } = await supabase
      .from("tarefas_notificacao_config")
      .select("instancia_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!notifConfig?.instancia_id) {
      console.log("No notification instance configured");
      return new Response(
        JSON.stringify({ success: false, error: "Instância de avisos não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: instancia } = await supabase
      .from("disparos_instancias")
      .select("*")
      .eq("id", notifConfig.instancia_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!instancia) {
      console.log("Notification instance not found or inactive");
      return new Response(
        JSON.stringify({ success: false, error: "Instância de avisos inativa" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = String(instancia.base_url || "").replace(/\/+$/, "");
    const apiKey = String(instancia.api_key || "");

    // 4. Get client info
    let clienteNome = "";
    let clienteEmpresa = "";
    let clienteGrupo = "";
    if (tarefa.cliente_id) {
      const { data: cliente } = await supabase
        .from("tarefas_clientes")
        .select("nome, empresa, grupo_whatsapp")
        .eq("id", tarefa.cliente_id)
        .maybeSingle();
      if (cliente) {
        clienteNome = cliente.nome || "";
        clienteEmpresa = cliente.empresa || "";
        clienteGrupo = cliente.grupo_whatsapp || "";
      }
    }

    // 5. Get gestor info
    let gestorNome = "";
    let gestorPessoal = "";
    let gestorGrupo = "";
    if (tarefa.cliente_id) {
      const { data: clienteData } = await supabase
        .from("tarefas_clientes")
        .select("gestor_id")
        .eq("id", tarefa.cliente_id)
        .maybeSingle();

      if (clienteData?.gestor_id) {
        const { data: gestor } = await supabase
          .from("tarefas_membros")
          .select("nome, whatsapp_aviso_pessoal, whatsapp_aviso_grupo")
          .eq("id", clienteData.gestor_id)
          .maybeSingle();
        if (gestor) {
          gestorNome = gestor.nome || "";
          gestorPessoal = gestor.whatsapp_aviso_pessoal || "";
          gestorGrupo = gestor.whatsapp_aviso_grupo || "";
        }
      }
    }

    // 6. Get membro (responsável) info
    let membroNome = tarefa.responsavel_nome || "";
    let membroPessoal = "";
    let membroGrupo = "";
    if (tarefa.responsavel_nome) {
      const primeiroNome = tarefa.responsavel_nome.split(",")[0].trim();
      const { data: membro } = await supabase
        .from("tarefas_membros")
        .select("nome, whatsapp_aviso_pessoal, whatsapp_aviso_grupo")
        .eq("user_id", user_id)
        .ilike("nome", primeiroNome)
        .maybeSingle();
      if (membro) {
        membroNome = membro.nome || primeiroNome;
        membroPessoal = membro.whatsapp_aviso_pessoal || "";
        membroGrupo = membro.whatsapp_aviso_grupo || "";
      }
    }

    // 7. Build variables
    const today = new Date();
    const dataFormatada = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

    const vars: Record<string, string> = {
      tarefa: tarefa.titulo || "",
      cliente: clienteNome,
      empresa: clienteEmpresa,
      membro: membroNome,
      gestor: gestorNome,
      tipo: tipoTarefa.nome || "",
      link_aprovacao: link_aprovacao || "",
      feedback: feedback || tarefa.aprovacao_interna_feedback || "",
      data: dataFormatada,
    };

    const mensagem = replaceVariables(avisoConfig.mensagem || "", vars);
    console.log(`Message: ${mensagem.substring(0, 100)}...`);

    // 8. Build destination list
    const destinations: { number: string; label: string }[] = [];

    if (destinos.grupo_cliente && clienteGrupo) {
      destinations.push({ number: clienteGrupo, label: "grupo_cliente" });
    }
    if (destinos.grupo_membro && membroGrupo) {
      destinations.push({ number: membroGrupo, label: "grupo_membro" });
    }
    if (destinos.pessoal_membro && membroPessoal) {
      destinations.push({ number: membroPessoal, label: "pessoal_membro" });
    }
    if (destinos.pessoal_gestor && gestorPessoal) {
      destinations.push({ number: gestorPessoal, label: "pessoal_gestor" });
    }

    if (destinations.length === 0) {
      console.log("No valid destination numbers found");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum número de destino encontrado", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Send messages
    let sentCount = 0;
    const errors: string[] = [];

    for (const dest of destinations) {
      try {
        // For groups, send directly to the group ID
        // For personal, use phone candidates
        const isGroup = dest.label.startsWith("grupo");
        const targets = isGroup ? [dest.number] : buildPhoneCandidates(dest.number);

        let delivered = false;
        for (const target of targets) {
          const sendBody = isGroup
            ? { number: target, text: mensagem, isGroup: true }
            : { number: target, text: mensagem };

          const sendUrl = `${baseUrl}/send/text`;
          const sendResponse = await fetch(sendUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              token: apiKey,
            },
            body: JSON.stringify(sendBody),
          });

          const responseText = await sendResponse.text();
          if (sendResponse.ok) {
            console.log(`Sent to ${dest.label} (${target})`);
            sentCount++;
            delivered = true;
            break;
          } else {
            console.error(`Failed ${dest.label} (${target}): ${responseText}`);
          }
        }

        if (!delivered) {
          errors.push(`${dest.label}: falha ao enviar`);
        }

        // Small delay between sends
        if (destinations.indexOf(dest) < destinations.length - 1) {
          await sleep(1500);
        }
      } catch (err) {
        console.error(`Error sending to ${dest.label}:`, err);
        errors.push(`${dest.label}: ${err.message}`);
      }
    }

    console.log(`Task notification complete: ${sentCount}/${destinations.length} sent`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: destinations.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in task notification:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
