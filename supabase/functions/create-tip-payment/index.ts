import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-TIP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { gameId, amount } = await req.json();
    if (!gameId || !amount || amount < 100) {
      throw new Error("Invalid gameId or amount (minimum $1.00)");
    }

    logStep("Request data", { gameId, amount });

    // Get game details and developer profile
    const { data: game, error: gameError } = await supabaseClient
      .from("games")
      .select("*, dev_x_handle")
      .eq("id", gameId)
      .single();

    if (gameError || !game) throw new Error("Game not found");
    logStep("Game found", { title: game.title });

    // Find developer profile by x_handle
    const { data: devProfile, error: devError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("x_handle", game.dev_x_handle)
      .single();

    if (devError || !devProfile) {
      throw new Error("Developer profile not found");
    }

    if (!devProfile.stripe_connect_account_id || !devProfile.stripe_connect_onboarded) {
      throw new Error("Developer has not completed Stripe Connect onboarding");
    }

    logStep("Developer found", { 
      devId: devProfile.id, 
      connectAccountId: devProfile.stripe_connect_account_id 
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // 10% platform fee
    const platformFee = Math.floor(amount * 0.1);
    const developerAmount = amount - platformFee;

    logStep("Calculated fees", { amount, platformFee, developerAmount });

    // Create payment intent with application fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      application_fee_amount: platformFee,
      transfer_data: {
        destination: devProfile.stripe_connect_account_id,
      },
      metadata: {
        game_id: gameId,
        from_user_id: user.id,
        to_user_id: devProfile.id,
      },
    });

    logStep("Payment intent created", { paymentIntentId: paymentIntent.id });

    // Record tip in database
    const { error: tipError } = await supabaseClient.from("tips").insert({
      game_id: gameId,
      from_user_id: user.id,
      to_user_id: devProfile.id,
      amount,
      currency: "usd",
      stripe_payment_intent_id: paymentIntent.id,
      platform_fee: platformFee,
    });

    if (tipError) {
      logStep("Error recording tip", { error: tipError.message });
    } else {
      logStep("Tip recorded successfully");
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
