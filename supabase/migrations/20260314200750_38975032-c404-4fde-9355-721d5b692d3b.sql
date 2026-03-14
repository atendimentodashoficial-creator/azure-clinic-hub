
ALTER TABLE public.tarefas_membros ADD COLUMN IF NOT EXISTS whatsapp_aviso_pessoal text;
ALTER TABLE public.tarefas_membros ADD COLUMN IF NOT EXISTS whatsapp_aviso_grupo text;
