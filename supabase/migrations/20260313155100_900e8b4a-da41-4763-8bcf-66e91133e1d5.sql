CREATE OR REPLACE FUNCTION public.cascade_membro_nome_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.nome IS DISTINCT FROM NEW.nome THEN
    UPDATE public.tarefas t
    SET responsavel_nome = calc.novo_nome
    FROM LATERAL (
      SELECT
        string_agg(
          CASE
            WHEN btrim(parte) = OLD.nome THEN NEW.nome
            ELSE btrim(parte)
          END,
          ', '
        ) AS novo_nome,
        bool_or(btrim(parte) = OLD.nome) AS contem_antigo
      FROM unnest(string_to_array(COALESCE(t.responsavel_nome, ''), ',')) AS parte
    ) calc
    WHERE t.user_id = OLD.user_id
      AND COALESCE(t.responsavel_nome, '') <> ''
      AND calc.contem_antigo = true;

    UPDATE public.comissoes c
    SET membro_nome = NEW.nome
    WHERE c.user_id = OLD.user_id
      AND btrim(c.membro_nome) = OLD.nome;
  END IF;

  RETURN NEW;
END;
$function$;