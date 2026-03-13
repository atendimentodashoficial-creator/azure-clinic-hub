
-- Update tarefas RLS to allow funcionarios to access admin's tasks
DROP POLICY "Users manage own tasks" ON public.tarefas;
CREATE POLICY "Users manage own or owner tasks" ON public.tarefas
  FOR ALL TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

-- Update tarefas_colunas RLS to allow funcionarios to access admin's columns
DROP POLICY "Users manage own task columns" ON public.tarefas_colunas;
CREATE POLICY "Users manage own or owner task columns" ON public.tarefas_colunas
  FOR ALL TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));
