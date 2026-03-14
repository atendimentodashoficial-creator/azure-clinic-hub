
-- Function to check if a user is a client that owns a task
CREATE OR REPLACE FUNCTION public.is_client_task(_user_id uuid, _tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tarefas t
    JOIN tarefas_clientes tc ON tc.id = t.cliente_id
    WHERE t.id = _tarefa_id
      AND tc.email = (SELECT email FROM auth.users WHERE id = _user_id)
  )
$$;

-- Allow clients to read grid posts for their tasks
CREATE POLICY "Clients can read own grid posts"
ON public.tarefa_grid_posts FOR SELECT TO authenticated
USING (public.is_client_task(auth.uid(), tarefa_id));

-- Allow clients to read mockups for their tasks
CREATE POLICY "Clients can read own mockups"
ON public.tarefa_mockups FOR SELECT TO authenticated
USING (public.is_client_task(auth.uid(), tarefa_id));

-- Allow clients to read links for their tasks
CREATE POLICY "Clients can read own links"
ON public.tarefa_links FOR SELECT TO authenticated
USING (public.is_client_task(auth.uid(), tarefa_id));

-- Allow clients to read highlights for their tasks
CREATE POLICY "Clients can read own highlights"
ON public.tarefa_grid_highlights FOR SELECT TO authenticated
USING (public.is_client_task(auth.uid(), tarefa_id));
