import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap, Crown, TrendingUp, BarChart3 } from "lucide-react";
import { Navigation } from "@/components/Navigation";

const DevPricing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      // Create Stripe checkout session
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'success_url': `${window.location.origin}/profile?subscription=success`,
          'cancel_url': `${window.location.origin}/dev-pricing`,
          'mode': 'payment',
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][product_data][name]': 'Dev Pro - Monthly Subscription',
          'line_items[0][price_data][unit_amount]': '2000', // $20 in cents
          'line_items[0][quantity]': '1',
          'metadata[user_id]': user.id,
          'metadata[type]': 'subscription',
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error("Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Developer Pricing</h1>
          <p className="text-muted-foreground text-lg">
            Boost your game's visibility and grow your player base
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Free Plan */}
          <Card className="p-6 border-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Free</h2>
            </div>
            <div className="text-3xl font-bold mb-6">
              $0<span className="text-lg text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Submit games for approval</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Basic analytics (views, upvotes)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Organic feed placement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Affiliate link tracking</span>
              </li>
            </ul>
            <Button variant="outline" className="w-full" onClick={() => navigate("/claim")}>
              Get Started Free
            </Button>
          </Card>

          {/* Pro Plan */}
          <Card className="p-6 border-2 border-primary relative">
            <Badge className="absolute top-4 right-4">Most Popular</Badge>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Dev Pro</h2>
            </div>
            <div className="text-3xl font-bold mb-6">
              $20<span className="text-lg text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Everything in Free</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-semibold">Priority feed placement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-semibold">Advanced analytics dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-semibold">See who's promoting your game</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span className="font-semibold">Verified developer badge</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>24-hour game boosts (1 per month)</span>
              </li>
            </ul>
            <Button 
              className="w-full" 
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? "Processing..." : "Subscribe Now"}
            </Button>
          </Card>
        </div>

        {/* One-Time Boost */}
        <Card className="p-8 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">One-Time Game Boost</h3>
              <p className="text-muted-foreground mb-4">
                Need extra visibility for a launch or sale? Get your game featured at the top of the feed for 24 hours.
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-bold">$5</div>
                <span className="text-muted-foreground">per 24-hour boost</span>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Guaranteed top feed placement</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>10x visibility increase</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Available for any game</span>
                </li>
              </ul>
              <Button onClick={() => navigate("/claim")}>
                Boost Your Game
              </Button>
            </div>
          </div>
        </Card>

        {/* Analytics Preview */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <BarChart3 className="w-5 h-5" />
            <span className="font-semibold">Developer Analytics</span>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Track every click, share, and conversion. See exactly who's driving traffic to your game and measure your ROI with detailed analytics.
          </p>
        </div>
      </main>
    </div>
  );
};

export default DevPricing;
