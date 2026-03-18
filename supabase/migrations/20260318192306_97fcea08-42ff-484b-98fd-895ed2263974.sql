ALTER TABLE public.disparos_instancias 
  ADD COLUMN IF NOT EXISTS n8n_sdr_workflow_id text,
  ADD COLUMN IF NOT EXISTS n8n_followup_workflow_id text,
  ADD COLUMN IF NOT EXISTS n8n_table_name text,
  ADD COLUMN IF NOT EXISTS n8n_setup_at timestamptz;