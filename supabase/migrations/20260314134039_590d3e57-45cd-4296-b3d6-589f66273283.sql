CREATE OR REPLACE FUNCTION public.reorder_grid_posts(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
BEGIN
  -- First pass: move all to temp positions to avoid unique constraint
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE tarefa_grid_posts
    SET posicao = 1000 + (item->>'posicao')::int, updated_at = now()
    WHERE id = (item->>'id')::uuid;
  END LOOP;

  -- Second pass: set final positions
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE tarefa_grid_posts
    SET posicao = (item->>'posicao')::int, updated_at = now()
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_grid_highlights(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE tarefa_grid_highlights
    SET ordem = 1000 + (item->>'ordem')::int, updated_at = now()
    WHERE id = (item->>'id')::uuid;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE tarefa_grid_highlights
    SET ordem = (item->>'ordem')::int, updated_at = now()
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;