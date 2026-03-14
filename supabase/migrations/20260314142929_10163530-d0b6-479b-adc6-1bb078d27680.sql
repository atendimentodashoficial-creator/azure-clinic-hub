
-- Allow clients to read tasks assigned to them
CREATE POLICY "Clients can read own tasks"
ON public.tarefas
FOR SELECT
TO authenticated
USING (
  cliente_id IN (
    SELECT id FROM public.tarefas_clientes 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Allow clients to read task columns (needed for joins)
CREATE POLICY "Clients can read task columns"
ON public.tarefas_colunas
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM public.tarefas 
    WHERE cliente_id IN (
      SELECT id FROM public.tarefas_clientes 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    LIMIT 1
  )
);

-- Allow clients to read task types (needed for joins)
CREATE POLICY "Clients can read task types"
ON public.tipos_tarefas
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM public.tarefas 
    WHERE cliente_id IN (
      SELECT id FROM public.tarefas_clientes 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    LIMIT 1
  )
);
