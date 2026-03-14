
-- Add produto_template_id to tarefas to track which product originated the task
ALTER TABLE public.tarefas 
ADD COLUMN produto_template_id uuid REFERENCES public.produto_templates(id) ON DELETE SET NULL;

-- Allow clients to read product templates linked to their tasks
CREATE POLICY "Clients can read own product templates"
ON public.produto_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tarefas t
    JOIN public.tarefas_clientes tc ON tc.id = t.cliente_id
    WHERE t.produto_template_id = produto_templates.id
      AND lower(tc.email) = lower(auth.jwt() ->> 'email')
  )
);
