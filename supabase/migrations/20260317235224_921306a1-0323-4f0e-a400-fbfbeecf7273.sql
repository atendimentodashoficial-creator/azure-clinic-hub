-- Add external table name field to disparos_instancias
ALTER TABLE public.disparos_instancias 
ADD COLUMN IF NOT EXISTS tabela_supabase_externa text;

-- Create config table for external Supabase connection
CREATE TABLE IF NOT EXISTS public.disparos_supabase_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supabase_url text NOT NULL,
  supabase_service_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.disparos_supabase_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own supabase config"
  ON public.disparos_supabase_config
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());