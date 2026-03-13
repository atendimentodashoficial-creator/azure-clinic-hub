
ALTER TABLE public.tarefas 
  ADD COLUMN timer_inicio timestamptz,
  ADD COLUMN tempo_acumulado_segundos integer NOT NULL DEFAULT 0,
  ADD COLUMN timer_status text NOT NULL DEFAULT 'parado';
