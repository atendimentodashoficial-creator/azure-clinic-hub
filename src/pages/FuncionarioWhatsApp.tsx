// Funcionário WhatsApp reuses the same WhatsApp page as admin.
// Since each funcionário has their own auth user, uazapi_config and whatsapp_chats
// are naturally scoped to their user_id.
export { default } from "./AdminWhatsApp";
