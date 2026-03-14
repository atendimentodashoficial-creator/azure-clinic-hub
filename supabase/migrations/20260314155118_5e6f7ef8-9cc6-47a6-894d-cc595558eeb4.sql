-- Fix RLS policy for tipos_tarefas to avoid auth.users access in policy expression
DROP POLICY IF EXISTS "Clients can read task types" ON public.tipos_tarefas;

CREATE POLICY "Clients can read task types"
ON public.tipos_tarefas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tarefas t
    JOIN public.tarefas_clientes tc ON tc.id = t.cliente_id
    WHERE t.user_id = tipos_tarefas.user_id
      AND lower(tc.email) = lower(auth.jwt() ->> 'email')
  )
);