import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get external Supabase config
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: extConfig } = await adminClient
      .from("disparos_supabase_config")
      .select("supabase_url, supabase_service_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!extConfig?.supabase_url || !extConfig?.supabase_service_key) {
      return new Response(
        JSON.stringify({ error: "Configure a conexão com o Supabase externo primeiro (aba Supabase)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create external Supabase client
    const extClient = createClient(extConfig.supabase_url, extConfig.supabase_service_key);

    const { action, content, metadata, documentId, name } = await req.json();

    // LIST action
    if (action === "list") {
      const { data: docs, error } = await extClient
        .from("documents")
        .select("id, content, metadata")
        .order("id", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, documents: docs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE action
    if (action === "delete") {
      if (!documentId) {
        return new Response(JSON.stringify({ error: "documentId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await extClient
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE action
    if (action === "update") {
      if (!documentId || !content || typeof content !== "string" || content.trim().length === 0) {
        return new Response(JSON.stringify({ error: "documentId and content are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get OpenAI API key
      let openaiKey: string | null = null;
      const { data: userConfig } = await adminClient
        .from("openai_config")
        .select("api_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (userConfig?.api_key) {
        openaiKey = userConfig.api_key;
      } else {
        openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
      }

      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: "Nenhuma chave OpenAI configurada." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalContent = name ? `${name}\n\n${content.trim()}` : content.trim();

      // Re-generate embedding
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: finalContent,
        }),
      });

      if (!embeddingResponse.ok) {
        const errText = await embeddingResponse.text();
        console.error("OpenAI embedding error:", errText);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar embedding: " + embeddingResponse.status }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      const docMetadata = {
        source: name || "manual",
        ...(metadata || {}),
      };

      const { data: doc, error: updateError } = await extClient
        .from("documents")
        .update({
          content: finalContent,
          metadata: docMetadata,
          embedding: JSON.stringify(embedding),
        })
        .eq("id", documentId)
        .select("id, content, metadata")
        .single();

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, document: doc }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INSERT action (default)
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI API key - try user's key first, then global
    let openaiKey: string | null = null;

    const { data: userConfig } = await adminClient
      .from("openai_config")
      .select("api_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (userConfig?.api_key) {
      openaiKey = userConfig.api_key;
    } else {
      openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
    }

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "Nenhuma chave OpenAI configurada. Configure em Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build final content with document name prefix if provided
    const finalContent = name ? `${name}\n\n${content.trim()}` : content.trim();

    // Generate embedding via OpenAI
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: finalContent,
      }),
    });

    if (!embeddingResponse.ok) {
      const errText = await embeddingResponse.text();
      console.error("OpenAI embedding error:", errText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar embedding: " + embeddingResponse.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Build metadata matching external format
    const docMetadata = {
      source: name || "manual",
      ...(metadata || {}),
    };

    // Insert into external Supabase documents table
    const { data: doc, error: insertError } = await extClient
      .from("documents")
      .insert({
        content: finalContent,
        metadata: docMetadata,
        embedding: JSON.stringify(embedding),
      })
      .select("id, content, metadata")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, document: doc }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("rag-embed-document error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
