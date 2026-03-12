-- Update Concluído to ordem 3
UPDATE tarefas_colunas SET ordem = 3 WHERE id = 'f7f792d5-6b1e-489b-acc7-614559fd5248';

-- Insert Aguardando Aprovação at ordem 2
INSERT INTO tarefas_colunas (user_id, nome, cor, ordem)
VALUES ('56da997c-c4de-4b35-a4cb-f454c689086d', 'Aguardando Aprovação', '#8b5cf6', 2);
