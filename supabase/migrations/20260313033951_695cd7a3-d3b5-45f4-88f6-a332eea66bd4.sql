
-- Allow employees to see all team members of their admin
DROP POLICY IF EXISTS "Users can manage their own team members" ON public.tarefas_membros;
CREATE POLICY "Users can manage their own team members"
  ON public.tarefas_membros FOR ALL
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Keep existing policy for funcionarios reading own record (redundant now but safe)
-- Update escalas_membros to allow employees to see all escalas of their admin's members
DROP POLICY IF EXISTS "Users can manage own escalas" ON public.escalas_membros;
CREATE POLICY "Users can manage own escalas"
  ON public.escalas_membros FOR ALL
  USING (public.can_access_owner_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Funcionarios can read own escalas" ON public.escalas_membros;

-- Update ausencias_membros similarly
DROP POLICY IF EXISTS "Users can manage own ausencias" ON public.ausencias_membros;
CREATE POLICY "Users can manage own ausencias"
  ON public.ausencias_membros FOR ALL
  USING (public.can_access_owner_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Funcionarios can read own ausencias" ON public.ausencias_membros;
