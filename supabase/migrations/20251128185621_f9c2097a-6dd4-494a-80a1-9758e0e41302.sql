-- Fix search_path for set_featured_at function
CREATE OR REPLACE FUNCTION public.set_featured_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.featured_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;