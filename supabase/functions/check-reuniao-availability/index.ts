// v2 - fixed escalas query and timezone handling
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

    const { tipo_reuniao_id, data_inicio, data_fim, intervalo_minutos, cargo_filtro } = await req.json();

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
    const parsedStep = Number(intervalo_minutos);
    const step = Number.isFinite(parsedStep) ? Math.min(60, Math.max(15, parsedStep)) : 30;
    const userId = tipoReuniao.user_id;
    const cargoFilterNormalized = normalizeText(cargo_filtro || "Closer");

    // 2. Get members linked to this tipo_reuniao
    const { data: tipoMembros } = await supabase
      .from("tipos_reuniao_membros")
      .select("membro_id")
      .eq("tipo_reuniao_id", tipo_reuniao_id);

    if (!tipoMembros || tipoMembros.length === 0) {
      return new Response(JSON.stringify({ 
        tipo_reuniao: tipoReuniao.nome,
        duracao_minutos: duracaoMinutos,
        dias: [],
        message: "Nenhum profissional vinculado a este tipo de reunião" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membroIds = tipoMembros.map((tm: any) => tm.membro_id);

    // 3. Get member info + cargo filter (default: Closer)
    const { data: membros } = await supabase
      .from("tarefas_membros")
      .select("id, nome, cargo, email")
      .in("id", membroIds);

    const membrosFiltradosPorCargo = (membros || []).filter((m: any) => {
      if (!cargoFilterNormalized) return true;
      return normalizeText(m?.cargo) === cargoFilterNormalized;
    });

    if (membrosFiltradosPorCargo.length === 0) {
      return new Response(JSON.stringify({
        tipo_reuniao: tipoReuniao.nome,
        duracao_minutos: duracaoMinutos,
        dias: [],
        message: `Nenhum profissional com cargo "${cargo_filtro || "Closer"}" vinculado a este tipo de reunião`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membroIdsFiltrados = membrosFiltradosPorCargo.map((m: any) => m.id);

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

    const startDate = new Date(Number(startStr.slice(0,4)), Number(startStr.slice(5,7)) - 1, Number(startStr.slice(8,10)));
    const endDate = new Date(Number(endStr.slice(0,4)), Number(endStr.slice(5,7)) - 1, Number(endStr.slice(8,10)), 23, 59, 59);

    // 5. Get escalas for all members
    const { data: escalas } = await supabase
      .from("escalas_membros")
      .select("*")
      .in("membro_id", membroIds)
      .eq("ativo", true);

    // 6. Get ausencias for all members in the period
    const { data: ausencias } = await supabase
      .from("ausencias_membros")
      .select("*")
      .in("membro_id", membroIds)
      .lte("data_inicio", endStr)
      .gte("data_fim", startStr);

    // 7. Get existing reunioes in the period for these members
    // Brasilia is UTC-3, so midnight Brasilia = 03:00 UTC
    const startISO = `${startStr}T03:00:00.000Z`;
    // End of day in Brasilia = next day 02:59:59 UTC
    const endISO = (() => {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return `${formatDate(nextDay)}T02:59:59.000Z`;
    })();

    const { data: reunioesExistentes } = await supabase
      .from("reunioes")
      .select("id, data_reuniao, duracao_minutos, profissional_id, status")
      .eq("user_id", userId)
      .in("status", ["agendado", "confirmado"])
      .gte("data_reuniao", startISO)
      .lte("data_reuniao", endISO);

    // 8. Build aggregated availability (sem identificar profissionais)
    const diasMap = new Map<string, { dia_semana: string; horarios: Set<string> }>();

    for (const membro of (membros || [])) {
      const membroEscalas = (escalas || []).filter((e: any) => e.membro_id === membro.id);
      const membroAusencias = (ausencias || []).filter((a: any) => a.membro_id === membro.id);
      const membroReunioes = (reunioesExistentes || []).filter((r: any) => r.profissional_id === membro.id);

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate);
        const diaSemana = currentDate.getDay(); // 0=domingo

        const escalasDia = membroEscalas.filter((e: any) => e.dia_semana === diaSemana);
        if (escalasDia.length === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const estaAusente = membroAusencias.some((a: any) => dateStr >= a.data_inicio && dateStr <= a.data_fim);
        if (estaAusente) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const reunioesDia = membroReunioes.filter((r: any) => {
          const reuniaoDate = new Date(r.data_reuniao);
          return formatDateFromISO(reuniaoDate) === dateStr;
        });

        const occupied = reunioesDia.map((r: any) => {
          const d = new Date(r.data_reuniao);
          const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const parts = fmt.formatToParts(d);
          const pp: Record<string, string> = {};
          for (const p of parts) pp[p.type] = p.value;
          const startMin = Number(pp.hour) * 60 + Number(pp.minute);
          const dur = r.duracao_minutos || duracaoMinutos;
          return { startMin, endMin: startMin + dur };
        });

        for (const escala of escalasDia) {
          const [hI, mI] = escala.hora_inicio.split(":").map(Number);
          const [hF, mF] = escala.hora_fim.split(":").map(Number);
          const windowStart = hI * 60 + mI;
          const windowEnd = hF * 60 + mF;

          for (let t = windowStart; t + duracaoMinutos <= windowEnd; t += step) {
            const slotStart = t;
            const slotEnd = t + duracaoMinutos;
            const hasConflict = occupied.some((occ: any) => slotStart < occ.endMin && slotEnd > occ.startMin);
            if (hasConflict) continue;

            if (dateStr === formatDate(brasiliaTime)) {
              const nowMin = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
              if (slotStart <= nowMin) continue;
            }

            const h = Math.floor(t / 60);
            const m = t % 60;
            const horario = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

            const diaAtual = diasMap.get(dateStr) ?? {
              dia_semana: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][diaSemana],
              horarios: new Set<string>(),
            };
            diaAtual.horarios.add(horario);
            diasMap.set(dateStr, diaAtual);
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const dias = Array.from(diasMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, info]) => ({
        data,
        dia_semana: info.dia_semana,
        horarios_disponiveis: Array.from(info.horarios).sort(),
      }));

    return new Response(JSON.stringify({
      tipo_reuniao: tipoReuniao.nome,
      tipo_reuniao_id: tipoReuniao.id,
      duracao_minutos: duracaoMinutos,
      periodo: { inicio: formatDate(startDate), fim: formatDate(endDate) },
      dias,
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
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}
