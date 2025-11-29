import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const accountId = profile.stripe_connect_account_id;

    if (!accountId) {
      logStep("No Stripe Connect account found");
      return new Response(
        JSON.stringify({ 
          onboarded: false, 
          charges_enabled: false,
          payouts_enabled: false 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Found Stripe Connect account", { accountId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);

    const onboarded = account.charges_enabled && account.payouts_enabled;

    logStep("Account status retrieved", {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarded,
    });

    // Update profile if onboarding status changed
    if (onboarded !== profile.stripe_connect_onboarded) {
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ stripe_connect_onboarded: onboarded })
        .eq("id", user.id);

      if (updateError) {
        logStep("Error updating profile", { error: updateError.message });
      } else {
        logStep("Profile updated with onboarding status");
      }
    }

    return new Response(
      JSON.stringify({
        onboarded,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      }),
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
