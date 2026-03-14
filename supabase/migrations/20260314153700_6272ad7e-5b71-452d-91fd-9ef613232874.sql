
-- Allow clients to read their own record from tarefas_clientes by matching email
CREATE POLICY "Clients can read own client record"
ON public.tarefas_clientes
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(auth.jwt() ->> 'email')
);
