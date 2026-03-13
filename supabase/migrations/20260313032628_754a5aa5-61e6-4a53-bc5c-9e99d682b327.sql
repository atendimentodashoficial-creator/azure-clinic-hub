
-- Function to get the admin's user_id for a funcionario
-- Returns the admin's id if the caller is a funcionario, or the caller's own id otherwise
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT user_id FROM public.tarefas_membros WHERE auth_user_id = _user_id LIMIT 1),
    _user_id
  )
$$;

-- Function to check if user can access a given owner's data
CREATE OR REPLACE FUNCTION public.can_access_owner_data(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _owner_id
    OR EXISTS (
      SELECT 1 FROM public.tarefas_membros
      WHERE auth_user_id = _user_id AND user_id = _owner_id
    )
$$;

-- Update agendamentos SELECT policy
DROP POLICY IF EXISTS "Users can view own agendamentos" ON public.agendamentos;
CREATE POLICY "Users can view own agendamentos"
  ON public.agendamentos FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update leads SELECT policy
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads"
  ON public.leads FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id) AND deleted_at IS NULL);

-- Update profissionais SELECT policy
DROP POLICY IF EXISTS "Users can view own profissionais" ON public.profissionais;
CREATE POLICY "Users can view own profissionais"
  ON public.profissionais FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update procedimentos SELECT policy
DROP POLICY IF EXISTS "Users can view own procedimentos" ON public.procedimentos;
CREATE POLICY "Users can view own procedimentos"
  ON public.procedimentos FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update faturas SELECT policy
DROP POLICY IF EXISTS "Users can view own faturas" ON public.faturas;
CREATE POLICY "Users can view own faturas"
  ON public.faturas FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));
