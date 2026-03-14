
-- Table to store which WhatsApp instance is used for task notifications (one per user)
CREATE TABLE public.tarefas_notificacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instancia_id uuid REFERENCES public.disparos_instancias(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.tarefas_notificacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own task notification config"
  ON public.tarefas_notificacao_config
  FOR ALL
  TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

-- Add avisos jsonb column to tipos_tarefas for per-type notification settings
ALTER TABLE public.tipos_tarefas ADD COLUMN IF NOT EXISTS avisos jsonb DEFAULT '{}'::jsonb;
