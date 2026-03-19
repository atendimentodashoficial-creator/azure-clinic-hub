
-- Add tem_ia boolean to tarefas_clientes
ALTER TABLE public.tarefas_clientes ADD COLUMN IF NOT EXISTS tem_ia boolean NOT NULL DEFAULT false;

-- Create table for AI platform credentials per client
CREATE TABLE public.cliente_plataformas_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.tarefas_clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  url text,
  login text,
  senha text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_plataformas_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own client AI platforms"
  ON public.cliente_plataformas_ia
  FOR ALL
  TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));
