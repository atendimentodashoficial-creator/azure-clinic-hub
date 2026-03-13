
CREATE OR REPLACE FUNCTION public.cascade_membro_nome_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.nome IS DISTINCT FROM NEW.nome THEN
    -- Update tarefas where responsavel_nome contains the old name
    UPDATE public.tarefas
    SET responsavel_nome = regexp_replace(responsavel_nome, '(^|, )' || regexp_replace(OLD.nome, '([.\\*+?^${}()|[\]])', '\\\1', 'g') || '($|, )', '\1' || NEW.nome || '\2', 'g')
    WHERE responsavel_nome LIKE '%' || OLD.nome || '%'
      AND user_id = OLD.user_id;

    -- Update comissoes
    UPDATE public.comissoes
    SET membro_nome = NEW.nome
    WHERE membro_nome = OLD.nome
      AND user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_membro_nome
AFTER UPDATE OF nome ON public.tarefas_membros
FOR EACH ROW
EXECUTE FUNCTION public.cascade_membro_nome_update();
