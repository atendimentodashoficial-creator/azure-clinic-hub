-- Produtos com templates de tarefas
CREATE TABLE public.produto_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own produto_templates"
  ON public.produto_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tarefas template vinculadas a um produto
CREATE TABLE public.produto_template_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_template_id uuid NOT NULL REFERENCES public.produto_templates(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_template_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own produto_template_tarefas"
  ON public.produto_template_tarefas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.produto_templates pt
      WHERE pt.id = produto_template_id AND pt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.produto_templates pt
      WHERE pt.id = produto_template_id AND pt.user_id = auth.uid()
    )
  );
