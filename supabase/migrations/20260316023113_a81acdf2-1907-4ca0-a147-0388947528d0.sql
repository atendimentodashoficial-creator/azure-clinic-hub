
-- Table for configurable job titles (cargos)
CREATE TABLE public.tarefas_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#6B7280',
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tarefas_cargos ENABLE ROW LEVEL SECURITY;

-- RLS policies using can_access_owner_data
CREATE POLICY "Users can view cargos" ON public.tarefas_cargos
  FOR SELECT TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id));

CREATE POLICY "Users can insert cargos" ON public.tarefas_cargos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Users can update cargos" ON public.tarefas_cargos
  FOR UPDATE TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id));

CREATE POLICY "Users can delete cargos" ON public.tarefas_cargos
  FOR DELETE TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id));
