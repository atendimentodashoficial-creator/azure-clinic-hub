ALTER TABLE public.tarefas_membros
  ADD COLUMN senha TEXT,
  ADD COLUMN salario NUMERIC,
  ADD COLUMN data_contratacao DATE,
  ADD COLUMN dia_pagamento INTEGER;