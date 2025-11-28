-- Add monetization fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_pro_dev BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Add boost tracking to games table
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS boost_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS boost_priority INTEGER DEFAULT 0;

-- Create transactions table for revenue tracking
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'boost')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create affiliate clicks tracking table
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_type TEXT NOT NULL CHECK (store_type IN ('steam', 'itchio')),
  clicked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  referrer_url TEXT,
  user_agent TEXT
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Enable RLS on affiliate_clicks
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Devs can view clicks on their games
CREATE POLICY "Devs can view clicks on their games"
ON public.affiliate_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = affiliate_clicks.game_id
    AND games.dev_x_handle IN (
      SELECT x_handle FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Anyone can insert clicks (tracked before auth potentially)
CREATE POLICY "Anyone can insert affiliate clicks"
ON public.affiliate_clicks
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_game_id ON public.affiliate_clicks(game_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user_id ON public.affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_games_boost_ends_at ON public.games(boost_ends_at) WHERE boost_ends_at IS NOT NULL;