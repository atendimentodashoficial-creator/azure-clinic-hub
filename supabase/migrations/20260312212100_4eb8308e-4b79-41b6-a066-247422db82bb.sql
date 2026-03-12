
-- Clientes de tarefas (separados dos leads existentes)
CREATE TABLE public.tarefas_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  senha_acesso TEXT,
  telefone TEXT,
  empresa TEXT,
  cnpj TEXT,
  site TEXT,
  instagram TEXT,
  linktree TEXT,
  google_meu_negocio TEXT,
  observacoes TEXT,
  grupo_whatsapp TEXT,
  tipo TEXT NOT NULL DEFAULT 'interno',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task clients"
  ON public.tarefas_clientes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add cliente_id to tarefas
ALTER TABLE public.tarefas
  ADD COLUMN cliente_id UUID REFERENCES public.tarefas_clientes(id) ON DELETE SET NULL;
