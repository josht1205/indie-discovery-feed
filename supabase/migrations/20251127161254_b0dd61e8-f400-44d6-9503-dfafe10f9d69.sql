-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL DEFAULT 'player' CHECK (user_type IN ('player', 'dev')),
  display_name TEXT,
  x_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hook_text TEXT NOT NULL,
  trailer_url TEXT NOT NULL,
  steam_url TEXT,
  itchio_url TEXT,
  tags TEXT[] DEFAULT '{}',
  dev_x_handle TEXT,
  upvotes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved games"
  ON public.games FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Devs can insert games (goes to moderation)"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create game interactions table
CREATE TABLE public.game_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('upvote', 'wishlist', 'buy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id, action)
);

ALTER TABLE public.game_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interactions"
  ON public.game_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON public.game_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions"
  ON public.game_interactions FOR DELETE
  USING (auth.uid() = user_id);

-- Create dev claims table
CREATE TABLE public.dev_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dev_x_handle TEXT,
  game_title TEXT NOT NULL,
  steam_url TEXT,
  itchio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dev_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can view own claims"
  ON public.dev_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Devs can submit claims"
  ON public.dev_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type, display_name)
  VALUES (NEW.id, 'player', COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update game upvotes count trigger (fixed)
CREATE OR REPLACE FUNCTION public.update_game_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.action = 'upvote' THEN
    UPDATE public.games 
    SET upvotes = upvotes + 1 
    WHERE id = NEW.game_id;
  ELSIF TG_OP = 'DELETE' AND OLD.action = 'upvote' THEN
    UPDATE public.games 
    SET upvotes = upvotes - 1 
    WHERE id = OLD.game_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_game_interaction_upvote
  AFTER INSERT OR DELETE ON public.game_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_upvotes();