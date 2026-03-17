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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tipo_reuniao_id, data_inicio, data_fim, intervalo_minutos } = await req.json();

    if (!tipo_reuniao_id) {
      return new Response(JSON.stringify({ error: "tipo_reuniao_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get tipo_reuniao info
    const { data: tipoReuniao, error: tipoErr } = await supabase
      .from("tipos_reuniao")
      .select("*")
      .eq("id", tipo_reuniao_id)
      .single();

    if (tipoErr || !tipoReuniao) {
      return new Response(JSON.stringify({ error: "Tipo de reunião não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duracaoMinutos = tipoReuniao.duracao_minutos || 60;
    const step = intervalo_minutos || 30;
    const userId = tipoReuniao.user_id;

    // 2. Get members linked to this tipo_reuniao
    const { data: tipoMembros } = await supabase
      .from("tipos_reuniao_membros")
      .select("membro_id")
      .eq("tipo_reuniao_id", tipo_reuniao_id);

    if (!tipoMembros || tipoMembros.length === 0) {
      return new Response(JSON.stringify({ 
        tipo_reuniao: tipoReuniao.nome,
        duracao_minutos: duracaoMinutos,
        membros: [],
        message: "Nenhum profissional vinculado a este tipo de reunião" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membroIds = tipoMembros.map((tm: any) => tm.membro_id);

    // 3. Get member info
    const { data: membros } = await supabase
      .from("tarefas_membros")
      .select("id, nome, cargo, email")
      .in("id", membroIds);

    // 4. Calculate date range (in Brasilia timezone)
    const now = new Date();
    // Get current time in Brasilia using Intl
    const brasiliaFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const brasiliaParts = brasiliaFormatter.formatToParts(now);
    const bp: Record<string, string> = {};
    for (const p of brasiliaParts) bp[p.type] = p.value;
    const brasiliaTime = new Date(
      Number(bp.year), Number(bp.month) - 1, Number(bp.day),
      Number(bp.hour), Number(bp.minute)
    );

    const startStr = data_inicio && /^\d{4}-\d{2}-\d{2}$/.test(data_inicio)
      ? data_inicio
      : `${bp.year}-${bp.month}-${bp.day}`;

    const endStr = data_fim && /^\d{4}-\d{2}-\d{2}$/.test(data_fim)
      ? data_fim
      : (() => {
          const d = new Date(Number(bp.year), Number(bp.month) - 1, Number(bp.day));
          d.setDate(d.getDate() + 7);
          return formatDate(d);
        })();

    const startDate = new Date(startStr + "T00:00:00");
    const endDate = new Date(endStr + "T23:59:59");

    // 5. Get escalas for all members  (moved before usage)

    // 6. Get ausencias for all members in the period
    const { data: ausencias } = await supabase
      .from("ausencias_membros")
      .select("*")
      .in("membro_id", membroIds)
      .lte("data_inicio", endStr)
      .gte("data_fim", startStr);

    // 7. Get existing reunioes in the period for these members
    const startISO = new Date(startStr + "T03:00:00Z").toISOString();
    const endISO = new Date(endStr + "T02:59:59Z").toISOString();

    const { data: reunioesExistentes } = await supabase
      .from("reunioes")
      .select("id, data_reuniao, duracao_minutos, profissional_id, status")
      .eq("user_id", userId)
      .in("status", ["agendado", "confirmado"])
      .gte("data_reuniao", startISO)
      .lte("data_reuniao", endISO);

    // 8. Build availability per member
    const result: any[] = [];

    for (const membro of (membros || [])) {
      const membroEscalas = (escalas || []).filter((e: any) => e.membro_id === membro.id);
      const membroAusencias = (ausencias || []).filter((a: any) => a.membro_id === membro.id);
      const membroReunioes = (reunioesExistentes || []).filter((r: any) => r.profissional_id === membro.id);

      const diasDisponiveis: any[] = [];

      // Iterate each day in range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate);
        const diaSemana = currentDate.getDay(); // 0=domingo

        // Check if member has schedule this day
        const escalasDia = membroEscalas.filter((e: any) => e.dia_semana === diaSemana);
        
        if (escalasDia.length === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Check if member is absent this day
        const estaAusente = membroAusencias.some((a: any) => {
          return dateStr >= a.data_inicio && dateStr <= a.data_fim;
        });

        if (estaAusente) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Get reunioes for this day
        const reunioesDia = membroReunioes.filter((r: any) => {
          const reuniaoDate = new Date(r.data_reuniao);
          return formatDateFromISO(reuniaoDate) === dateStr;
        });

        // Build occupied ranges (in minutes from midnight)
        const occupied = reunioesDia.map((r: any) => {
          const d = new Date(r.data_reuniao);
          const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit", minute: "2-digit", hour12: false,
          });
          const parts = fmt.formatToParts(d);
          const pp: Record<string, string> = {};
          for (const p of parts) pp[p.type] = p.value;
          const startMin = Number(pp.hour) * 60 + Number(pp.minute);
          const dur = r.duracao_minutos || duracaoMinutos;
          return { startMin, endMin: startMin + dur };
        });

        // Generate available slots from each escala window
        const horarios: string[] = [];

        for (const escala of escalasDia) {
          const [hI, mI] = escala.hora_inicio.split(":").map(Number);
          const [hF, mF] = escala.hora_fim.split(":").map(Number);
          const windowStart = hI * 60 + mI;
          const windowEnd = hF * 60 + mF;

          for (let t = windowStart; t + duracaoMinutos <= windowEnd; t += step) {
            const slotStart = t;
            const slotEnd = t + duracaoMinutos;

            // Check overlap with any occupied slot
            const hasConflict = occupied.some((occ: any) => 
              slotStart < occ.endMin && slotEnd > occ.startMin
            );

            if (!hasConflict) {
              // Skip past times for today
              if (dateStr === formatDate(brasiliaTime)) {
                const nowMin = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
                if (slotStart <= nowMin) continue;
              }

              const h = Math.floor(t / 60);
              const m = t % 60;
              horarios.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
            }
          }
        }

        if (horarios.length > 0) {
          diasDisponiveis.push({
            data: dateStr,
            dia_semana: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][diaSemana],
            horarios_disponiveis: horarios,
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      result.push({
        membro_id: membro.id,
        nome: membro.nome,
        cargo: membro.cargo,
        dias: diasDisponiveis,
      });
    }

    return new Response(JSON.stringify({
      tipo_reuniao: tipoReuniao.nome,
      tipo_reuniao_id: tipoReuniao.id,
      duracao_minutos: duracaoMinutos,
      periodo: { inicio: formatDate(startDate), fim: formatDate(endDate) },
      membros: result,
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

function formatDateFromISO(d: Date): string {
  // Convert UTC to Brasilia
  const brasiliaOffset = -3 * 60;
  const brasiliaD = new Date(d.getTime() + (d.getTimezoneOffset() + brasiliaOffset) * 60000);
  return formatDate(brasiliaD);
}
