ALTER TABLE public.avisos_reuniao ADD COLUMN horas_antes numeric DEFAULT 0;
ALTER TABLE public.avisos_reuniao ADD COLUMN minutos_antes integer DEFAULT 0;
ALTER TABLE public.avisos_reuniao ADD COLUMN unidade_tempo text DEFAULT 'dias';