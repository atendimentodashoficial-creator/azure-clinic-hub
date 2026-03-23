import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Parse a date string as São Paulo time.
 * If no timezone is specified, appends -03:00 (São Paulo standard).
 */
function parseSaoPauloDate(dateStr: string): Date {
  if (/[Zz]/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "-03:00");
}

/**
 * Format a Date to "YYYY-MM-DD" in São Paulo timezone.
 */
function formatDateBR(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

/**
 * Format a Date to "HH:mm" in São Paulo timezone.
 */
function formatTimeBR(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(d);
}

/**
 * Get day of week (0=Sunday) in São Paulo timezone.
 */
function getDayOfWeekBR(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  });
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[fmt.format(d)] ?? d.getDay();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("[n8n-schedule-reuniao] Received payload:", JSON.stringify(body));

    const {
      tipo_reuniao_id,
      membro_id,
      data_hora,
      duracao_minutos,
      cliente_nome,
      cliente_telefone,
      titulo,
      cargo_filtro,
    } = body;

    const cargoFilter = cargo_filtro || "Closer";

    // Validações
    if (!tipo_reuniao_id && !membro_id) {
      console.log("[n8n-schedule-reuniao] FAIL: missing tipo_reuniao_id and membro_id");
      return new Response(JSON.stringify({ error: "tipo_reuniao_id ou membro_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data_hora) {
      console.log("[n8n-schedule-reuniao] FAIL: missing data_hora");
      return new Response(JSON.stringify({ error: "data_hora é obrigatório (ISO 8601 ou YYYY-MM-DDTHH:mm)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse data_hora as São Paulo time
    const dataHoraSolicitada = parseSaoPauloDate(data_hora);
    console.log("[n8n-schedule-reuniao] Parsed data_hora:", data_hora, "-> UTC:", dataHoraSolicitada.toISOString(), "-> SP:", formatDateBR(dataHoraSolicitada), formatTimeBR(dataHoraSolicitada));

    // Rejeitar horários no passado
    const agora = new Date();
    if (dataHoraSolicitada.getTime() <= agora.getTime()) {
      console.log("[n8n-schedule-reuniao] FAIL: past date. Requested:", dataHoraSolicitada.toISOString(), "Now:", agora.toISOString());
      return new Response(JSON.stringify({ error: "Não é possível agendar em horários que já passaram" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Resolve tipo_reuniao and owner
    let tipoReuniao: any = null;
    let ownerUserId: string;
    let duracaoFinal: number;
    let tituloFinal: string;

    if (tipo_reuniao_id) {
      const { data, error } = await supabase
        .from("tipos_reuniao")
        .select("*")
        .eq("id", tipo_reuniao_id)
        .single();
      if (error || !data) {
        console.log("[n8n-schedule-reuniao] FAIL: tipo_reuniao not found:", tipo_reuniao_id, error);
        return new Response(JSON.stringify({ error: "Tipo de reunião não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tipoReuniao = data;
      ownerUserId = tipoReuniao.user_id;
      duracaoFinal = duracao_minutos || tipoReuniao.duracao_minutos || 60;
      tituloFinal = titulo || tipoReuniao.nome;
    } else {
      const { data: member } = await supabase
        .from("tarefas_membros")
        .select("user_id")
        .eq("id", membro_id)
        .single();
      if (!member) {
        console.log("[n8n-schedule-reuniao] FAIL: membro not found:", membro_id);
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      ownerUserId = member.user_id;
      duracaoFinal = duracao_minutos || 60;
      tituloFinal = titulo || "Reunião";
    }

    // 2. Resolve which member to use
    let targetMemberId = membro_id;

    if (!targetMemberId && tipo_reuniao_id) {
      const { data: tipoMembros } = await supabase
        .from("tipos_reuniao_membros")
        .select("membro_id")
        .eq("tipo_reuniao_id", tipo_reuniao_id);

      if (!tipoMembros || tipoMembros.length === 0) {
        console.log("[n8n-schedule-reuniao] FAIL: no members linked to tipo_reuniao:", tipo_reuniao_id);
        return new Response(JSON.stringify({ error: "Nenhum profissional vinculado a este tipo de reunião" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const membroIds = tipoMembros.map((tm: any) => tm.membro_id);

      const { data: membrosComCargo } = await supabase
        .from("tarefas_membros")
        .select("id")
        .in("id", membroIds)
        .ilike("cargo", cargoFilter);

      const membroIdsFiltrados = (membrosComCargo || []).map((m: any) => m.id);

      if (membroIdsFiltrados.length === 0) {
        console.log("[n8n-schedule-reuniao] FAIL: no members with cargo:", cargoFilter, "membroIds:", membroIds);
        return new Response(JSON.stringify({ error: `Nenhum profissional com cargo "${cargoFilter}" vinculado a este tipo de reunião` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check availability for each member using São Paulo timezone
      const startDate2 = dataHoraSolicitada;
      const endDate2 = new Date(startDate2.getTime() + duracaoFinal * 60 * 1000);
      const dateStr = formatDateBR(startDate2);
      const dayOfWeek = getDayOfWeekBR(startDate2);
      const startTimeStr = formatTimeBR(startDate2);
      const endTimeStr = formatTimeBR(endDate2);

      console.log("[n8n-schedule-reuniao] Checking availability: date=", dateStr, "dayOfWeek=", dayOfWeek, "time=", startTimeStr, "-", endTimeStr);

      const { data: escalas } = await supabase
        .from("escalas_membros")
        .select("membro_id, hora_inicio, hora_fim")
        .in("membro_id", membroIdsFiltrados)
        .eq("ativo", true)
        .eq("dia_semana", dayOfWeek);

      console.log("[n8n-schedule-reuniao] Escalas found:", JSON.stringify(escalas));

      // Check ausencias (substituições de escala)
      const { data: ausencias } = await supabase
        .from("ausencias_membros")
        .select("membro_id, hora_inicio, hora_fim")
        .in("membro_id", membroIdsFiltrados)
        .lte("data_inicio", dateStr)
        .gte("data_fim", dateStr);

      // Build effective availability per member considering substituições
      const membrosDisponiveis: string[] = [];

      for (const mid of membroIdsFiltrados) {
        const membroSubstituicoes = (ausencias || []).filter((a: any) => a.membro_id === mid);

        if (membroSubstituicoes.length > 0) {
          const diaInteiroBloqueado = membroSubstituicoes.some((s: any) => !s.hora_inicio || !s.hora_fim);
          if (diaInteiroBloqueado) {
            console.log("[n8n-schedule-reuniao] Member", mid, "blocked full day");
            continue;
          }

          const coversTime = membroSubstituicoes.some((s: any) =>
            s.hora_inicio <= startTimeStr && s.hora_fim >= endTimeStr
          );
          if (coversTime) {
            membrosDisponiveis.push(mid);
          } else {
            console.log("[n8n-schedule-reuniao] Member", mid, "substituição doesn't cover time");
          }
        } else {
          const membroEscala = (escalas || []).find((e: any) =>
            e.membro_id === mid && e.hora_inicio <= startTimeStr && e.hora_fim >= endTimeStr
          );
          if (membroEscala) {
            membrosDisponiveis.push(mid);
          } else {
            console.log("[n8n-schedule-reuniao] Member", mid, "no matching escala for", startTimeStr, "-", endTimeStr, "on day", dayOfWeek);
          }
        }
      }

      if (membrosDisponiveis.length === 0) {
        console.log("[n8n-schedule-reuniao] FAIL: no members available on date. membroIdsFiltrados:", membroIdsFiltrados, "dayOfWeek:", dayOfWeek, "time:", startTimeStr);
        return new Response(JSON.stringify({ error: "Nenhum profissional disponível nesta data" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Count meetings per member on this day and check conflicts
      const dayStartISO = `${dateStr}T03:00:00.000Z`; // midnight Brasilia = 03:00 UTC
      const dayEndISO = (() => {
        const d = new Date(startDate2);
        d.setDate(d.getDate() + 1);
        return `${formatDateBR(d)}T02:59:59.000Z`;
      })();

      const candidates: { membroId: string; meetingCount: number }[] = [];

      for (const mid of membrosDisponiveis) {
        const { data: memberData } = await supabase
          .from("tarefas_membros")
          .select("auth_user_id, email")
          .eq("id", mid)
          .single();

        const memberUserId = memberData?.auth_user_id || ownerUserId;

        const { data: memberDayMeetings } = await supabase
          .from("reunioes")
          .select("id, data_reuniao, duracao_minutos")
          .eq("user_id", memberUserId)
          .in("status", ["agendado", "confirmado"])
          .gte("data_reuniao", dayStartISO)
          .lte("data_reuniao", dayEndISO);

        const hasConflict = (memberDayMeetings || []).some((r: any) => {
          const rStart = new Date(r.data_reuniao).getTime();
          const rEnd = rStart + ((r.duracao_minutos || 60) * 60 * 1000);
          return startDate2.getTime() < rEnd && endDate2.getTime() > rStart;
        });

        if (!hasConflict) {
          candidates.push({ membroId: mid, meetingCount: (memberDayMeetings || []).length });
        }
      }

      if (candidates.length === 0) {
        console.log("[n8n-schedule-reuniao] FAIL: all members busy. membrosDisponiveis:", membrosDisponiveis);
        return new Response(JSON.stringify({ error: "Todos os profissionais estão ocupados neste horário" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      candidates.sort((a, b) => a.meetingCount - b.meetingCount);
      const minCount = candidates[0].meetingCount;
      const tied = candidates.filter((c) => c.meetingCount === minCount);
      const chosen = tied[Math.floor(Math.random() * tied.length)];
      targetMemberId = chosen.membroId;
      console.log(`[n8n-schedule-reuniao] Auto-selected membro ${targetMemberId} with ${chosen.meetingCount} meetings (${tied.length} tied)`);
    }

    // 3. Get member details
    const { data: member } = await supabase
      .from("tarefas_membros")
      .select("id, user_id, nome, email, auth_user_id")
      .eq("id", targetMemberId)
      .single();

    if (!member) {
      console.log("[n8n-schedule-reuniao] FAIL: selected member not found:", targetMemberId);
      return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = member.auth_user_id || ownerUserId;
    console.log("[n8n-schedule-reuniao] Selected member:", member.nome, "targetUserId:", targetUserId);

    // 4. Server-side conflict check for selected member
    const startDate = dataHoraSolicitada;
    const endDate = new Date(startDate.getTime() + duracaoFinal * 60 * 1000);

    const { data: conflicting } = await supabase
      .from("reunioes")
      .select("id, data_reuniao, duracao_minutos, participantes, profissional_id")
      .eq("user_id", ownerUserId)
      .in("status", ["agendado", "confirmado"])
      .gte("data_reuniao", new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte("data_reuniao", new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const memberNameNorm = normalizeText(member.nome);
    const hasConflict = (conflicting || []).filter((r: any) => {
      if (r.profissional_id === member.id) return true;
      if (!r.profissional_id && Array.isArray(r.participantes)) {
        return r.participantes.some((p: string) => normalizeText(p) === memberNameNorm);
      }
      return false;
    }).some((r: any) => {
      const rStart = new Date(r.data_reuniao).getTime();
      const rEnd = rStart + ((r.duracao_minutos || 60) * 60 * 1000);
      return startDate.getTime() < rEnd && endDate.getTime() > rStart;
    });

    if (hasConflict) {
      console.log("[n8n-schedule-reuniao] FAIL: conflict for", targetUserId, "at", data_hora);
      return new Response(JSON.stringify({ error: "Este profissional já possui uma reunião neste horário" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Resolve profissional_id — use membro_id directly (tarefas_membros.id)
    // This ensures check-reuniao-availability can match reuniões to members
    let profissionalId: string | null = member.id || null;
    // Also try to find in profissionais table as secondary reference
    if (member.email) {
      const { data: prof } = await supabase
        .from("profissionais")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("email", member.email)
        .maybeSingle();
      if (prof?.id) profissionalId = prof.id;
    }

    // 6. Resolve cliente_id
    let clienteId: string | null = null;
    if (cliente_telefone) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", targetUserId)
        .is("deleted_at", null)
        .eq("telefone", cliente_telefone)
        .maybeSingle();
      clienteId = lead?.id || null;
    }

    const participantes = [cliente_nome || "Cliente", member.nome].filter(Boolean);

    // Use the properly parsed ISO string for storage
    const dataHoraISO = dataHoraSolicitada.toISOString();

    // 7. Try to create Google Calendar event with Meet link
    let meetLink: string | null = null;
    let googleEventId: string | null = null;

    const { data: gcalConfig } = await supabase
      .from("google_calendar_config")
      .select("access_token, refresh_token, client_id, client_secret, token_expires_at, calendar_id, user_id")
      .not("access_token", "is", null)
      .limit(1)
      .maybeSingle();

    if (gcalConfig?.access_token) {
      try {
        let accessToken = gcalConfig.access_token;

        if (gcalConfig.token_expires_at && new Date(gcalConfig.token_expires_at) <= new Date()) {
          const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: gcalConfig.client_id,
              client_secret: gcalConfig.client_secret,
              refresh_token: gcalConfig.refresh_token,
              grant_type: "refresh_token",
            }),
          });
          const refreshData = await refreshResponse.json();
          if (refreshResponse.ok) {
            accessToken = refreshData.access_token;
            await supabase
              .from("google_calendar_config")
              .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString() })
              .eq("user_id", gcalConfig.user_id);
          }
        }

        const eventBody = {
          summary: tituloFinal,
          description: `Reunião agendada via n8n - ${cliente_nome || "Cliente"}`,
          start: { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };

        const calendarId = gcalConfig.calendar_id || "primary";
        const eventResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
          }
        );

        const eventData = await eventResponse.json();
        if (eventResponse.ok) {
          googleEventId = eventData.id;
          meetLink = eventData.conferenceData?.entryPoints?.find(
            (ep: { entryPointType: string }) => ep.entryPointType === "video"
          )?.uri || null;
        }
      } catch (gcalError) {
        console.error("Google Calendar error:", gcalError);
      }
    }

    const fallbackMeetLink = `https://meet.jit.si/reuniao-${targetUserId.slice(0, 8)}-${Date.now()}`;
    const finalMeetLink = meetLink || fallbackMeetLink;

    // 8. Create the reunion
    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes")
      .insert({
        user_id: targetUserId,
        titulo: tituloFinal,
        data_reuniao: dataHoraISO,
        duracao_minutos: duracaoFinal,
        cliente_telefone: cliente_telefone || null,
        cliente_id: clienteId,
        profissional_id: profissionalId,
        status: "agendado",
        participantes,
        meet_link: finalMeetLink,
        google_event_id: googleEventId,
        tipo_reuniao_id: tipo_reuniao_id || null,
      })
      .select("id")
      .single();

    if (reuniaoError || !reuniao) {
      console.error("[n8n-schedule-reuniao] FAIL: insert error:", reuniaoError);
      throw reuniaoError || new Error("Falha ao criar reunião");
    }

    console.log("[n8n-schedule-reuniao] SUCCESS: reuniao created:", reuniao.id, "for member:", member.nome, "at:", dataHoraISO);

    // 9. Kanban auto-move
    if (cliente_telefone) {
      const last8 = cliente_telefone.replace(/\D/g, '').slice(-8);
      if (last8.length === 8) {
        console.log("[KanbanAutoMove-n8n] Moving cards for last8:", last8, "ownerUserId:", ownerUserId);

        // WhatsApp kanban auto-move
        try {
          const { data: waConfig } = await supabase
            .from("whatsapp_kanban_config")
            .select("auto_move_reuniao_column_id")
            .eq("user_id", ownerUserId)
            .maybeSingle();

          const waTargetCol = (waConfig as any)?.auto_move_reuniao_column_id;
          if (waTargetCol) {
            let { data: waChats } = await supabase
              .from("whatsapp_chats")
              .select("id")
              .eq("user_id", ownerUserId)
              .is("deleted_at", null)
              .like("normalized_number", `%${last8}`);

            if (!waChats || waChats.length === 0) {
              const { data: tombstone } = await supabase
                .from("whatsapp_chat_deletions")
                .select("id")
                .eq("user_id", ownerUserId)
                .eq("phone_last8", last8)
                .maybeSingle();

              if (!tombstone) {
                const phoneClean = cliente_telefone.replace(/\D/g, '');
                const { data: newChat, error: newChatErr } = await supabase
                  .from("whatsapp_chats")
                  .insert({
                    user_id: ownerUserId,
                    chat_id: `${phoneClean}@s.whatsapp.net`,
                    contact_name: cliente_nome || "Cliente",
                    contact_number: phoneClean,
                    normalized_number: phoneClean,
                    last_message: `Reunião "${tituloFinal}" agendada`,
                    last_message_time: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (!newChatErr && newChat) {
                  waChats = [newChat];
                  console.log("[KanbanAutoMove-n8n] Created WA chat:", newChat.id);
                } else {
                  console.error("[KanbanAutoMove-n8n] Error creating WA chat:", newChatErr);
                }
              }
            }

            for (const chat of (waChats || [])) {
              const { data: entry } = await supabase
                .from("whatsapp_chat_kanban")
                .select("id")
                .eq("chat_id", chat.id)
                .maybeSingle();

              if (entry) {
                await supabase
                  .from("whatsapp_chat_kanban")
                  .update({ column_id: waTargetCol, updated_at: new Date().toISOString() })
                  .eq("id", entry.id);
              } else {
                await supabase.from("whatsapp_chat_kanban").insert({
                  user_id: ownerUserId,
                  chat_id: chat.id,
                  column_id: waTargetCol,
                });
              }
              console.log("[KanbanAutoMove-n8n] WA chat moved:", chat.id);
            }
          }
        } catch (waErr) {
          console.error("[KanbanAutoMove-n8n] WA error:", waErr);
        }

        // Disparos kanban auto-move
        try {
          const { data: dispConfig } = await supabase
            .from("disparos_kanban_config")
            .select("auto_move_reuniao_column_id")
            .eq("user_id", ownerUserId)
            .maybeSingle();

          const dispTargetCol = (dispConfig as any)?.auto_move_reuniao_column_id;
          if (dispTargetCol) {
            const { data: dispChats } = await supabase
              .from("disparos_chats")
              .select("id")
              .eq("user_id", ownerUserId)
              .is("deleted_at", null)
              .like("normalized_number", `%${last8}`);

            for (const chat of (dispChats || [])) {
              const { data: entry } = await supabase
                .from("disparos_chat_kanban")
                .select("id")
                .eq("chat_id", chat.id)
                .maybeSingle();

              if (entry) {
                await supabase
                  .from("disparos_chat_kanban")
                  .update({ column_id: dispTargetCol, updated_at: new Date().toISOString() })
                  .eq("id", entry.id);
              } else {
                await supabase.from("disparos_chat_kanban").insert({
                  user_id: ownerUserId,
                  chat_id: chat.id,
                  column_id: dispTargetCol,
                });
              }
              console.log("[KanbanAutoMove-n8n] Disparos chat moved:", chat.id);
            }
          }
        } catch (dispErr) {
          console.error("[KanbanAutoMove-n8n] Disparos error:", dispErr);
        }
      }
    }

    // 10. Fire-and-forget: send notification
    if (cliente_telefone) {
      const notifyPromise = fetch(`${supabaseUrl}/functions/v1/enviar-aviso-reuniao-imediato`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          reuniaoId: reuniao.id,
          userId: targetUserId,
          clienteTelefone: cliente_telefone,
          clienteNome: cliente_nome,
          tipo: "imediato",
        }),
      }).catch(err => console.error("Erro ao disparar aviso:", err));

      try {
        (globalThis as any).EdgeRuntime?.waitUntil?.(notifyPromise);
      } catch { /* fallback */ }
    }

    return new Response(JSON.stringify({
      success: true,
      reuniao_id: reuniao.id,
      profissional: member.nome,
      membro_id: member.id,
      data_hora: dataHoraISO,
      duracao_minutos: duracaoFinal,
      meet_link: finalMeetLink,
      google_event_created: !!googleEventId,
      cliente_nome: cliente_nome || null,
      cliente_telefone: cliente_telefone || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
