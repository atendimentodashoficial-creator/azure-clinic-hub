
-- Create highlights table
CREATE TABLE public.tarefa_grid_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  titulo text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_grid_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own highlights" ON public.tarefa_grid_highlights
  FOR ALL USING (public.can_access_owner_data(auth.uid(), user_id));

-- RPC: get highlights by approval token
CREATE OR REPLACE FUNCTION public.get_grid_highlights_by_approval_token(p_token text)
RETURNS TABLE(
  highlight_id uuid,
  tarefa_id uuid,
  ordem integer,
  titulo text,
  image_url text,
  status text,
  feedback text,
  tarefa_titulo text,
  cliente_nome text,
  cliente_empresa text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    h.id as highlight_id,
    h.tarefa_id,
    h.ordem,
    h.titulo,
    h.image_url,
    h.status,
    h.feedback,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa
  FROM tarefa_grid_highlights h
  JOIN tarefas t ON t.id = h.tarefa_id
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE h.tarefa_id = v_tarefa_id
  ORDER BY h.ordem;
END;
$$;

-- RPC: update highlight approval
CREATE OR REPLACE FUNCTION public.update_grid_highlight_approval(
  p_token text,
  p_highlight_id uuid,
  p_status text,
  p_feedback text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_concluido_coluna_id uuid;
  v_total_grid integer;
  v_aprovados_grid integer;
  v_total_highlights integer;
  v_aprovados_highlights integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_grid_highlights
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_highlight_id AND tarefa_id = v_tarefa_id;

  -- Log revision
  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status)
  VALUES (v_tarefa_id, p_feedback, p_status);

  -- If rejected, move to Em Revisão
  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;

    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;

  -- Check if ALL items (grid posts + highlights) are approved
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado')
  INTO v_total_grid, v_aprovados_grid
  FROM tarefa_grid_posts WHERE tarefa_id = v_tarefa_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado')
  INTO v_total_highlights, v_aprovados_highlights
  FROM tarefa_grid_highlights WHERE tarefa_id = v_tarefa_id;

  IF (v_total_grid + v_total_highlights) > 0 
     AND (v_total_grid + v_total_highlights) = (v_aprovados_grid + v_aprovados_highlights) THEN
    SELECT id INTO v_concluido_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Concluído' LIMIT 1;

    IF v_concluido_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_concluido_coluna_id, approval_status = 'concluido', updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;
END;
$$;

-- Also update the grid post approval to consider highlights
CREATE OR REPLACE FUNCTION public.update_grid_post_approval(p_token text, p_grid_post_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_concluido_coluna_id uuid;
  v_total_grid integer;
  v_aprovados_grid integer;
  v_total_highlights integer;
  v_aprovados_highlights integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_grid_posts
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_grid_post_id AND tarefa_id = v_tarefa_id;

  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status)
  VALUES (v_tarefa_id, p_feedback, p_status);

  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;

    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado')
  INTO v_total_grid, v_aprovados_grid
  FROM tarefa_grid_posts WHERE tarefa_id = v_tarefa_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado')
  INTO v_total_highlights, v_aprovados_highlights
  FROM tarefa_grid_highlights WHERE tarefa_id = v_tarefa_id;

  IF (v_total_grid + v_total_highlights) > 0 
     AND (v_total_grid + v_total_highlights) = (v_aprovados_grid + v_aprovados_highlights) THEN
    SELECT id INTO v_concluido_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Concluído' LIMIT 1;

    IF v_concluido_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_concluido_coluna_id, approval_status = 'concluido', updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;
END;
$$;
