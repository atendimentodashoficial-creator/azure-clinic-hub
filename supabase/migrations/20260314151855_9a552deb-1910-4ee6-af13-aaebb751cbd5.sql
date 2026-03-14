-- Fix client policies to avoid direct access to auth.users (which can break admin queries)
DROP POLICY IF EXISTS "Clients can read own tasks" ON public.tarefas;
CREATE POLICY "Clients can read own tasks"
ON public.tarefas
FOR SELECT
TO authenticated
USING (
  COALESCE(auth.jwt() ->> 'email', '') <> ''
  AND EXISTS (
    SELECT 1
    FROM public.tarefas_clientes tc
    WHERE tc.id = tarefas.cliente_id
      AND lower(tc.email) = lower(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Clients can read task columns" ON public.tarefas_colunas;
CREATE POLICY "Clients can read task columns"
ON public.tarefas_colunas
FOR SELECT
TO authenticated
USING (
  COALESCE(auth.jwt() ->> 'email', '') <> ''
  AND EXISTS (
    SELECT 1
    FROM public.tarefas t
    JOIN public.tarefas_clientes tc ON tc.id = t.cliente_id
    WHERE t.user_id = tarefas_colunas.user_id
      AND lower(tc.email) = lower(auth.jwt() ->> 'email')
  )
);