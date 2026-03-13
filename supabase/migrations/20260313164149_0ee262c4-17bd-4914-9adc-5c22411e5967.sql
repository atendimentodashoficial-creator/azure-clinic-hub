
CREATE TABLE public.tipos_tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipos_arquivo_permitidos TEXT[] NOT NULL DEFAULT '{}',
  limite_arquivos JSONB NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tipos_tarefas"
  ON public.tipos_tarefas
  FOR ALL
  TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (user_id = public.get_owner_id(auth.uid()));
