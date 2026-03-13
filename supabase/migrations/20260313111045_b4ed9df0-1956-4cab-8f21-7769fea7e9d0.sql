
-- Add comissao column to tarefas table
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS comissao numeric DEFAULT NULL;

-- Create comissoes table to track commission approvals
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  membro_nome text NOT NULL,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  aprovado_em timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- Admin can see all comissoes for their workspace
CREATE POLICY "Owner can manage comissoes"
  ON public.comissoes FOR ALL
  TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));
