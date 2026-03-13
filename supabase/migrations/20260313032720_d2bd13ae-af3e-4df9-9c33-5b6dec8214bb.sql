
-- Allow employees to insert agendamentos for their admin
DROP POLICY IF EXISTS "Users can insert own agendamentos" ON public.agendamentos;
CREATE POLICY "Users can insert own agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

-- Allow employees to update agendamentos of their admin
DROP POLICY IF EXISTS "Users can update own agendamentos" ON public.agendamentos;
CREATE POLICY "Users can update own agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Allow employees to delete agendamentos of their admin
DROP POLICY IF EXISTS "Users can delete own agendamentos" ON public.agendamentos;
CREATE POLICY "Users can delete own agendamentos"
  ON public.agendamentos FOR DELETE
  USING (public.can_access_owner_data(auth.uid(), user_id));
