
-- Create revision history table
CREATE TABLE public.tarefa_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE NOT NULL,
  mockup_id uuid REFERENCES public.tarefa_mockups(id) ON DELETE CASCADE,
  slide_ordem integer,
  feedback text,
  status text NOT NULL DEFAULT 'reprovado',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_revisoes ENABLE ROW LEVEL SECURITY;

-- Allow public read via RPC (SECURITY DEFINER functions bypass RLS)
-- Allow authenticated users to read their own task revisions
CREATE POLICY "Users can read own task revisions"
  ON public.tarefa_revisoes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_revisoes.tarefa_id
      AND public.can_access_owner_data(auth.uid(), t.user_id)
    )
  );

-- Update the RPC to also log revision history
CREATE OR REPLACE FUNCTION public.update_mockup_approval(p_token text, p_mockup_id uuid, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_slide_ordem integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Get slide ordem before updating
  SELECT ordem INTO v_slide_ordem
  FROM tarefa_mockups
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  UPDATE tarefa_mockups
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_mockup_id AND tarefa_id = v_tarefa_id;

  -- Log revision history
  INSERT INTO tarefa_revisoes (tarefa_id, mockup_id, slide_ordem, feedback, status)
  VALUES (v_tarefa_id, p_mockup_id, v_slide_ordem, p_feedback, p_status);

  -- If rejected, move task to "Em Revisão" column
  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão'
    LIMIT 1;

    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_revisao_coluna_id, updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;
END;
$function$;
