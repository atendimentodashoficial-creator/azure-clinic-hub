import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatRow = {
  id: string;
  chat_id: string;
  instancia_id: string | null;
  contact_number: string | null;
  normalized_number: string | null;
};

function getDigits(value: string): string {
  if (!value) return "";
  return value.replace(/[^\d]/g, "").replace(/@.*$/, "");
}

function getLast8Digits(value: string): string {
  return getDigits(value).slice(-8);
}

function getProviderNumber(chat: ChatRow): string | null {
  const digits = getDigits(chat.normalized_number || chat.contact_number || chat.chat_id || "");
  return digits.length >= 8 ? digits : null;
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function runProviderDeletes(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  chatsToDelete: ChatRow[],
): Promise<void> {
  const instanciaIds = Array.from(
    new Set(chatsToDelete.map((c) => c.instancia_id).filter(Boolean) as string[]),
  );

  if (instanciaIds.length === 0) return;

  const { data: configs, error: configsError } = await supabase
    .from("disparos_instancias")
    .select("id, base_url, api_key")
    .eq("user_id", userId)
    .in("id", instanciaIds);

  if (configsError) {
    console.error("Error fetching instancia configs:", configsError);
    return;
  }

  const configMap = new Map(
    (configs || []).map((cfg) => [cfg.id as string, { base_url: cfg.base_url as string, api_key: cfg.api_key as string }]),
  );

  const queue = chatsToDelete
    .map((chat) => {
      if (!chat.instancia_id) return null;
      const cfg = configMap.get(chat.instancia_id);
      if (!cfg || !chat.chat_id) return null;

      return {
        baseUrl: cfg.base_url.replace(/\/+$/, ""),
        apiKey: cfg.api_key,
        chatId: chat.chat_id,
        number: getProviderNumber(chat),
      };
    })
    .filter(Boolean) as Array<{ baseUrl: string; apiKey: string; chatId: string; number: string | null }>;

  if (queue.length === 0) return;

  const CONCURRENCY = 6;

  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;

      try {
        await withTimeout(2500, async (signal) => {
          const payload: Record<string, string> = { chatId: item.chatId };
          if (item.number) {
            payload.number = item.number;
            payload.phone = item.number;
          }

          const response = await fetch(`${item.baseUrl}/chat/delete`, {
            method: "POST",
            signal,
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "token": item.apiKey,
            },
            body: JSON.stringify(payload),
          });

          const text = await response.text();
          if (!response.ok) {
            console.error(`UAZapi delete error for ${item.chatId}:`, text);
          }
        });
      } catch (apiError) {
        console.error(`Error deleting chat ${item.chatId} from UAZapi:`, apiError);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json().catch(() => ({}));

    let chatIdsToProcess: string[] = [];
    if (Array.isArray(body.chat_ids)) {
      chatIdsToProcess = body.chat_ids;
    } else if (body.chat_id) {
      chatIdsToProcess = [body.chat_id];
    }

    if (chatIdsToProcess.length === 0) {
      throw new Error("chat_id or chat_ids is required");
    }

    console.log(`=== Deleting ${chatIdsToProcess.length} chats for user ${user.id} ===`);

    const { data: selectedChats, error: chatsError } = await supabase
      .from("disparos_chats")
      .select("id, chat_id, instancia_id, contact_number, normalized_number")
      .eq("user_id", user.id)
      .in("id", chatIdsToProcess);

    if (chatsError) {
      console.error("Error fetching chats:", chatsError);
      throw new Error("Error fetching chats");
    }

    if (!selectedChats || selectedChats.length === 0) {
      console.log("No chats found - already deleted, returning success");
      return new Response(
        JSON.stringify({ success: true, deleted: 0, already_deleted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneLast8Set = new Set<string>();
    const instanciaIds = new Set<string>();

    for (const chat of selectedChats as ChatRow[]) {
      const last8 = getLast8Digits(chat.contact_number || chat.normalized_number || chat.chat_id);
      if (last8.length === 8) phoneLast8Set.add(last8);
      if (chat.instancia_id) instanciaIds.add(chat.instancia_id);
    }

    const { data: userChats, error: userChatsError } = await supabase
      .from("disparos_chats")
      .select("id, chat_id, instancia_id, contact_number, normalized_number")
      .eq("user_id", user.id);

    if (userChatsError) {
      console.error("Error fetching user chats:", userChatsError);
      throw new Error("Error fetching user chats");
    }

    const matchedChats = (userChats || []).filter((chat) => {
      const last8 = getLast8Digits(chat.contact_number || chat.normalized_number || chat.chat_id);
      return last8 && phoneLast8Set.has(last8);
    }) as ChatRow[];

    const chatsToDelete = matchedChats.length > 0 ? matchedChats : (selectedChats as ChatRow[]);
    const chatDbIdsToDelete = Array.from(new Set(chatsToDelete.map((c) => c.id)));

    if (chatDbIdsToDelete.length > 0) {
      console.log(`Deleting messages for ${chatDbIdsToDelete.length} chats...`);

      const [{ error: messagesError }, { error: kanbanError }, { error: deleteError }] = await Promise.all([
        supabase.from("disparos_messages").delete().in("chat_id", chatDbIdsToDelete),
        supabase.from("disparos_chat_kanban").delete().in("chat_id", chatDbIdsToDelete),
        supabase.from("disparos_chats").delete().in("id", chatDbIdsToDelete).eq("user_id", user.id),
      ]);

      if (messagesError) console.error("Error deleting messages:", messagesError);
      if (kanbanError) console.error("Error deleting kanban positions:", kanbanError);

      if (deleteError) {
        console.error("Error deleting chats:", deleteError);
        throw new Error("Error deleting chats");
      }
    }

    const nowIso = new Date().toISOString();
    const tombstones: Array<{ user_id: string; phone_last8: string; instancia_id: string | null; deleted_at: string }> = [];
    const instanciaIdList = Array.from(instanciaIds);

    for (const last8 of phoneLast8Set) {
      if (instanciaIdList.length > 0) {
        for (const instanciaId of instanciaIdList) {
          tombstones.push({
            user_id: user.id,
            phone_last8: last8,
            instancia_id: instanciaId,
            deleted_at: nowIso,
          });
        }
      } else {
        tombstones.push({
          user_id: user.id,
          phone_last8: last8,
          instancia_id: null,
          deleted_at: nowIso,
        });
      }
    }

    if (tombstones.length > 0) {
      const { error: tombstoneError } = await supabase
        .from("disparos_chat_deletions")
        .upsert(tombstones, { onConflict: "user_id,phone_last8,instancia_id" });

      if (tombstoneError) {
        console.error("Error creating tombstones:", tombstoneError);
      }
    }

    EdgeRuntime.waitUntil(runProviderDeletes(supabase, user.id, chatsToDelete));

    console.log(
      `=== Successfully deleted ${chatDbIdsToDelete.length} chats and created ${tombstones.length} tombstone(s) ===`,
    );

    return new Response(
      JSON.stringify({ success: true, deleted: chatDbIdsToDelete.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in disparos-delete-chat:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});