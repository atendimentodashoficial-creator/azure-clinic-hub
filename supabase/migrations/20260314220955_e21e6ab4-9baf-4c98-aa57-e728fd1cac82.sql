
-- Internal approval version of update_mockup_approval
CREATE OR REPLACE FUNCTION public.update_mockup_approval_internal(p_token text, p_mockup_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_slide_ordem integer;
  v_total_mockups integer;
  v_aprovados_mockups integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;

  SELECT ordem INTO v_slide_ordem FROM tarefa_mockups WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  UPDATE tarefa_mockups SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  INSERT INTO tarefa_revisoes (tarefa_id, mockup_id, slide_ordem, feedback, status)
  VALUES (v_tarefa_id, p_mockup_id, v_slide_ordem, p_feedback, 'interna_' || p_status);

  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id FROM tarefas_colunas WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;
    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, aprovacao_interna_status = 'reprovado', updated_at = now() WHERE id = v_tarefa_id;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado') INTO v_total_mockups, v_aprovados_mockups
  FROM tarefa_mockups WHERE tarefa_id = v_tarefa_id;

  IF v_total_mockups > 0 AND v_total_mockups = v_aprovados_mockups THEN
    UPDATE tarefas SET aprovacao_interna_status = 'aprovado', updated_at = now() WHERE id = v_tarefa_id;
  END IF;
END;
$$;

-- Internal approval version of update_grid_post_approval
CREATE OR REPLACE FUNCTION public.update_grid_post_approval_internal(p_token text, p_grid_post_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_total_grid integer;
  v_aprovados_grid integer;
  v_total_highlights integer;
  v_aprovados_highlights integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;

  UPDATE tarefa_grid_posts SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_grid_post_id AND tarefa_id = v_tarefa_id;

  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status) VALUES (v_tarefa_id, p_feedback, 'interna_' || p_status);

  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id FROM tarefas_colunas WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;
    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, aprovacao_interna_status = 'reprovado', updated_at = now() WHERE id = v_tarefa_id;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado') INTO v_total_grid, v_aprovados_grid
  FROM tarefa_grid_posts WHERE tarefa_id = v_tarefa_id;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado') INTO v_total_highlights, v_aprovados_highlights
  FROM tarefa_grid_highlights WHERE tarefa_id = v_tarefa_id;

  IF (v_total_grid + v_total_highlights) > 0 AND (v_total_grid + v_total_highlights) = (v_aprovados_grid + v_aprovados_highlights) THEN
    UPDATE tarefas SET aprovacao_interna_status = 'aprovado', updated_at = now() WHERE id = v_tarefa_id;
  END IF;
END;
$$;

-- Internal approval version of update_grid_highlight_approval
CREATE OR REPLACE FUNCTION public.update_grid_highlight_approval_internal(p_token text, p_highlight_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_total_grid integer;
  v_aprovados_grid integer;
  v_total_highlights integer;
  v_aprovados_highlights integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;

  UPDATE tarefa_grid_highlights SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_highlight_id AND tarefa_id = v_tarefa_id;

  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status) VALUES (v_tarefa_id, p_feedback, 'interna_' || p_status);

  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id FROM tarefas_colunas WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;
    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, aprovacao_interna_status = 'reprovado', updated_at = now() WHERE id = v_tarefa_id;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado') INTO v_total_grid, v_aprovados_grid
  FROM tarefa_grid_posts WHERE tarefa_id = v_tarefa_id;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado') INTO v_total_highlights, v_aprovados_highlights
  FROM tarefa_grid_highlights WHERE tarefa_id = v_tarefa_id;

  IF (v_total_grid + v_total_highlights) > 0 AND (v_total_grid + v_total_highlights) = (v_aprovados_grid + v_aprovados_highlights) THEN
    UPDATE tarefas SET aprovacao_interna_status = 'aprovado', updated_at = now() WHERE id = v_tarefa_id;
  END IF;
END;
$$;

-- Internal approval version of update_task_approval_by_token (for link-only)
CREATE OR REPLACE FUNCTION public.update_task_approval_by_internal_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;

  IF p_status = 'aprovado' THEN
    UPDATE tarefas SET aprovacao_interna_status = 'aprovado', updated_at = now() WHERE id = v_tarefa_id;
  ELSIF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id FROM tarefas_colunas WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;
    UPDATE tarefas SET aprovacao_interna_status = 'reprovado', coluna_id = COALESCE(v_revisao_coluna_id, coluna_id), updated_at = now() WHERE id = v_tarefa_id;
  END IF;

  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status) VALUES (v_tarefa_id, p_feedback, 'interna_' || p_status);
END;
$$;

-- Internal version of bulk_update_mockup_approval
CREATE OR REPLACE FUNCTION public.bulk_update_mockup_approval_internal(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  UPDATE tarefa_mockups SET status = p_status, feedback = COALESCE(p_feedback, feedback), updated_at = now()
  WHERE tarefa_id = v_tarefa_id;
END;
$$;
