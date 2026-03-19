import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const CAMPAIGN_CONTROL_TIMEOUT_MS = 15000;

const extractBearerToken = (value: string) =>
  value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : value;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`REQUEST_TIMEOUT_${timeoutMs}MS`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponseSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // INCIDENT MITIGATION: temporarily bypass scheduler execution to relieve backend/database pressure.
  return new Response(JSON.stringify({ success: true, skipped: true, reason: "scheduler_temporarily_disabled" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

  // Validate authentication: accept CRON_SECRET header, service role key, or anon/publishable key
  const cronHeader = (req.headers.get("x-cron-secret") ?? "").trim();
  const authHeaderRaw = (req.headers.get("authorization") ?? "").trim();
  const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
  const authToken = extractBearerToken(authHeaderRaw);

  const anonCandidates = [
    (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim(),
    (Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "").trim(),
  ].filter((value) => value.length > 0);

  const serviceRoleToken = SERVICE_ROLE_KEY.trim();
  const cronSecretToken = CRON_SECRET.trim();

  const isValidCronSecret = cronSecretToken.length > 0 && cronHeader === cronSecretToken;
  const isValidServiceRole = serviceRoleToken.length > 0 && authToken === serviceRoleToken;
  const isValidAnonKey = anonCandidates.includes(authToken) || anonCandidates.includes(apikeyHeader);

  if (!isValidCronSecret && !isValidServiceRole && !isValidAnonKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing backend env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    console.log(`[CRON] Starting disparos-cron (campaign-only) at ${now.toISOString()}`);

    // IMPORTANT: This function was intentionally reduced to campaign processing only.
    // It no longer triggers other cron functions (admin-notifications / avisos) to avoid
    // duplicate schedulers and reduce overall backend load during instability.

    const { data: campanhas, error: campanhasError } = await supabase
      .from("disparos_campanhas")
      .select("id, nome, user_id, next_send_at, status, delay_min")
      .eq("status", "running")
      .or(`next_send_at.is.null,next_send_at.lte.${now.toISOString()}`);

    if (campanhasError) {
      console.error("Error fetching campaigns:", campanhasError);
      throw campanhasError;
    }

    if (!campanhas || campanhas.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No campaigns to process", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const campanha of campanhas) {
      try {
        const response = await fetchWithTimeout(
          `${SUPABASE_URL}/functions/v1/disparos-campanha-control`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              campanha_id: campanha.id,
              action: "continue",
            }),
          },
          CAMPAIGN_CONTROL_TIMEOUT_MS,
        );

        const payload = await parseResponseSafe(response);

        results.push({
          campanha_id: campanha.id,
          nome: campanha.nome,
          status: response.status,
          ok: response.ok,
          payload,
        });
      } catch (error: any) {
        results.push({
          campanha_id: campanha.id,
          nome: campanha.nome,
          ok: false,
          error: error?.message ?? String(error),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, total: campanhas.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});