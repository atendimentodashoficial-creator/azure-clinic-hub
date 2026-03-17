import { supabase } from "@/integrations/supabase/client";
import { getLast8Digits } from "@/utils/phoneFormat";

/**
 * Auto-move WhatsApp and Disparos kanban cards when a meeting is created.
 * Works for both admin and funcionário contexts by accepting the effective userId.
 */
export async function autoMoveKanbanOnReuniao(userId: string, telefone: string) {
  console.log("[KanbanAutoMove] Starting auto-move for userId:", userId, "telefone:", telefone);
  const results = await Promise.allSettled([
    autoMoveWhatsAppKanbanOnReuniao(userId, telefone),
    autoMoveDisparosKanbanOnReuniao(userId, telefone),
  ]);
  console.log("[KanbanAutoMove] Results:", results.map((r, i) => `${i === 0 ? 'WA' : 'Disparos'}: ${r.status}${r.status === 'rejected' ? ' - ' + r.reason : ''}`));
}

async function autoMoveWhatsAppKanbanOnReuniao(userId: string, telefone: string) {
  try {
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_kanban_config")
      .select("auto_move_reuniao_column_id")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[WA-AutoMove] Config:", config, "Error:", configErr);

    const targetColumnId = (config as any)?.auto_move_reuniao_column_id;
    if (!targetColumnId) {
      console.log("[WA-AutoMove] No target column configured, skipping");
      return;
    }

    const last8 = getLast8Digits(telefone);
    if (!last8) {
      console.log("[WA-AutoMove] Could not extract last 8 digits from:", telefone);
      return;
    }

    console.log("[WA-AutoMove] Looking for chats with last8:", last8);

    const { data: chats, error: chatsErr } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .like("normalized_number", `%${last8}`);

    console.log("[WA-AutoMove] Found chats:", chats?.length, "Error:", chatsErr);

    if (!chats || chats.length === 0) return;

    for (const chat of chats) {
      const { data: entry, error: entryErr } = await supabase
        .from("whatsapp_chat_kanban")
        .select("id")
        .eq("chat_id", chat.id)
        .maybeSingle();

      console.log("[WA-AutoMove] Chat:", chat.id, "Existing kanban entry:", entry, "Error:", entryErr);

      if (entry) {
        const { error: updateErr } = await supabase
          .from("whatsapp_chat_kanban")
          .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
          .eq("id", entry.id);
        console.log("[WA-AutoMove] Updated kanban entry, error:", updateErr);
      } else {
        const { error: insertErr } = await supabase.from("whatsapp_chat_kanban").insert({
          user_id: userId,
          chat_id: chat.id,
          column_id: targetColumnId,
        });
        console.log("[WA-AutoMove] Inserted kanban entry, error:", insertErr);
      }
    }
  } catch (err) {
    console.error("[WA-AutoMove] Error in autoMoveWhatsAppKanbanOnReuniao:", err);
  }
}

async function autoMoveDisparosKanbanOnReuniao(userId: string, telefone: string) {
  try {
    const { data: config, error: configErr } = await supabase
      .from("disparos_kanban_config")
      .select("auto_move_reuniao_column_id")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[Disparos-AutoMove] Config:", config, "Error:", configErr);

    const targetColumnId = (config as any)?.auto_move_reuniao_column_id;
    if (!targetColumnId) {
      console.log("[Disparos-AutoMove] No target column configured, skipping");
      return;
    }

    const last8 = getLast8Digits(telefone);
    if (!last8) return;

    console.log("[Disparos-AutoMove] Looking for chats with last8:", last8);

    const { data: chats, error: chatsErr } = await supabase
      .from("disparos_chats")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .like("normalized_number", `%${last8}`);

    console.log("[Disparos-AutoMove] Found chats:", chats?.length, "Error:", chatsErr);

    if (!chats || chats.length === 0) return;

    for (const chat of chats) {
      const { data: entry, error: entryErr } = await supabase
        .from("disparos_chat_kanban")
        .select("id")
        .eq("chat_id", chat.id)
        .maybeSingle();

      console.log("[Disparos-AutoMove] Chat:", chat.id, "Existing kanban entry:", entry, "Error:", entryErr);

      if (entry) {
        const { error: updateErr } = await supabase
          .from("disparos_chat_kanban")
          .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
          .eq("id", entry.id);
        console.log("[Disparos-AutoMove] Updated kanban entry, error:", updateErr);
      } else {
        const { error: insertErr } = await supabase.from("disparos_chat_kanban").insert({
          user_id: userId,
          chat_id: chat.id,
          column_id: targetColumnId,
        });
        console.log("[Disparos-AutoMove] Inserted kanban entry, error:", insertErr);
      }
    }
  } catch (err) {
    console.error("[Disparos-AutoMove] Error in autoMoveDisparosKanbanOnReuniao:", err);
  }
}
