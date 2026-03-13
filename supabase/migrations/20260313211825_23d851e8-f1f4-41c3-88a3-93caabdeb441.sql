
CREATE TABLE public.tarefa_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  titulo TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own task links"
ON public.tarefa_links
FOR ALL
TO authenticated
USING (public.can_access_owner_data(auth.uid(), user_id))
WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));
