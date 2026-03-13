
-- Drop the text-based overload that conflicts
DROP FUNCTION IF EXISTS public.get_mockups_by_approval_token(p_token text);
