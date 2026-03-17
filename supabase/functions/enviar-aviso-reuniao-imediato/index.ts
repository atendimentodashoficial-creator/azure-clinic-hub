import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InstanciaConfig = {
  id: string;
  user_id: string;
  base_url: string;
  api_key: string;
  nome?: string | null;
  instance_name?: string | null;
  is_active?: boolean | null;
};

// Normalize phone number to WhatsApp format
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55") && cleaned.length <= 11) cleaned = "55" + cleaned;
  return cleaned;
}

// Generate candidates with/without 9th digit to maximize deliverability
function buildPhoneCandidates(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, "");
  const candidates = new Set<string>();

  const base = normalizePhone(cleaned);
  candidates.add(base);

  // 55 + DDD + 8 digits -> try adding 9 after DDD
  if (base.startsWith("55") && base.length === 12) {
    candidates.add(base.slice(0, 4) + "9" + base.slice(4));
  }

  // 55 + DDD + 9 digits -> try removing 9 after DDD
  if (base.startsWith("55") && base.length === 13) {
    candidates.add(base.slice(0, 4) + base.slice(5));
  }

  // Local 10 digits (DDD + 8)
  if (!cleaned.startsWith("55") && cleaned.length === 10) {
    const with9 = cleaned.slice(0, 2) + "9" + cleaned.slice(2);
    candidates.add("55" + cleaned);
    candidates.add("55" + with9);
  }

  // Local 11 digits (DDD + 9)
  if (!cleaned.startsWith("55") && cleaned.length === 11) {
    candidates.add("55" + cleaned);
  }

  return Array.from(candidates).filter((x) => x.length >= 12);
}

async function checkInstanceConnected(baseUrl: string, apiKey: string): Promise<{ ok: boolean; status: string }> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const statusResponse = await fetch(`${normalizedBaseUrl}/instance/status`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "token": apiKey,
    },
  });

  if (!statusResponse.ok) {
    await statusResponse.text().catch(() => null);
    return { ok: false, status: `unknown (${statusResponse.status})` };
  }

  const statusData = await statusResponse.json().catch(() => null);
  if (!statusData) return { ok: false, status: "unknown" };

  const nestedStatus = statusData?.status;
  const instanceStatus = statusData?.instance?.status;
  const loggedIn = nestedStatus?.loggedIn === true || statusData?.loggedIn === true;
  const jid = nestedStatus?.jid ?? statusData?.jid;
  const connected = nestedStatus?.connected === true || statusData?.connected === true;

  const isConnecting = instanceStatus === "connecting" || instanceStatus === "starting";
  const isDisconnected = instanceStatus === "disconnected" ||
    instanceStatus === "close" ||
    instanceStatus === "DISCONNECTED" ||
    nestedStatus?.connected === false ||
    statusData?.connected === false;

  const hasValidJid = jid != null && String(jid).length > 0;
  const isReallyConnected = loggedIn === true &&
    hasValidJid &&
    !isConnecting &&
    !isDisconnected &&
    (connected === true || connected === undefined);

  return {
    ok: isReallyConnected,
    status: isReallyConnected ? "connected" : (isConnecting ? "connecting" : (isDisconnected ? "disconnected" : "waiting")),
  };
}

// Format date for message (only day/month) - using native timezone support
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Format time for message - using native timezone support
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Process spintax in message
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

// Replace variables in message
function replaceVariables(
  message: string,
  reuniao: { titulo: string; data_reuniao: string; meet_link?: string | null; participantes?: string[] | null },
  clienteNome?: string
): string {
  let result = message;
  
  // Get first participant name or use provided clienteNome
  const nome = clienteNome || (reuniao.participantes && reuniao.participantes[0]) || "Cliente";
  const primeiroNome = nome.split(" ")[0];
  
  result = result.replace(/\{nome\}/gi, nome);
  result = result.replace(/\{primeiro_nome\}/gi, primeiroNome);
  result = result.replace(/\{titulo\}/gi, reuniao.titulo);
  result = result.replace(/\{data\}/gi, formatDate(reuniao.data_reuniao));
  result = result.replace(/\{horario\}/gi, formatTime(reuniao.data_reuniao));
  result = result.replace(/\{link_call\}/gi, reuniao.meet_link || `https://meet.jit.si/reuniao-${reuniao.id}`);
  
  return processSpintax(result);
}

