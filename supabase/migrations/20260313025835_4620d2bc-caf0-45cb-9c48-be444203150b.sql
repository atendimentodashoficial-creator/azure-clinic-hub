DROP POLICY IF EXISTS "Users can view their own reunioes" ON public.reunioes;

CREATE POLICY "Users can view own and member reunioes" ON public.reunioes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR user_id IN (
    SELECT auth_user_id FROM public.tarefas_membros
    WHERE tarefas_membros.user_id = auth.uid()
    AND auth_user_id IS NOT NULL
  )
);