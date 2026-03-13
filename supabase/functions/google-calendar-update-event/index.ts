import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { reuniaoId, novaDataHora, duracaoMinutos, profissionalId } = body;

    if (!reuniaoId || !novaDataHora) {
      return new Response(
        JSON.stringify({ success: false, error: "ID da reunião e nova data/hora são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the reuniao without filtering by user_id
    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes")
      .select("google_event_id, duracao_minutos, titulo, numero_reagendamentos, cliente_telefone, participantes, user_id")
      .eq("id", reuniaoId)
      .single();

    if (reuniaoError || !reuniao) {
      console.error("Reuniao not found:", reuniaoError);
      return new Response(
        JSON.stringify({ success: false, error: "Reunião não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve owner/admin relationship and verify permissions
    const meetingOwnerId = reuniao.user_id;

    // If the meeting owner is an employee, this returns their admin user_id
    const { data: ownerMember } = await supabase
      .from("tarefas_membros")
      .select("user_id")
      .eq("auth_user_id", meetingOwnerId)
      .maybeSingle();

    const adminUserId = ownerMember?.user_id || meetingOwnerId;

    const isAdmin = user.id === adminUserId;
    const isMeetingOwnerEmployee = user.id === meetingOwnerId;

    let isEmployeeFromSameAdmin = false;
    if (!isAdmin && !isMeetingOwnerEmployee) {
      const { data: currentMember } = await supabase
        .from("tarefas_membros")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("user_id", adminUserId)
        .maybeSingle();
      isEmployeeFromSameAdmin = !!currentMember;
    }

    const authorized = isAdmin || isMeetingOwnerEmployee || isEmployeeFromSameAdmin;
    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalDuracao = duracaoMinutos || reuniao.duracao_minutos || 60;
    const startDate = new Date(novaDataHora);
    const endDate = new Date(startDate.getTime() + finalDuracao * 60 * 1000);
    
    // Increment numero_reagendamentos
    const newNumeroReagendamentos = (reuniao.numero_reagendamentos || 0) + 1;

    // Build update payload - include profissional_id if provided
    const updatePayload: Record<string, unknown> = {
      data_reuniao: startDate.toISOString(),
      status: "agendado",
      numero_reagendamentos: newNumeroReagendamentos,
    };
    if (profissionalId !== undefined) {
      updatePayload.profissional_id = profissionalId;
    }

    // Helper function to trigger rescheduling notifications in background (non-blocking)
    const triggerReschedulingNotificationsInBackground = () => {
      const notificationPromise = (async () => {
        try {
          console.log("Triggering rescheduling notifications in background...");
          const notifyResponse = await fetch(
            `${supabaseUrl}/functions/v1/enviar-aviso-reuniao-imediato`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                reuniaoId,
                userId: meetingOwnerId,
                clienteTelefone: reuniao.cliente_telefone,
                clienteNome: reuniao.participantes?.[0] || "Cliente",
                tipo: "reagendamento",
              }),
            }
          );
          const notifyResult = await notifyResponse.json();
          console.log("Background rescheduling notification result:", notifyResult);
        } catch (err) {
          console.error("Error in background rescheduling notification:", err);
        }
      })();

      const runtime = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
      if (runtime?.waitUntil) {
        runtime.waitUntil(notificationPromise);
      } else {
        notificationPromise.catch(console.error);
      }
    };

    if (!reuniao.google_event_id) {
      const { error: updateError } = await supabase
        .from("reunioes")
        .update(updatePayload)
        .eq("id", reuniaoId);

      if (updateError) throw updateError;

      triggerReschedulingNotificationsInBackground();

      return new Response(
        JSON.stringify({ success: true, message: "Reunião reagendada localmente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Calendar config using the ADMIN's user_id (not the employee's)
    const { data: config, error: configError } = await supabase
      .from("google_calendar_config")
      .select("*")
      .eq("user_id", adminUserId)
      .single();

    if (configError || !config || !config.access_token) {
      console.error("Config error:", configError);
      await supabase.from("reunioes").update(updatePayload).eq("id", reuniaoId);
      
      triggerReschedulingNotificationsInBackground();
      
      return new Response(
        JSON.stringify({ success: true, message: "Reunião reagendada localmente (Google Calendar não conectado)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = config.access_token;

    // Check if token is expired and refresh if needed
    if (config.token_expires_at && new Date(config.token_expires_at) <= new Date()) {
      console.log("Token expired, refreshing...");
      
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          refresh_token: config.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error("Token refresh error:", refreshData);
        await supabase.from("reunioes").update(updatePayload).eq("id", reuniaoId);
        
        triggerReschedulingNotificationsInBackground();
        
        return new Response(
          JSON.stringify({ success: true, warning: "Reunião reagendada localmente. Erro ao renovar token do Google." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshData.access_token;
      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      await supabase
        .from("google_calendar_config")
        .update({
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", adminUserId);
    }

    // Update event in Google Calendar
    const calendarId = config.calendar_id || "primary";
    console.log(`Updating Google Calendar event: ${reuniao.google_event_id}`);
    
    const calendarUpdateBody = {
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
    };

    const updateResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(reuniao.google_event_id)}?sendUpdates=all`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarUpdateBody),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      console.error("Google Calendar update error:", errorData);
      await supabase.from("reunioes").update(updatePayload).eq("id", reuniaoId);
      
      triggerReschedulingNotificationsInBackground();
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Reunião reagendada localmente, mas houve erro ao atualizar no Google Calendar" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventData = await updateResponse.json();
    console.log("Google Calendar event updated successfully");

    // Update local record
    const { error: updateError } = await supabase
      .from("reunioes")
      .update(updatePayload)
      .eq("id", reuniaoId);

    if (updateError) {
      console.error("Error updating local record:", updateError);
    }

    triggerReschedulingNotificationsInBackground();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Reunião reagendada com sucesso no Google Calendar",
        htmlLink: eventData.htmlLink
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
