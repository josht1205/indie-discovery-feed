import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    console.error('Missing signature or webhook secret');
    return new Response('Webhook error', { status: 400 });
  }

  try {
    const body = await req.text();
    
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    console.log('Webhook event received:', event.type);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const type = session.metadata?.type; // 'subscription' or 'boost'
      const gameId = session.metadata?.game_id;

      if (!userId || !type) {
        console.error('Missing metadata in session');
        return new Response('Missing metadata', { status: 400 });
      }

      // Log transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: type,
          amount: (session.amount_total || 0) / 100, // Convert cents to dollars
          currency: session.currency?.toUpperCase() || 'USD',
          status: 'completed',
          stripe_payment_id: session.payment_intent as string,
          metadata: {
            game_id: gameId,
            session_id: session.id,
          },
        });

      if (transactionError) {
        console.error('Error logging transaction:', transactionError);
      }

      // Update user or game based on type
      if (type === 'subscription') {
        // Set dev as pro for 30 days
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_pro_dev: true,
            subscription_ends_at: subscriptionEndDate.toISOString(),
          })
          .eq('id', userId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        } else {
          console.log('Dev subscription activated for user:', userId);
        }
      } else if (type === 'boost' && gameId) {
        // Set game boost for 24 hours
        const boostEndDate = new Date();
        boostEndDate.setDate(boostEndDate.getDate() + 1);

        const { error: gameError } = await supabase
          .from('games')
          .update({
            boost_ends_at: boostEndDate.toISOString(),
            boost_priority: 100,
          })
          .eq('id', gameId);

        if (gameError) {
          console.error('Error updating game boost:', gameError);
        } else {
          console.log('Game boost activated for game:', gameId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
