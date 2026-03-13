-- Allow funcionários to read their own tarefas_membros record (matched by auth_user_id)
CREATE POLICY "Funcionarios can read own member record"
ON public.tarefas_membros
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());