import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const INTERNAL_CALL_TIMEOUT_MS = 12000;
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

async function callInternalFunction(
  supabaseUrl: string,
  functionName: string,
  cronSecret: string,
): Promise<{ ok: boolean; status: number; payload: any }> {
  const response = await fetchWithTimeout(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": cronSecret,
      },
    },
    INTERNAL_CALL_TIMEOUT_MS,
  );

  const payload = await parseResponseSafe(response);
  return { ok: response.ok, status: response.status, payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    console.error("Invalid or missing authentication", {
      hasCronHeader: cronHeader.length > 0,
      hasAuthHeader: authHeaderRaw.length > 0,
      hasApiKeyHeader: apikeyHeader.length > 0,
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing backend env vars");
    return new Response(JSON.stringify({ error: "Missing backend env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    console.log(`[CRON] Starting disparos cron at ${now.toISOString()}`);

    const internalFunctions = [
      "admin-notifications-cron",
      "enviar-avisos-agendamento",
      "enviar-avisos-reuniao",
    ];

    for (const functionName of internalFunctions) {
      try {
        console.log(`[CRON] Triggering ${functionName}...`);
        const result = await callInternalFunction(SUPABASE_URL, functionName, CRON_SECRET);

        if (!result.ok) {
          console.warn(`[CRON] ${functionName} failed with status ${result.status}`, result.payload);
          continue;
        }

        console.log(`[CRON] ${functionName} result:`, result.payload);
      } catch (error: any) {
        console.error(`[CRON] Error calling ${functionName}:`, error?.message ?? error);
      }
    }

    // Find all running campaigns that are ready to continue
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
      console.log("[CRON] No running campaigns to process");
      return new Response(
        JSON.stringify({ success: true, message: "No campaigns to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[CRON] Found ${campanhas.length} campaigns to process`);

    const results: any[] = [];

    for (const campanha of campanhas) {
      try {
        console.log(`[CRON] Processing campaign \"${campanha.nome}\" (${campanha.id}) for user ${campanha.user_id}`);

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

        const result = await parseResponseSafe(response);

        if (!response.ok) {
          console.warn(`[CRON] Campaign \"${campanha.nome}\" returned status ${response.status}`, result);
        }

        console.log(`[CRON] Campaign \"${campanha.nome}\" result:`, result);

        results.push({
          campanha_id: campanha.id,
          nome: campanha.nome,
          success: result?.success ?? response.ok,
          message: result?.message || result?.error,
          skipped: result?.skipped || false,
        });
      } catch (error: any) {
        console.error(`[CRON] Error processing campaign ${campanha.id}:`, error);
        results.push({
          campanha_id: campanha.id,
          nome: campanha.nome,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    console.log(
      `[CRON] Finished. Processed: ${successCount}, Skipped: ${skippedCount}, Failed: ${results.length - successCount - skippedCount}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        skipped: skippedCount,
        total: campanhas.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[CRON] Error in disparos-cron:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});