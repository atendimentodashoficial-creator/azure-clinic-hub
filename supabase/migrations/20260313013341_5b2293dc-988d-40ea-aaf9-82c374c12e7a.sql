ALTER TABLE public.avisos_reuniao
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_posicao text DEFAULT 'antes';