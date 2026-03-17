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
    const { data: config } = await supabase
      .from("whatsapp_kanban_config")
      .select("auto_move_reuniao_column_id")
      .eq("user_id", userId)
      .maybeSingle();

    const targetColumnId = (config as any)?.auto_move_reuniao_column_id;
    if (!targetColumnId) return;

    const last8 = getLast8Digits(telefone);
    if (!last8) return;

    const { data: chats } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .like("normalized_number", `%${last8}`);

    if (!chats || chats.length === 0) return;

    for (const chat of chats) {
      const { data: entry } = await supabase
        .from("whatsapp_chat_kanban")
        .select("id")
        .eq("chat_id", chat.id)
        .maybeSingle();

      if (entry) {
        await supabase
          .from("whatsapp_chat_kanban")
          .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
          .eq("id", entry.id);
      } else {
        await supabase.from("whatsapp_chat_kanban").insert({
          user_id: userId,
          chat_id: chat.id,
          column_id: targetColumnId,
        });
      }
    }
  } catch (err) {
    console.error("[WA-AutoMove] Error in autoMoveWhatsAppKanbanOnReuniao:", err);
  }
}

async function autoMoveDisparosKanbanOnReuniao(userId: string, telefone: string) {
  try {
    const { data: config } = await supabase
      .from("disparos_kanban_config")
      .select("auto_move_reuniao_column_id")
      .eq("user_id", userId)
      .maybeSingle();

    const targetColumnId = (config as any)?.auto_move_reuniao_column_id;
    if (!targetColumnId) return;

    const last8 = getLast8Digits(telefone);
    if (!last8) return;

    const { data: chats } = await supabase
      .from("disparos_chats")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .like("normalized_number", `%${last8}`);

    if (!chats || chats.length === 0) return;

    for (const chat of chats) {
      const { data: entry } = await supabase
        .from("disparos_chat_kanban")
        .select("id")
        .eq("chat_id", chat.id)
        .maybeSingle();

      if (entry) {
        await supabase
          .from("disparos_chat_kanban")
          .update({ column_id: targetColumnId, updated_at: new Date().toISOString() })
          .eq("id", entry.id);
      } else {
        await supabase.from("disparos_chat_kanban").insert({
          user_id: userId,
          chat_id: chat.id,
          column_id: targetColumnId,
        });
      }
    }
  } catch (err) {
    console.error("[AutoMove] Error in autoMoveDisparosKanbanOnReuniao:", err);
  }
}
