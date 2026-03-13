
CREATE OR REPLACE FUNCTION public.get_links_by_approval_token(p_token text)
RETURNS TABLE(url text, titulo text, ordem integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT l.url, l.titulo, l.ordem
  FROM tarefa_links l
  WHERE l.tarefa_id = v_tarefa_id
  ORDER BY l.ordem;
END;
$function$;
