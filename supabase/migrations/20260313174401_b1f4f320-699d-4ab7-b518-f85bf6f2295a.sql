
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
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_mockups
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

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
END;
$function$;
