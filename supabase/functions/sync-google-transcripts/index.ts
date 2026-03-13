import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(supabase: any, userId: string, config: any): Promise<string> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    console.error("Token refresh failed:", err);
    throw new Error("Falha ao renovar token do Google");
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("google_calendar_config")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return tokenData.access_token;
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: config, error } = await supabase
    .from("google_calendar_config")
    .select("access_token, refresh_token, client_id, client_secret, token_expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !config) {
    throw new Error("Google Calendar não configurado. Conecte sua conta em Configurações.");
  }

  if (!config.refresh_token || !config.client_id || !config.client_secret) {
    throw new Error("Configuração do Google incompleta. Reconecte sua conta.");
  }

  // Check if token is expired or about to expire (5 min buffer)
  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
  const now = Date.now();

  if (!config.access_token || now > expiresAt - 5 * 60 * 1000) {
    return await refreshAccessToken(supabase, userId, config);
  }

  return config.access_token;
}

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  mimeType: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing Google Meet transcripts for user: ${userId}`);

    const accessToken = await getValidAccessToken(supabase, userId);

    // Search for Google Meet transcript files in Google Drive
    // Meet transcripts are stored as Google Docs with a specific naming pattern
    const searchQuery = encodeURIComponent(
      "mimeType='application/vnd.google-apps.document' and fullText contains 'Transcript' and trashed=false"
    );
    
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name,createdTime,modifiedTime,mimeType)&pageSize=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveResponse.ok) {
      const errText = await driveResponse.text();
      console.error("Drive API error:", driveResponse.status, errText);
      
      if (driveResponse.status === 403 && errText.includes("insufficientPermissions")) {
        throw new Error("Permissão negada. Verifique se o escopo do Google Drive está habilitado na sua conta OAuth.");
      }
      throw new Error(`Erro ao buscar arquivos do Drive: ${driveResponse.status} - ${errText}`);
    }

    const driveData = await driveResponse.json();
    const files: DriveFile[] = driveData.files || [];

    console.log(`Found ${files.length} transcript files in Drive`);

    let synced = 0;

    for (const file of files) {
      // Check if already synced by using the Drive file ID as the fireflies_id field
      // (reusing the same column to avoid a migration)
      const driveFileId = `gdrive_${file.id}`;
      
      const { data: existing } = await supabase
        .from("reunioes")
        .select("id")
        .eq("fireflies_id", driveFileId)
        .eq("user_id", userId)
        .single();

      if (existing) {
        continue;
      }

      // Fetch the document content as plain text
      let transcricaoCompleta: string | null = null;
      try {
        const exportResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (exportResponse.ok) {
          transcricaoCompleta = await exportResponse.text();
          // Trim excessive whitespace
          transcricaoCompleta = transcricaoCompleta?.trim() || null;
        } else {
          console.error(`Failed to export file ${file.id}:`, exportResponse.status);
        }
      } catch (e) {
        console.error(`Error exporting file ${file.id}:`, e);
      }

      if (!transcricaoCompleta || transcricaoCompleta.length < 50) {
        console.log(`Skipping file ${file.name} - content too short or empty`);
        continue;
      }

      // Extract meeting title from filename
      // Google Meet transcripts usually named like "Meeting transcript - Title - Date"
      let titulo = file.name
        .replace(/^(Meeting transcript|Transcrição da reunião)\s*[-–]\s*/i, "")
        .replace(/\s*[-–]\s*\d{4}[-/]\d{2}[-/]\d{2}.*$/, "")
        .trim() || file.name;

      // Extract participants from transcript content (first few speaker names)
      const participantes: string[] = [];
      const speakerRegex = /^([A-Za-zÀ-ÿ\s]+?):/gm;
      let match;
      const seenSpeakers = new Set<string>();
      const contentPreview = transcricaoCompleta.substring(0, 3000);
      while ((match = speakerRegex.exec(contentPreview)) !== null) {
        const speaker = match[1].trim();
        if (speaker.length > 1 && speaker.length < 50 && !seenSpeakers.has(speaker.toLowerCase())) {
          seenSpeakers.add(speaker.toLowerCase());
          participantes.push(speaker);
        }
        if (participantes.length >= 10) break;
      }

      // Insert new meeting record
      const { error: insertError } = await supabase.from("reunioes").insert({
        user_id: userId,
        fireflies_id: driveFileId,
        titulo: titulo,
        data_reuniao: file.createdTime,
        duracao_minutos: null,
        participantes: participantes.length > 0 ? participantes : null,
        transcricao: transcricaoCompleta,
        resumo_ia: null,
        status: "transcrito",
      });

      if (insertError) {
        console.error("Error inserting meeting:", insertError);
      } else {
        synced++;
        console.log(`Synced transcript: ${titulo}`);
      }
    }

    console.log(`Sync complete. ${synced} new transcripts synced.`);

    return new Response(
      JSON.stringify({ success: true, synced, total: files.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