// Build Google Calendar "Add to Calendar" URL
function buildGoogleCalendarUrl(reuniao: { titulo: string; data_reuniao: string; meet_link?: string | null; duracao_minutos?: number }): string {
  const start = new Date(reuniao.data_reuniao);
  const end = new Date(start.getTime() + ((reuniao.duracao_minutos || 60) * 60 * 1000));
  
  const formatGCalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: reuniao.titulo,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
    details: reuniao.meet_link ? `Link da reunião: ${reuniao.meet_link}` : "Reunião agendada via CRM",
    ctz: "America/Sao_Paulo",
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    const { reuniaoId, userId: userIdFromBody, clienteTelefone, clienteNome, instanciaId, instanciaNome, tipo = "imediato" } = body;

    // Auth: allow either a real user JWT (from the app) OR an internal call using the service role key.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const isInternalServiceCall = token === supabaseKey;

    let resolvedUserId: string | null = null;
    if (isInternalServiceCall) {
      resolvedUserId = userIdFromBody || null;
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Não autenticado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedUserId = user.id;
    }

    const isReagendamento = tipo === "reagendamento";
    console.log(`Starting ${isReagendamento ? 'rescheduling' : 'immediate'} notification for reuniao ${reuniaoId}, user ${resolvedUserId}`);

    if (!reuniaoId || !resolvedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "reuniaoId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the reuniao
    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes")
      .select("*")
      .eq("id", reuniaoId)
      .single();

    if (reuniaoError || !reuniao) {
      console.error("Reuniao not found:", reuniaoError);
      return new Response(
        JSON.stringify({ success: false, error: "Reunião não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get phone from parameter or reuniao
    const telefone = clienteTelefone || reuniao.cliente_telefone;
    
    if (!telefone) {
      console.log("No phone number available for notification");
      return new Response(
        JSON.stringify({ success: false, error: "Telefone do cliente não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active notifications for this user based on type
    let avisosQuery = supabase
      .from("avisos_reuniao")
      .select("*")
      .eq("user_id", resolvedUserId)
      .eq("ativo", true);

    if (isReagendamento) {
      // For rescheduling, get avisos with tipo_gatilho = 'reagendamento'
      avisosQuery = avisosQuery.eq("tipo_gatilho", "reagendamento");
    } else {
      // For immediate, get avisos with envio_imediato = true
      avisosQuery = avisosQuery.eq("envio_imediato", true);
    }

    const { data: avisos, error: avisosError } = await avisosQuery;

    if (avisosError) {
      console.error("Error fetching avisos:", avisosError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar avisos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!avisos || avisos.length === 0) {
      console.log(`No ${isReagendamento ? 'rescheduling' : 'immediate'} notifications configured`);
      return new Response(
        JSON.stringify({ success: true, message: `Nenhum aviso ${isReagendamento ? 'de reagendamento' : 'imediato'} configurado`, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter avisos by tipo_reuniao_id if specified
    const filteredAvisos = avisos.filter((aviso: any) => {
      if (!aviso.tipo_reuniao_id) return true; // no filter = matches all
      return aviso.tipo_reuniao_id === reuniao.tipo_reuniao_id;
    });

    if (filteredAvisos.length === 0) {
      console.log(`No matching notifications for reuniao type ${reuniao.tipo_reuniao_id}`);
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum aviso configurado para este tipo de reunião", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always use the MAIN WhatsApp instance (uazapi_config)
    let instancia: InstanciaConfig | null = null;
    
    const { data: mainConfig } = await supabase
      .from("uazapi_config")
      .select("id, user_id, base_url, api_key, instance_name, is_active")
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .maybeSingle();
    
    if (mainConfig) {
      instancia = {
        id: mainConfig.id,
        user_id: mainConfig.user_id,
        base_url: mainConfig.base_url,
        api_key: mainConfig.api_key,
        nome: mainConfig.instance_name || "WhatsApp Principal",
        instance_name: mainConfig.instance_name,
        is_active: mainConfig.is_active,
      };
      console.log(`Using MAIN WhatsApp instance: ${instancia.nome}`);
    }

    if (!instancia) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma instância WhatsApp ativa configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Final instance selected: ${instancia.nome} (${instancia.id})`)

    const baseUrl = String(instancia.base_url || "").replace(/\/+$/, "");
    const apiKey = String(instancia.api_key || "");

    // Ensure connectivity before sending
    const status = await checkInstanceConnected(baseUrl, apiKey);
    if (!status.ok) {
      const msg = "WhatsApp disconnected";

      await supabase.from("avisos_reuniao_log").insert({
        user_id: resolvedUserId,
        aviso_id: null,
        aviso_nome: "(envio_imediato)",
        reuniao_id: reuniaoId,
        cliente_nome: clienteNome || reuniao.participantes?.[0] || "Cliente",
        cliente_telefone: telefone,
        dias_antes: 0,
        mensagem_enviada: "",
        status: "erro",
        erro: msg,
        instancia_id: instancia.id,
        instancia_nome: instancia.nome,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Instância WhatsApp desconectada. Reconecte em Conexões → Disparos (QR Code).",
          sent: 0,
          total: filteredAvisos.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneCandidates = buildPhoneCandidates(telefone);
    let sentCount = 0;

    // Fetch all active instances for this user (needed to resolve per-aviso instancia_id)
    const { data: allInstancias } = await supabase
      .from("disparos_instancias")
      .select("id, nome, base_url, api_key")
      .eq("user_id", resolvedUserId)
      .eq("is_active", true);

    for (const aviso of filteredAvisos) {
      try {
        // Resolve instance: use aviso's fixed instancia_id if set, otherwise use the one from chat history
        let avisoBaseUrl = baseUrl;
        let avisoApiKey = apiKey;
        let avisoInstanciaId = instancia.id;
        let avisoInstanciaNome = instancia.nome;

        const avisoFixedInstanciaId: string | null = (aviso as any).instancia_id ?? null;
        if (avisoFixedInstanciaId && allInstancias) {
          const forced = allInstancias.find((i) => i.id === avisoFixedInstanciaId);
          if (forced) {
            console.log(`Aviso "${aviso.nome}" using forced instancia "${forced.nome}"`);
            avisoBaseUrl = String(forced.base_url || "").replace(/\/+$/, "");
            avisoApiKey = String(forced.api_key || "");
            avisoInstanciaId = forced.id;
            avisoInstanciaNome = forced.nome;
          }
        }

        // Calculate random delay within interval
        const delayMs = Math.floor(
          Math.random() * (aviso.intervalo_max - aviso.intervalo_min) + aviso.intervalo_min
        ) * 1000;

        console.log(`Waiting ${delayMs}ms before sending "${aviso.nome}"`);
        await sleep(delayMs);

        // Replace variables in message
        const mensagem = replaceVariables(aviso.mensagem, reuniao, clienteNome);

        // Helper to send audio
        const sendAudio = async (targetNumber: string) => {
          const audioUrl = (aviso as any).audio_url;
          if (!audioUrl) return;
          try {
            console.log(`Sending audio for aviso "${aviso.nome}" to ${targetNumber}`);
            const audioResponse = await fetch(`${avisoBaseUrl}/send/media`, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                token: avisoApiKey,
              },
              body: JSON.stringify({
                number: targetNumber,
                type: "ptt",
                file: audioUrl,
              }),
            });
            const audioText = await audioResponse.text();
            if (!audioResponse.ok) {
              console.error(`Error sending audio for aviso "${aviso.nome}":`, audioText);
            } else {
              console.log(`Audio sent successfully for aviso "${aviso.nome}"`);
            }
          } catch (audioErr) {
            console.error(`Exception sending audio for aviso "${aviso.nome}":`, audioErr);
          }
        };

        const audioPosicao = (aviso as any).audio_posicao || "depois";

        // Determine if calendar button should be sent
        const linkCalendarioAtivo = (aviso as any).link_calendario_ativo === true;
        const linkCalendarioTexto = (aviso as any).link_calendario_texto || "📅 Adicionar ao meu calendário";
        const calendarUrl = linkCalendarioAtivo ? buildGoogleCalendarUrl(reuniao) : null;

        // Remove {link_calendario} from message text (it's handled by button)
        let finalMensagem = mensagem.replace(/\{link_calendario\}/gi, "").trim();

        // Choose send endpoint based on whether we need buttons
        const sendUrl = calendarUrl ? `${avisoBaseUrl}/send/menu` : `${avisoBaseUrl}/send/text`;

        let deliveredTo: string | null = null;
        let lastError: string | null = null;
        let sendResult: any = null;

        for (const candidate of phoneCandidates) {
          // Send audio BEFORE text if configured
          if ((aviso as any).audio_url && audioPosicao === "antes") {
            await sendAudio(candidate);
            await sleep(2000);
          }

          const sendBody = calendarUrl
            ? {
                number: candidate,
                type: "button",
                text: finalMensagem,
                choices: [`${linkCalendarioTexto}|${calendarUrl}`],
              }
            : {
                number: candidate,
                text: finalMensagem,
              };

          const sendResponse = await fetch(sendUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              token: avisoApiKey,
            },
            body: JSON.stringify(sendBody),
          });

          const responseText = await sendResponse.text();
          let sendResult: any = null;
          try {
            sendResult = responseText ? JSON.parse(responseText) : null;
          } catch {
            sendResult = { raw: responseText };
          }

          if (sendResponse.ok) {
            deliveredTo = candidate;

            // Send audio AFTER text if configured
            if ((aviso as any).audio_url && audioPosicao !== "antes") {
              await sleep(2000); // small delay between text and audio
              await sendAudio(candidate);
            }

            break;
          }

          lastError =
            sendResult?.message ||
            sendResult?.error ||
            (typeof sendResult?.raw === "string" && sendResult.raw) ||
            responseText ||
            `Erro ao enviar mensagem (${sendResponse.status})`;

          console.error(`Error sending message for aviso "${aviso.nome}" to ${candidate}:`, {
            status: sendResponse.status,
            body: sendResult,
          });
        }

        if (!deliveredTo) {
          await supabase.from("avisos_reuniao_log").insert({
            user_id: resolvedUserId,
            aviso_id: aviso.id,
            aviso_nome: aviso.nome,
            reuniao_id: reuniaoId,
            cliente_nome: clienteNome || reuniao.participantes?.[0] || "Cliente",
            cliente_telefone: telefone,
            dias_antes: 0,
            mensagem_enviada: mensagem,
            status: "erro",
            erro: lastError || "Erro ao enviar mensagem",
            instancia_id: avisoInstanciaId,
            instancia_nome: avisoInstanciaNome,
          });
          continue;
        }

        console.log(`Successfully sent ${isReagendamento ? 'rescheduling' : 'immediate'} notification "${aviso.nome}" to ${deliveredTo}`);
        sentCount++;

        // Save the sent message to whatsapp_messages so it appears in the app
        try {
          const waChatId = `${deliveredTo}@s.whatsapp.net`;
          const last8 = deliveredTo.slice(-8);
          const messageId = sendResult?.key?.id || sendResult?.id || `aviso-${Date.now()}`;
          const contactName = clienteNome || reuniao.participantes?.[0] || "Cliente";

          // Find or create the WhatsApp chat for this number
          let { data: existingChat } = await supabase
            .from("whatsapp_chats")
            .select("id")
            .eq("user_id", resolvedUserId)
            .is("deleted_at", null)
            .like("normalized_number", `%${last8}`)
            .maybeSingle();

          if (!existingChat) {
            // Check for tombstone (deleted chat) - respect user's deletion
            const { data: tombstone } = await supabase
              .from("whatsapp_chat_deletions")
              .select("id")
              .eq("user_id", resolvedUserId)
              .eq("phone_last8", last8)
              .maybeSingle();

            if (!tombstone) {
              // Create the chat so the notification appears in the WhatsApp tab
              console.log(`[Aviso] Creating WhatsApp chat for ${deliveredTo}`);
              const { data: newChat, error: newChatErr } = await supabase
                .from("whatsapp_chats")
                .insert({
                  user_id: resolvedUserId,
                  chat_id: waChatId,
                  contact_name: contactName,
                  contact_number: deliveredTo,
                  normalized_number: deliveredTo,
                  last_message: finalMensagem,
                  last_message_time: new Date().toISOString(),
                })
                .select("id")
                .single();

              if (newChatErr) {
                console.error("[Aviso] Error creating WhatsApp chat:", newChatErr);
              } else {
                existingChat = newChat;
                console.log(`[Aviso] Created WhatsApp chat ${newChat.id} for ${deliveredTo}`);
              }
            } else {
              console.log(`[Aviso] Tombstone found for ${last8}, skipping chat creation`);
            }
          }

          if (existingChat) {
            // Save message to whatsapp_messages
            await supabase.from("whatsapp_messages").insert({
              chat_id: existingChat.id,
              message_id: messageId,
              content: finalMensagem,
              sender_type: "agent",
              media_type: "text",
              status: "sent",
              timestamp: new Date().toISOString(),
            });

            // Update chat's last message
            await supabase
              .from("whatsapp_chats")
              .update({
                last_message: finalMensagem,
                last_message_time: new Date().toISOString(),
              })
              .eq("id", existingChat.id);

            console.log(`[Aviso] Saved sent message to whatsapp_messages for chat ${existingChat.id}`);
          }
        } catch (saveErr) {
          console.error("[Aviso] Error saving message to whatsapp_messages:", saveErr);
        }

        // Auto-move WhatsApp kanban card on meeting notification
        try {
          const last8 = telefone.replace(/\D/g, '').slice(-8);
          if (last8.length === 8) {
            const { data: waConfig } = await supabase
              .from('whatsapp_kanban_config')
              .select('auto_move_reuniao_column_id')
              .eq('user_id', resolvedUserId)
              .maybeSingle();

            const targetCol = (waConfig as any)?.auto_move_reuniao_column_id;
            if (targetCol) {
              const { data: waChats } = await supabase
                .from('whatsapp_chats')
                .select('id')
                .eq('user_id', resolvedUserId)
                .is('deleted_at', null)
                .like('normalized_number', `%${last8}`);

              for (const wc of (waChats || [])) {
                const { data: existing } = await supabase
                  .from('whatsapp_chat_kanban')
                  .select('id')
                  .eq('chat_id', wc.id)
                  .maybeSingle();

                if (existing) {
                  await supabase.from('whatsapp_chat_kanban')
                    .update({ column_id: targetCol, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                } else {
                  await supabase.from('whatsapp_chat_kanban')
                    .insert({ user_id: resolvedUserId, chat_id: wc.id, column_id: targetCol });
                }
              }
              console.log(`[WA-AutoMove] Moved WhatsApp card to reunião column for phone ${last8}`);
            }
          }
        } catch (autoMoveErr) {
          console.error('[WA-AutoMove] Error:', autoMoveErr);
        }

        // Log the success (with instance info for audit)
        await supabase.from("avisos_reuniao_log").insert({
          user_id: resolvedUserId,
          aviso_id: aviso.id,
          aviso_nome: aviso.nome,
          reuniao_id: reuniaoId,
          cliente_nome: clienteNome || reuniao.participantes?.[0] || "Cliente",
          cliente_telefone: telefone,
          dias_antes: 0,
          mensagem_enviada: mensagem,
          status: "enviado",
          instancia_id: avisoInstanciaId,
          instancia_nome: avisoInstanciaNome,
        });

        // For rescheduling type, update ultimo_reagendamento_avisado after sending
        if (isReagendamento && reuniao.numero_reagendamentos !== undefined) {
          await supabase
            .from("reunioes")
            .update({ ultimo_reagendamento_avisado: reuniao.numero_reagendamentos })
            .eq("id", reuniaoId);
          console.log(`Updated ultimo_reagendamento_avisado to ${reuniao.numero_reagendamentos} for reuniao ${reuniaoId}`);
        }

      } catch (err) {
        console.error(`Error processing aviso "${aviso.nome}":`, err);
        
        // Log the error (with instance info for audit)
        await supabase.from("avisos_reuniao_log").insert({
          user_id: resolvedUserId,
          aviso_id: aviso.id,
          aviso_nome: aviso.nome,
          reuniao_id: reuniaoId,
          cliente_nome: clienteNome || reuniao.participantes?.[0] || "Cliente",
          cliente_telefone: telefone,
          dias_antes: 0,
          mensagem_enviada: aviso.mensagem,
          status: "erro",
          erro: String(err),
          instancia_id: instancia.id,
          instancia_nome: instancia.nome,
        });
      }
    }

    const tipoMsg = isReagendamento ? 'de reagendamento' : 'imediato(s)';
    return new Response(
      JSON.stringify({ 
        success: sentCount > 0, 
        message: `${sentCount} aviso(s) ${tipoMsg} enviado(s)`,
        sent: sentCount,
        total: avisos.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
