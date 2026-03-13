
-- Function to check if a funcionario owns a membro (by email match)
CREATE OR REPLACE FUNCTION public.is_own_membro(_user_id uuid, _membro_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tarefas_membros
    WHERE id = _membro_id
      AND email = (SELECT email FROM auth.users WHERE id = _user_id)
  )
$$;

-- Allow funcionarios to read their own escalas
CREATE POLICY "Funcionarios can read own escalas" ON public.escalas_membros
  FOR SELECT TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));

-- Allow funcionarios to insert their own escalas
CREATE POLICY "Funcionarios can insert own escalas" ON public.escalas_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.is_own_membro(auth.uid(), membro_id));

-- Allow funcionarios to update their own escalas
CREATE POLICY "Funcionarios can update own escalas" ON public.escalas_membros
  FOR UPDATE TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));

-- Allow funcionarios to delete their own escalas
CREATE POLICY "Funcionarios can delete own escalas" ON public.escalas_membros
  FOR DELETE TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));

-- Same for ausencias_membros
CREATE POLICY "Funcionarios can read own ausencias" ON public.ausencias_membros
  FOR SELECT TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));

CREATE POLICY "Funcionarios can insert own ausencias" ON public.ausencias_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.is_own_membro(auth.uid(), membro_id));

CREATE POLICY "Funcionarios can update own ausencias" ON public.ausencias_membros
  FOR UPDATE TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));

CREATE POLICY "Funcionarios can delete own ausencias" ON public.ausencias_membros
  FOR DELETE TO authenticated
  USING (public.is_own_membro(auth.uid(), membro_id));
