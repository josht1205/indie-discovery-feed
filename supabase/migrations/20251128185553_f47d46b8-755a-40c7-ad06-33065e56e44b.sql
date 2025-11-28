-- Add featured_at timestamp to track when games go live
ALTER TABLE public.games 
ADD COLUMN featured_at TIMESTAMP WITH TIME ZONE;

-- Add views counter for engagement tracking
ALTER TABLE public.games 
ADD COLUMN views INTEGER DEFAULT 0;

-- Set featured_at for existing approved games
UPDATE public.games 
SET featured_at = created_at 
WHERE status = 'approved' AND featured_at IS NULL;

-- Create function to auto-archive games based on hybrid rotation rules
CREATE OR REPLACE FUNCTION public.archive_stale_games()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Archive games older than 14 days
  UPDATE public.games
  SET status = 'archived'
  WHERE status = 'approved'
    AND featured_at IS NOT NULL
    AND featured_at < NOW() - INTERVAL '14 days';
  
  -- Archive games with low engagement after 7 days
  UPDATE public.games
  SET status = 'archived'
  WHERE status = 'approved'
    AND featured_at IS NOT NULL
    AND featured_at < NOW() - INTERVAL '7 days'
    AND upvotes < 10;
END;
$$;

-- Create trigger to set featured_at when game is approved
CREATE OR REPLACE FUNCTION public.set_featured_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    NEW.featured_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_approved
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.set_featured_at();