
-- Update escalas_profissionais SELECT policy
DROP POLICY IF EXISTS "Users can view own escalas" ON public.escalas_profissionais;
CREATE POLICY "Users can view own escalas"
  ON public.escalas_profissionais FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update ausencias_profissionais SELECT policy
DROP POLICY IF EXISTS "Users can view own ausencias" ON public.ausencias_profissionais;
CREATE POLICY "Users can view own ausencias"
  ON public.ausencias_profissionais FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update tipo_agendamento_custom SELECT policy
DROP POLICY IF EXISTS "Users can view own tipos" ON public.tipo_agendamento_custom;
CREATE POLICY "Users can view own tipos"
  ON public.tipo_agendamento_custom FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));

-- Update reunioes SELECT policy to use unified function
DROP POLICY IF EXISTS "Users can view own and member reunioes" ON public.reunioes;
CREATE POLICY "Users can view own and member reunioes"
  ON public.reunioes FOR SELECT
  USING (public.can_access_owner_data(auth.uid(), user_id));
