DROP FUNCTION IF EXISTS public.get_task_by_approval_token(text);

CREATE OR REPLACE FUNCTION public.get_task_by_approval_token(p_token text)
 RETURNS TABLE(tarefa_id uuid, tarefa_titulo text, cliente_nome text, cliente_empresa text, approval_status text, cliente_instagram text, cliente_foto_perfil_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tarefa_id,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa,
    COALESCE(t.approval_status, 'pendente') as approval_status,
    COALESCE(tc.instagram, '') as cliente_instagram,
    tc.foto_perfil_url as cliente_foto_perfil_url
  FROM tarefas t
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE t.approval_token = p_token;
END;
$function$;