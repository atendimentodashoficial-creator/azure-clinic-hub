
-- Create tipos_reuniao table
CREATE TABLE public.tipos_reuniao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for tipos_reuniao <-> tarefas_membros
CREATE TABLE public.tipos_reuniao_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_reuniao_id UUID NOT NULL REFERENCES public.tipos_reuniao(id) ON DELETE CASCADE,
  membro_id UUID NOT NULL REFERENCES public.tarefas_membros(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tipo_reuniao_id, membro_id)
);

-- Add tipo_reuniao_id to produto_templates
ALTER TABLE public.produto_templates ADD COLUMN tipo_reuniao_id UUID REFERENCES public.tipos_reuniao(id) ON DELETE SET NULL;

-- Add tipo_reuniao_id to reunioes
ALTER TABLE public.reunioes ADD COLUMN tipo_reuniao_id UUID REFERENCES public.tipos_reuniao(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.tipos_reuniao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_reuniao_membros ENABLE ROW LEVEL SECURITY;

-- RLS policies for tipos_reuniao
CREATE POLICY "Users can manage their own tipos_reuniao"
ON public.tipos_reuniao FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.can_access_owner_data(auth.uid(), user_id))
WITH CHECK (user_id = auth.uid() OR public.can_access_owner_data(auth.uid(), user_id));

-- RLS policies for tipos_reuniao_membros (via join to tipos_reuniao)
CREATE POLICY "Users can manage tipos_reuniao_membros via parent"
ON public.tipos_reuniao_membros FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tipos_reuniao t
    WHERE t.id = tipo_reuniao_id
    AND (t.user_id = auth.uid() OR public.can_access_owner_data(auth.uid(), t.user_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tipos_reuniao t
    WHERE t.id = tipo_reuniao_id
    AND (t.user_id = auth.uid() OR public.can_access_owner_data(auth.uid(), t.user_id))
  )
);
