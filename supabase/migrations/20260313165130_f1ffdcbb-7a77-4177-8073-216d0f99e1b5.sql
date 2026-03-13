
-- Tabela para armazenar slides de mockup de uma tarefa
CREATE TABLE public.tarefa_mockups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  subtitulo TEXT,
  titulo TEXT,
  legenda TEXT,
  cta TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_mockups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mockups" ON public.tarefa_mockups
  FOR ALL TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

-- Adicionar campo tipo_tarefa_id na tabela tarefas
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS tipo_tarefa_id UUID REFERENCES public.tipos_tarefas(id) ON DELETE SET NULL;
