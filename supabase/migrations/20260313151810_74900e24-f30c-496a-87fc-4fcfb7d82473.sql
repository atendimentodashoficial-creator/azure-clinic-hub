
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own and member reunioes" ON public.reunioes;

-- Create new SELECT policy that allows:
-- 1. Users to see their own meetings
-- 2. Admin to see meetings of their team members
CREATE POLICY "Users can view own and team reunioes"
ON public.reunioes
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tarefas_membros
    WHERE tarefas_membros.auth_user_id = reunioes.user_id
      AND tarefas_membros.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.tarefas_membros
    WHERE tarefas_membros.auth_user_id = auth.uid()
      AND tarefas_membros.user_id = reunioes.user_id
  )
);

-- Also update UPDATE and DELETE policies for admin access
DROP POLICY IF EXISTS "Users can update their own reunioes" ON public.reunioes;
CREATE POLICY "Users can update own and team reunioes"
ON public.reunioes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tarefas_membros
    WHERE tarefas_membros.auth_user_id = reunioes.user_id
      AND tarefas_membros.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own reunioes" ON public.reunioes;
CREATE POLICY "Users can delete own and team reunioes"
ON public.reunioes
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tarefas_membros
    WHERE tarefas_membros.auth_user_id = reunioes.user_id
      AND tarefas_membros.user_id = auth.uid()
  )
);
