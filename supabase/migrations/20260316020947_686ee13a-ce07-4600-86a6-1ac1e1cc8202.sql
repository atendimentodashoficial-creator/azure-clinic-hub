
ALTER TABLE public.tarefas_clientes 
  ADD COLUMN IF NOT EXISTS contrato_url text,
  ADD COLUMN IF NOT EXISTS valor_contrato numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS data_inicio_contrato date DEFAULT null;
