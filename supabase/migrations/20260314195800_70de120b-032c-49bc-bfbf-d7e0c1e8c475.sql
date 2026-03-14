
-- Add exige_aprovacao_interna to tipos_tarefas
ALTER TABLE tipos_tarefas ADD COLUMN IF NOT EXISTS exige_aprovacao_interna boolean DEFAULT false;

-- Add gestor_id to tarefas_clientes
ALTER TABLE tarefas_clientes ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES tarefas_membros(id) ON DELETE SET NULL;

-- Add internal approval fields to tarefas
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS aprovacao_interna_status text DEFAULT null;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS aprovacao_interna_por text DEFAULT null;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS aprovacao_interna_feedback text DEFAULT null;

-- Rename "Aguardando Aprovação" to "Aprovação Cliente"
UPDATE tarefas_colunas SET nome = 'Aprovação Cliente' WHERE nome = 'Aguardando Aprovação';

-- Shift ordem of existing columns with ordem >= 2 to make room
UPDATE tarefas_colunas SET ordem = ordem + 1 WHERE ordem >= 2;

-- Insert "Aprovação Interna" column for each user at ordem 2
INSERT INTO tarefas_colunas (user_id, nome, cor, ordem)
SELECT DISTINCT user_id, 'Aprovação Interna', '#f97316', 2
FROM tarefas_colunas tc
WHERE NOT EXISTS (
  SELECT 1 FROM tarefas_colunas tc2
  WHERE tc2.user_id = tc.user_id
  AND tc2.nome = 'Aprovação Interna'
);
