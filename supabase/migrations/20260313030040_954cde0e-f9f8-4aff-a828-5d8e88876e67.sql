ALTER TABLE public.avisos_reuniao
ADD COLUMN IF NOT EXISTS link_calendario_ativo boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS link_calendario_texto text NOT NULL DEFAULT '📅 Adicionar ao meu calendário';