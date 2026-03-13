
CREATE OR REPLACE FUNCTION public.update_task_approval_by_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_concluido_coluna_id uuid;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Update task approval status
  IF p_status = 'aprovado' THEN
    -- Move to Concluído
    SELECT id INTO v_concluido_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Concluído'
    LIMIT 1;

    UPDATE tarefas
    SET approval_status = 'concluido', updated_at = now(),
        coluna_id = COALESCE(v_concluido_coluna_id, coluna_id)
    WHERE id = v_tarefa_id;
  ELSIF p_status = 'reprovado' THEN
    -- Move to Em Revisão
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão'
    LIMIT 1;

    UPDATE tarefas
    SET approval_status = 'em_revisao', updated_at = now(),
        coluna_id = COALESCE(v_revisao_coluna_id, coluna_id)
    WHERE id = v_tarefa_id;
  END IF;

  -- Log revision
  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status)
  VALUES (v_tarefa_id, p_feedback, p_status);
END;
$function$;

-- Also create a function to get task info by token for link-only approval
CREATE OR REPLACE FUNCTION public.get_task_by_approval_token(p_token text)
RETURNS TABLE(tarefa_id uuid, tarefa_titulo text, cliente_nome text, cliente_empresa text, approval_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tarefa_id,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa,
    COALESCE(t.approval_status, 'pendente') as approval_status
  FROM tarefas t
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE t.approval_token = p_token;
END;
$function$;
