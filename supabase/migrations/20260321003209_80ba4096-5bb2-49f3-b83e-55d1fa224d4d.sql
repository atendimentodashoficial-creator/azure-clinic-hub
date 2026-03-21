
CREATE TABLE public.conta_pj_extratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  arquivo_nome text,
  transacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  categorias_custom jsonb NOT NULL DEFAULT '[]'::jsonb,
  tx_categorias_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conta_pj_extratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own extratos"
  ON public.conta_pj_extratos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (user_id = (SELECT public.get_owner_id(auth.uid())));
