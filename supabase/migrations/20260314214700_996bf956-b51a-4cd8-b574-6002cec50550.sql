
-- Add internal_approval_token column
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS internal_approval_token text;

-- RPC: get task by internal approval token
CREATE OR REPLACE FUNCTION public.get_task_by_internal_approval_token(p_token text)
RETURNS TABLE(tarefa_id uuid, tarefa_titulo text, cliente_nome text, cliente_empresa text, approval_status text, cliente_instagram text, cliente_foto_perfil_url text, aprovacao_interna_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tarefa_id,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa,
    COALESCE(t.approval_status, 'pendente') as approval_status,
    COALESCE(tc.instagram, '') as cliente_instagram,
    tc.foto_perfil_url as cliente_foto_perfil_url,
    COALESCE(t.aprovacao_interna_status, 'pendente') as aprovacao_interna_status
  FROM tarefas t
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE t.internal_approval_token = p_token;
END;
$$;

-- RPC: get mockups by internal approval token
CREATE OR REPLACE FUNCTION public.get_mockups_by_internal_token(p_token text)
RETURNS TABLE(mockup_id uuid, tarefa_id uuid, ordem integer, post_index integer, subtitulo text, titulo text, legenda text, cta text, status text, feedback text, tarefa_titulo text, cliente_nome text, cliente_empresa text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  RETURN QUERY
  SELECT m.id, m.tarefa_id, m.ordem, m.post_index, m.subtitulo, m.titulo, m.legenda, m.cta, m.status, m.feedback,
    t.titulo as tarefa_titulo, COALESCE(tc.nome,'') as cliente_nome, COALESCE(tc.empresa,'') as cliente_empresa
  FROM tarefa_mockups m JOIN tarefas t ON t.id = m.tarefa_id LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE m.tarefa_id = v_tarefa_id ORDER BY m.post_index, m.ordem;
END;
$$;

-- RPC: get links by internal approval token
CREATE OR REPLACE FUNCTION public.get_links_by_internal_token(p_token text)
RETURNS TABLE(url text, titulo text, ordem integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT l.url, l.titulo, l.ordem FROM tarefa_links l WHERE l.tarefa_id = v_tarefa_id ORDER BY l.ordem;
END;
$$;

-- RPC: get grid posts by internal approval token
CREATE OR REPLACE FUNCTION public.get_grid_posts_by_internal_token(p_token text)
RETURNS TABLE(grid_post_id uuid, tarefa_id uuid, posicao integer, image_url text, status text, feedback text, tarefa_titulo text, cliente_nome text, cliente_empresa text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  RETURN QUERY
  SELECT g.id, g.tarefa_id, g.posicao, g.image_url, g.status, g.feedback,
    t.titulo as tarefa_titulo, COALESCE(tc.nome,'') as cliente_nome, COALESCE(tc.empresa,'') as cliente_empresa
  FROM tarefa_grid_posts g JOIN tarefas t ON t.id = g.tarefa_id LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE g.tarefa_id = v_tarefa_id ORDER BY g.posicao;
END;
$$;

-- RPC: get grid highlights by internal approval token
CREATE OR REPLACE FUNCTION public.get_grid_highlights_by_internal_token(p_token text)
RETURNS TABLE(highlight_id uuid, tarefa_id uuid, ordem integer, titulo text, image_url text, status text, feedback text, tarefa_titulo text, cliente_nome text, cliente_empresa text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id FROM tarefas t WHERE t.internal_approval_token = p_token;
  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  RETURN QUERY
  SELECT h.id, h.tarefa_id, h.ordem, h.titulo, h.image_url, h.status, h.feedback,
    t.titulo as tarefa_titulo, COALESCE(tc.nome,'') as cliente_nome, COALESCE(tc.empresa,'') as cliente_empresa
  FROM tarefa_grid_highlights h JOIN tarefas t ON t.id = h.tarefa_id LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE h.tarefa_id = v_tarefa_id ORDER BY h.ordem;
END;
$$;

-- RPC: handle internal approval action (approve/reject the whole task)
CREATE OR REPLACE FUNCTION public.handle_internal_approval(p_token text, p_status text, p_gestor_nome text, p_feedback text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_exige_aprovacao boolean;
  v_tipo_tarefa_id uuid;
BEGIN
  SELECT t.id, t.user_id, t.tipo_tarefa_id INTO v_tarefa_id, v_user_id, v_tipo_tarefa_id
  FROM tarefas t WHERE t.internal_approval_token = p_token;

  IF v_tarefa_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;

  -- Check if client approval is required
  SELECT COALESCE(tt.exige_aprovacao, false) INTO v_exige_aprovacao
  FROM tipos_tarefas tt WHERE tt.id = v_tipo_tarefa_id;

  IF p_status = 'aprovado' THEN
    UPDATE tarefas SET
      aprovacao_interna_status = 'aprovado',
      aprovacao_interna_por = p_gestor_nome,
      aprovacao_interna_feedback = p_feedback,
      updated_at = now()
    WHERE id = v_tarefa_id;
  ELSIF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;

    UPDATE tarefas SET
      aprovacao_interna_status = 'reprovado',
      aprovacao_interna_por = p_gestor_nome,
      aprovacao_interna_feedback = p_feedback,
      coluna_id = COALESCE(v_revisao_coluna_id, coluna_id),
      updated_at = now()
    WHERE id = v_tarefa_id;
  END IF;

  -- Log revision
  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status)
  VALUES (v_tarefa_id, p_feedback, 'interna_' || p_status);
END;
$$;
