import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { User, LogOut, Sparkles, DollarSign } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(false);

  useEffect(() => {
    fetchProfile();
    
    // Check if returning from Stripe onboarding
    if (searchParams.get("stripe_onboarded") === "true") {
      checkStripeStatus();
    }
  }, [searchParams]);

  const fetchProfile = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      navigate("/auth");
      return;
    }

    setUser(authUser);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || "");
      setXHandle(data.x_handle || "");
      setStripeOnboarded(data.stripe_connect_onboarded || false);
    }
  };

  const checkStripeStatus = async () => {
    setCheckingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-connect-status");
      
      if (error) throw error;
      
      if (data.onboarded) {
        setStripeOnboarded(true);
        toast.success("Stripe Connect setup complete! You can now receive tips.");
      } else {
        toast.error("Stripe onboarding incomplete. Please try again.");
      }
      
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to check Stripe status");
    } finally {
      setCheckingStripe(false);
    }
  };

  const handleStripeOnboarding = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboard-stripe-connect");
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Opening Stripe onboarding in a new tab...");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          x_handle: xHandle,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated!");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserType = async () => {
    const newType = profile.user_type === "player" ? "dev" : "player";
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ user_type: newType })
        .eq("id", user.id);

      if (error) throw error;
      toast.success(`Switched to ${newType} mode`);
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user || !profile) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <User className="h-12 w-12 text-primary mx-auto neon-pulse" />
            <h1 className="text-4xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your IndiePulse account</p>
          </div>

          <Card className="p-8 space-y-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Account Type</p>
                <p className="text-lg font-semibold capitalize">{profile.user_type}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleUserType}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Switch to {profile.user_type === "player" ? "Dev" : "Player"}
              </Button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="xHandle">X/Twitter Handle (optional)</Label>
                <Input
                  id="xHandle"
                  type="text"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value.replace("@", ""))}
                  placeholder="yourhandle"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>

            {profile.user_type === "dev" && (
              <div className="pt-6 border-t border-border space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/claim")}
                >
                  Claim or Submit a Game
                </Button>

                <div className="space-y-2">
                  {stripeOnboarded ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-green-500 text-sm">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">Stripe Connect Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can receive tips from players!
                      </p>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="default"
                        className="w-full bg-gradient-primary gap-2"
                        onClick={handleStripeOnboarding}
                        disabled={isLoading || checkingStripe}
                      >
                        <DollarSign className="h-4 w-4" />
                        {isLoading ? "Loading..." : "Enable Tipping (Stripe Connect)"}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Set up payouts to receive tips from your fans
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
