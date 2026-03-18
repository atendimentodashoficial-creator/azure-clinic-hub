
CREATE TABLE public.disparos_aquecimento_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  system_prompt TEXT DEFAULT '',
  tools_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.disparos_aquecimento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own aquecimento config"
  ON public.disparos_aquecimento_config
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
