-- Add Amazon affiliate URL to games table
ALTER TABLE public.games
ADD COLUMN amazon_affiliate_url text;

-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN stripe_connect_account_id text,
ADD COLUMN stripe_connect_onboarded boolean DEFAULT false;

-- Create tips table to track tip transactions
CREATE TABLE public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text,
  platform_fee integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on tips table
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Users can view tips they sent or received
CREATE POLICY "Users can view own tips"
ON public.tips
FOR SELECT
USING (
  auth.uid() = from_user_id OR 
  auth.uid() = to_user_id
);

-- Anyone authenticated can insert tips
CREATE POLICY "Authenticated users can create tips"
ON public.tips
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- Add index for better performance
CREATE INDEX idx_tips_game_id ON public.tips(game_id);
CREATE INDEX idx_tips_to_user_id ON public.tips(to_user_id);
CREATE INDEX idx_tips_from_user_id ON public.tips(from_user_id);