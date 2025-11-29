import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Heart, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Rising = () => {
  const [games, setGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRisingGames();
  }, []);

  const fetchRisingGames = async () => {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("id, title, description, hook_text, trailer_url, steam_url, itchio_url, amazon_affiliate_url, tags, dev_x_handle, upvotes, views")
        .eq("status", "approved")
        .order("upvotes", { ascending: false })
        .limit(20);

      if (error) throw error;
      setGames(data || []);
    } catch (error: any) {
      toast.error("Failed to load rising games");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Trophy className="h-12 w-12 text-primary mx-auto neon-pulse" />
            <h1 className="text-4xl font-bold">Rising Stars</h1>
            <p className="text-muted-foreground">
              Top-voted indie games by the community
            </p>
          </div>

          <div className="space-y-4">
            {games.map((game, index) => (
              <Card
                key={game.id}
                className="p-6 bg-card border-border hover:border-primary/50 transition-colors slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center font-bold text-2xl">
                    {index + 1}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-bold">{game.title}</h3>
                      <p className="text-sm text-primary">{game.hook_text}</p>
                      {game.dev_x_handle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by{" "}
                          <a
                            href={`https://x.com/${game.dev_x_handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            @{game.dev_x_handle}
                          </a>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {game.tags?.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Heart className="h-4 w-4 text-primary fill-primary" />
                        <span className="font-semibold">{game.upvotes}</span>
                      </div>

                      {(game.steam_url || game.itchio_url) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(game.steam_url || game.itchio_url, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {games.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No games to display yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Rising;
