
CREATE OR REPLACE FUNCTION public.get_mockups_by_approval_token(p_token text)
 RETURNS TABLE(mockup_id uuid, tarefa_id uuid, ordem integer, subtitulo text, titulo text, legenda text, cta text, status text, feedback text, tarefa_titulo text, cliente_nome text, cliente_empresa text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND m.status <> 'aprovado'
  ORDER BY m.ordem;
END;
$function$;
