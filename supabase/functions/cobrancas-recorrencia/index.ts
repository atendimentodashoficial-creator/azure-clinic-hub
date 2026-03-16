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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find MRR charges that are paid and have auto-recurrence enabled
    // and haven't generated next month's charge yet
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

    // Get all MRR charges with recurrence active that are paid
    const { data: cobrancasPagas, error: fetchError } = await supabase
      .from("cobrancas")
      .select("*")
      .eq("tipo", "mrr")
      .eq("recorrencia_ativa", true)
      .eq("status", "pago");

    if (fetchError) throw fetchError;

    let created = 0;

    for (const cobranca of cobrancasPagas || []) {
      // Calculate next month's due date
      const vencimento = new Date(cobranca.data_vencimento + "T12:00:00");
      const nextMonth = new Date(vencimento);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextVencimento = nextMonth.toISOString().split("T")[0];

      // Check if next month charge already exists
      const { data: existing } = await supabase
        .from("cobrancas")
        .select("id")
        .eq("cliente_id", cobranca.cliente_id)
        .eq("user_id", cobranca.user_id)
        .eq("recorrencia_origem_id", cobranca.id)
        .eq("data_vencimento", nextVencimento)
        .maybeSingle();

      if (existing) continue;

      // Create next month's charge
      const { error: insertError } = await supabase.from("cobrancas").insert({
        user_id: cobranca.user_id,
        cliente_id: cobranca.cliente_id,
        descricao: cobranca.descricao,
        valor: cobranca.valor,
        tipo: "mrr",
        status: "pendente",
        data_vencimento: nextVencimento,
        recorrencia_ativa: true,
        recorrencia_origem_id: cobranca.id,
        observacoes: cobranca.observacoes,
        metodo_pagamento: cobranca.metodo_pagamento,
      });

      if (insertError) {
        console.error("Error creating recurrence:", insertError);
        continue;
      }
      created++;
    }

    // Also mark overdue charges
    const todayStr = today.toISOString().split("T")[0];
    await supabase
      .from("cobrancas")
      .update({ status: "atrasado" })
      .eq("status", "pendente")
      .lt("data_vencimento", todayStr);

    return new Response(
      JSON.stringify({ success: true, created, checked: cobrancasPagas?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
