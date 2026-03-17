import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const {
      tipo_reuniao_id,
      membro_id,
      data_hora,
      duracao_minutos,
      cliente_nome,
      cliente_telefone,
      titulo,
    } = await req.json();

    // Validações
    if (!tipo_reuniao_id && !membro_id) {
      return new Response(JSON.stringify({ error: "tipo_reuniao_id ou membro_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data_hora) {
      return new Response(JSON.stringify({ error: "data_hora é obrigatório (ISO 8601 ou YYYY-MM-DDTHH:mm)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rejeitar horários no passado
    const agora = new Date();
    const dataHoraSolicitada = new Date(data_hora);
    if (dataHoraSolicitada.getTime() <= agora.getTime()) {
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
      // If only membro_id, get member's owner
      const { data: member } = await supabase
        .from("tarefas_membros")
        .select("user_id")
        .eq("id", membro_id)
        .single();
      if (!member) {
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
      // Auto-select: find member with least conflicts at that time
      const { data: tipoMembros } = await supabase
        .from("tipos_reuniao_membros")
        .select("membro_id")
        .eq("tipo_reuniao_id", tipo_reuniao_id);

      if (!tipoMembros || tipoMembros.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum profissional vinculado a este tipo de reunião" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const membroIds = tipoMembros.map((tm: any) => tm.membro_id);

      // Check availability for each member
      const startDate2 = new Date(data_hora);
      const endDate2 = new Date(startDate2.getTime() + duracaoFinal * 60 * 1000);
      const dateStr = formatDate(startDate2);

      // Get escalas for this day and check time range
      const dayOfWeek = startDate2.getDay();
      const { data: escalas } = await supabase
        .from("escalas_membros")
        .select("membro_id, hora_inicio, hora_fim")
        .in("membro_id", membroIds)
        .eq("ativo", true)
        .eq("dia_semana", dayOfWeek);

      // Filter members whose schedule covers the requested time range
      const startTimeStr = formatTime(startDate2);
      const endTimeStr = formatTime(endDate2);
      const membrosComEscala = (escalas || [])
        .filter((e: any) => e.hora_inicio <= startTimeStr && e.hora_fim >= endTimeStr)
        .map((e: any) => e.membro_id);

      // Check ausencias
      const { data: ausencias } = await supabase
        .from("ausencias_membros")
        .select("membro_id")
        .in("membro_id", membrosComEscala)
        .lte("data_inicio", dateStr)
        .gte("data_fim", dateStr);

      const membrosAusentes = new Set((ausencias || []).map((a: any) => a.membro_id));
      const membrosDisponiveis = membrosComEscala.filter((id: string) => !membrosAusentes.has(id));

      if (membrosDisponiveis.length === 0) {
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
        return `${formatDate(d)}T02:59:59.000Z`;
      })();

      const { data: allDayMeetings } = await supabase
        .from("reunioes")
        .select("id, data_reuniao, duracao_minutos, profissional_id")
        .eq("user_id", ownerUserId)
        .in("status", ["agendado", "confirmado"])
        .gte("data_reuniao", dayStartISO)
        .lte("data_reuniao", dayEndISO);

      // For each available member, resolve profissional_id, count meetings, check conflict
      const candidates: { membroId: string; meetingCount: number }[] = [];

      for (const mid of membrosDisponiveis) {
        const { data: memberData } = await supabase
          .from("tarefas_membros")
          .select("auth_user_id, email")
          .eq("id", mid)
          .single();

        let profId: string | null = null;
        if (memberData?.email) {
          const targetId = memberData?.auth_user_id || ownerUserId;
          const { data: prof } = await supabase
            .from("profissionais")
            .select("id")
            .eq("user_id", targetId)
            .eq("email", memberData.email)
            .maybeSingle();
          profId = prof?.id || null;
        }

        // Check time conflict for this member
        const memberMeetings = (allDayMeetings || []).filter((r: any) => r.profissional_id === profId);
        const hasConflict = memberMeetings.some((r: any) => {
          const rStart = new Date(r.data_reuniao).getTime();
          const rEnd = rStart + ((r.duracao_minutos || 60) * 60 * 1000);
          return startDate2.getTime() < rEnd && endDate2.getTime() > rStart;
        });

        if (!hasConflict) {
          candidates.push({ membroId: mid, meetingCount: memberMeetings.length });
        }
      }

      if (candidates.length === 0) {
        return new Response(JSON.stringify({ error: "Todos os profissionais estão ocupados neste horário" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sort by fewest meetings, then randomize ties
      candidates.sort((a, b) => a.meetingCount - b.meetingCount);
      const minCount = candidates[0].meetingCount;
      const tied = candidates.filter((c) => c.meetingCount === minCount);
      const chosen = tied[Math.floor(Math.random() * tied.length)];
      targetMemberId = chosen.membroId;
      console.log(`Auto-selected membro ${targetMemberId} with ${chosen.meetingCount} meetings (${tied.length} tied)`);
    }

    // 3. Get member details
    const { data: member } = await supabase
      .from("tarefas_membros")
      .select("id, user_id, nome, email, auth_user_id")
      .eq("id", targetMemberId)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = member.auth_user_id || ownerUserId;

    // 4. Server-side conflict check for selected member
    const startDate = new Date(data_hora);
    const endDate = new Date(startDate.getTime() + duracaoFinal * 60 * 1000);

    const { data: conflicting } = await supabase
      .from("reunioes")
      .select("id, data_reuniao, duracao_minutos")
      .eq("user_id", targetUserId)
      .in("status", ["agendado", "confirmado"])
      .gte("data_reuniao", new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte("data_reuniao", new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const hasConflict = (conflicting || []).some((r: any) => {
      const rStart = new Date(r.data_reuniao).getTime();
      const rEnd = rStart + ((r.duracao_minutos || 60) * 60 * 1000);
      return startDate.getTime() < rEnd && endDate.getTime() > rStart;
    });

    if (hasConflict) {
      return new Response(JSON.stringify({ error: "Este profissional já possui uma reunião neste horário" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Resolve profissional_id
    let profissionalId: string | null = null;
    if (member.email) {
      const { data: prof } = await supabase
        .from("profissionais")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("email", member.email)
        .maybeSingle();
      profissionalId = prof?.id || null;
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
        data_reuniao: data_hora,
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
      throw reuniaoError || new Error("Falha ao criar reunião");
    }

    // 9. Fire-and-forget: send notification
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
      data_hora,
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

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date): string {
  // Convert to Brasilia time (UTC-3) for comparison with escalas
  const brasiliaOffset = -3 * 60;
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const brasiliaDate = new Date(utcMs + brasiliaOffset * 60000);
  const h = brasiliaDate.getHours().toString().padStart(2, "0");
  const min = brasiliaDate.getMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}
