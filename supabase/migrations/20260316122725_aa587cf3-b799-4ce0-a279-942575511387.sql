
-- Create whatsapp_kanban_config table (similar to disparos_kanban_config)
CREATE TABLE public.whatsapp_kanban_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  auto_move_column_id uuid REFERENCES public.whatsapp_kanban_columns(id) ON DELETE SET NULL,
  auto_move_reuniao_column_id uuid REFERENCES public.whatsapp_kanban_columns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_kanban_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own whatsapp kanban config"
ON public.whatsapp_kanban_config
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add first_reply_moved column to whatsapp_chat_kanban
ALTER TABLE public.whatsapp_chat_kanban
ADD COLUMN IF NOT EXISTS first_reply_moved boolean NOT NULL DEFAULT false;
