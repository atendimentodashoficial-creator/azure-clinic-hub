import { supabase } from "@/integrations/supabase/client";

type TaskNotificationEvent =
  | "atribuida"
  | "aprovacao_interna"
  | "aprovacao_cliente"
  | "reprovada_cliente"
  | "ajustada"
  | "aprovada_concluida";

interface SendTaskNotificationParams {
  evento: TaskNotificationEvent;
  tarefa_id: string;
  user_id: string;
  feedback?: string;
  link_aprovacao?: string;
}

export async function sendTaskNotification(params: SendTaskNotificationParams) {
  try {
    const { data, error } = await supabase.functions.invoke("enviar-aviso-tarefa", {
      body: params,
    });

    if (error) {
      console.error("Task notification error:", error);
      return;
    }

    if (data?.sent > 0) {
      console.log(`Task notification sent: ${data.sent}/${data.total}`);
    } else {
      console.log("Task notification: no messages sent", data?.message);
    }
  } catch (err) {
    // Silent fail - notifications should not block workflow
    console.error("Task notification exception:", err);
  }
}
