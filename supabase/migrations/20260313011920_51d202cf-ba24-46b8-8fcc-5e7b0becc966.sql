ALTER TABLE public.tarefas_membros 
  ADD COLUMN IF NOT EXISTS whatsapp_base_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_api_key text,
  ADD COLUMN IF NOT EXISTS whatsapp_instance_name text;