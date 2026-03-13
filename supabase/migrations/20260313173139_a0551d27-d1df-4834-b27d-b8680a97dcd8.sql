
-- Add approval_token to tarefas for public approval link
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS approval_token text UNIQUE;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pendente';

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_tarefas_approval_token ON public.tarefas(approval_token) WHERE approval_token IS NOT NULL;

-- Allow public (anon) to read tarefa_mockups by token lookup via RPC
CREATE OR REPLACE FUNCTION public.get_mockups_by_approval_token(p_token text)
RETURNS TABLE (
  mockup_id uuid,
  tarefa_id uuid,
  ordem int,
  subtitulo text,
  titulo text,
  legenda text,
  cta text,
  status text,
  feedback text,
  tarefa_titulo text,
  cliente_nome text,
  cliente_empresa text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  RETURN QUERY
  SELECT 
    m.id as mockup_id,
    m.tarefa_id,
    m.ordem,
    m.subtitulo,
    m.titulo,
    m.legenda,
    m.cta,
    m.status,
    m.feedback,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa
  FROM tarefa_mockups m
  JOIN tarefas t ON t.id = m.tarefa_id
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE m.tarefa_id = v_tarefa_id
  ORDER BY m.ordem;
END;
$$;

-- RPC to update mockup approval status publicly
CREATE OR REPLACE FUNCTION public.update_mockup_approval(p_token text, p_mockup_id uuid, p_status text, p_feedback text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_mockups
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;
END;
$$;

-- RPC to bulk update all mockups for a task
CREATE OR REPLACE FUNCTION public.bulk_update_mockup_approval(p_token text, p_status text, p_feedback text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_mockups
  SET status = p_status, feedback = COALESCE(p_feedback, feedback), updated_at = now()
  WHERE tarefa_id = v_tarefa_id;
END;
$$;
