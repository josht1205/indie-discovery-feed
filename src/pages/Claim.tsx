import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload } from "lucide-react";

const Claim = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    gameTitle: "",
    steamUrl: "",
    itchioUrl: "",
    devXHandle: "",
  });

  useEffect(() => {
    checkDevAccess();
  }, []);

  const checkDevAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!data || data.user_type !== "dev") {
      toast.error("Switch to Dev mode in your profile first");
      navigate("/profile");
      return;
    }

    setProfile(data);
    setFormData((prev) => ({ ...prev, devXHandle: data.x_handle || "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.from("dev_claims").insert({
        user_id: profile.id,
        game_title: formData.gameTitle,
        steam_url: formData.steamUrl || null,
        itchio_url: formData.itchioUrl || null,
        dev_x_handle: formData.devXHandle || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Claim submitted! We'll review it shortly.");
      navigate("/profile");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit claim");
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Upload className="h-12 w-12 text-primary mx-auto neon-pulse" />
            <h1 className="text-4xl font-bold">Claim Your Game</h1>
            <p className="text-muted-foreground">
              Submit your indie game to IndiePulse for community discovery
            </p>
          </div>

          <Card className="p-8 bg-card border-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="gameTitle">Game Title *</Label>
                <Input
                  id="gameTitle"
                  type="text"
                  value={formData.gameTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, gameTitle: e.target.value })
                  }
                  placeholder="Your Amazing Indie Game"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="steamUrl">Steam URL (optional)</Label>
                <Input
                  id="steamUrl"
                  type="url"
                  value={formData.steamUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, steamUrl: e.target.value })
                  }
                  placeholder="https://store.steampowered.com/app/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itchioUrl">itch.io URL (optional)</Label>
                <Input
                  id="itchioUrl"
                  type="url"
                  value={formData.itchioUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, itchioUrl: e.target.value })
                  }
                  placeholder="https://yourgame.itch.io/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="devXHandle">Your X/Twitter Handle (optional)</Label>
                <Input
                  id="devXHandle"
                  type="text"
                  value={formData.devXHandle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      devXHandle: e.target.value.replace("@", ""),
                    })
                  }
                  placeholder="yourhandle"
                />
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">What happens next?</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Your claim goes to our moderation queue</li>
                  <li>• We'll verify ownership and create your game page</li>
                  <li>• You'll be notified via email when it's live</li>
                  <li>• Track stats and engagement from your profile</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? "Submitting..." : "Submit Claim"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Claim;
