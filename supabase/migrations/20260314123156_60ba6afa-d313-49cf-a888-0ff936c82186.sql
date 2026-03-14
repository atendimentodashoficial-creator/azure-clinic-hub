
-- Table for Instagram grid posts (9 images per task)
CREATE TABLE public.tarefa_grid_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  posicao INTEGER NOT NULL CHECK (posicao BETWEEN 0 AND 8),
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, posicao)
);

-- Enable RLS
ALTER TABLE public.tarefa_grid_posts ENABLE ROW LEVEL SECURITY;

-- RLS: owner can do everything
CREATE POLICY "owner_all" ON public.tarefa_grid_posts
  FOR ALL TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id))
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

-- RLS: anon can read (for public approval page)
CREATE POLICY "anon_read" ON public.tarefa_grid_posts
  FOR SELECT TO anon
  USING (true);

-- Storage bucket for grid images
INSERT INTO storage.buckets (id, name, public)
VALUES ('tarefa-grid', 'tarefa-grid', true)
ON CONFLICT DO NOTHING;

-- Storage policy: authenticated users can upload
CREATE POLICY "auth_upload_grid" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tarefa-grid');

CREATE POLICY "auth_update_grid" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tarefa-grid');

CREATE POLICY "auth_delete_grid" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tarefa-grid');

CREATE POLICY "public_read_grid" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'tarefa-grid');

-- DB function to get grid posts by approval token
CREATE OR REPLACE FUNCTION public.get_grid_posts_by_approval_token(p_token text)
RETURNS TABLE(
  grid_post_id uuid,
  tarefa_id uuid,
  posicao integer,
  image_url text,
  status text,
  feedback text,
  tarefa_titulo text,
  cliente_nome text,
  cliente_empresa text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  SELECT t.id INTO v_tarefa_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  RETURN QUERY
  SELECT
    g.id as grid_post_id,
    g.tarefa_id,
    g.posicao,
    g.image_url,
    g.status,
    g.feedback,
    t.titulo as tarefa_titulo,
    COALESCE(tc.nome, '') as cliente_nome,
    COALESCE(tc.empresa, '') as cliente_empresa
  FROM tarefa_grid_posts g
  JOIN tarefas t ON t.id = g.tarefa_id
  LEFT JOIN tarefas_clientes tc ON tc.id = t.cliente_id
  WHERE g.tarefa_id = v_tarefa_id
  ORDER BY g.posicao;
END;
$$;

-- DB function to update grid post approval
CREATE OR REPLACE FUNCTION public.update_grid_post_approval(p_token text, p_grid_post_id uuid, p_status text, p_feedback text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tarefa_id uuid;
  v_user_id uuid;
  v_revisao_coluna_id uuid;
  v_concluido_coluna_id uuid;
  v_total integer;
  v_aprovados integer;
BEGIN
  SELECT t.id, t.user_id INTO v_tarefa_id, v_user_id
  FROM tarefas t
  WHERE t.approval_token = p_token;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  UPDATE tarefa_grid_posts
  SET status = p_status, feedback = p_feedback, updated_at = now()
  WHERE id = p_grid_post_id AND tarefa_id = v_tarefa_id;

  -- Log revision
  INSERT INTO tarefa_revisoes (tarefa_id, feedback, status)
  VALUES (v_tarefa_id, p_feedback, p_status);

  -- If rejected, move to Em Revisão
  IF p_status = 'reprovado' THEN
    SELECT id INTO v_revisao_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Em Revisão' LIMIT 1;

    IF v_revisao_coluna_id IS NOT NULL THEN
      UPDATE tarefas SET coluna_id = v_revisao_coluna_id, updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;

  -- Check if all approved
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'aprovado')
  INTO v_total, v_aprovados
  FROM tarefa_grid_posts WHERE tarefa_id = v_tarefa_id;

  IF v_total > 0 AND v_total = v_aprovados THEN
    SELECT id INTO v_concluido_coluna_id
    FROM tarefas_colunas
    WHERE user_id = v_user_id AND nome = 'Concluído' LIMIT 1;

    IF v_concluido_coluna_id IS NOT NULL THEN
      UPDATE tarefas
      SET coluna_id = v_concluido_coluna_id, approval_status = 'concluido', updated_at = now()
      WHERE id = v_tarefa_id;
    END IF;
  END IF;
END;
$$;
