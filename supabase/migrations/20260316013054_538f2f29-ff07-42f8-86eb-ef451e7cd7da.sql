CREATE POLICY "Funcionarios can read owner clients"
  ON public.tarefas_clientes
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_owner_data(auth.uid(), user_id)
  );