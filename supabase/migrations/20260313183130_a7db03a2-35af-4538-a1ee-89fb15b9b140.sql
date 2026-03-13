-- Update update_mockup_approval function to move task to Concluído when all mockups are approved
CREATE OR REPLACE FUNCTION public.update_mockup_approval(p_token text, p_mockup_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_concluido_coluna_id uuid;
  v_slide_ordem integer;
  v_total_mockups integer;
  v_aprovados_mockups integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Get slide ordem before updating
  SELECT ordem INTO v_slide_ordem
  FROM tarefa_mockups
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  UPDATE tarefa_mockups
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  -- Log revision history
  INSERT INTO tarefa_revisoes (tarefa_id, mockup_id, slide_ordem, feedback, status)
  VALUES (v_tarefa_id, p_mockup_id, v_slide_ordem, p_feedback, p_status);

  -- If rejected, move task to "Em Revisão" column
  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão'
    LIMIT 1;

    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_revisao_coluna_id, updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;

  -- Check if all mockups are now approved
  SELECT COUNT(*) INTO v_total_mockups
  FROM tarefa_mockups
  WHERE tarefa_id = v_tarefa_id;

  SELECT COUNT(*) INTO v_aprovados_mockups
  FROM tarefa_mockups
  WHERE tarefa_id = v_tarefa_id AND status = 'aprovado';

  -- If all mockups are approved, move to Concluído
  IF v_total_mockups > 0 AND v_total_mockups = v_aprovados_mockups THEN
    SELECT id INTO v_concluido_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Concluído'
    LIMIT 1;

    IF v_concluido_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_concluido_coluna_id, updated_at = now(), approval_status = 'concluido'
      WHERE id = v_tarefa_id;
    END IF;
  END IF;
END;
$function$;