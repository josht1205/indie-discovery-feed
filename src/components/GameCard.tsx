import { useState } from "react";
import { Heart, ShoppingCart, ExternalLink, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GameCardProps {
  game: {
    id: string;
    title: string;
    description: string;
    hook_text: string;
    trailer_url: string;
    steam_url?: string;
    itchio_url?: string;
    tags: string[];
    dev_x_handle?: string;
    upvotes: number;
  };
  onSwipe: (direction: "left" | "right" | "up") => void;
  userInteractions?: Set<string>;
}

export const GameCard = ({ game, onSwipe, userInteractions }: GameCardProps) => {
  const [isUpvoted, setIsUpvoted] = useState(userInteractions?.has(`upvote-${game.id}`) || false);
  const [isWishlisted, setIsWishlisted] = useState(
    userInteractions?.has(`wishlist-${game.id}`) || false
  );

  const handleInteraction = async (action: "upvote" | "wishlist" | "buy") => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to interact with games");
        return;
      }

      // Handle buy action separately (no Supabase)
      if (action === "buy") {
        const url = game.steam_url || game.itchio_url;
        if (url) {
          window.open(url, "_blank");
          toast.success("Opening store page...");
        }
        return;
      }

      const alreadyInteracted =
        action === "upvote" ? isUpvoted : isWishlisted;

      if (alreadyInteracted) {
        // Remove interaction
        const { error } = await supabase
          .from("game_interactions")
          .delete()
          .eq("user_id", user.id)
          .eq("game_id", game.id)
          .eq("action", action);

        if (error) throw error;

        if (action === "upvote") {
          setIsUpvoted(false);
          toast.success("Upvote removed!");
        } else {
          setIsWishlisted(false);
          toast.success("Removed from wishlist!");
        }
      } else {
        // Add interaction
        const { error } = await supabase.from("game_interactions").insert({
          user_id: user.id,
          game_id: game.id,
          action,
        });

        if (error) throw error;

        if (action === "upvote") {
          setIsUpvoted(true);
          toast.success("Game upvoted! 🔥");
        } else {
          setIsWishlisted(true);
          toast.success("Added to wishlist!");
        }

        // Auto-advance to next game after successful interaction
        onSwipe("up");
      }
    } catch (error: any) {
      toast.error(error.message || "Action failed");
    }
  };

  return (
    <div className="relative w-full h-full bg-gradient-card rounded-3xl overflow-hidden shadow-card border border-border/50">
      {/* Video/Trailer */}
      <div className="relative w-full h-[65%] bg-muted">
        <video
          src={game.trailer_url}
          className="w-full h-full object-cover absolute inset-0 rounded-xl"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Skip button */}
        <button
          onClick={() => onSwipe("left")}
          className="absolute top-4 right-4 p-2 bg-background/60 backdrop-blur-sm rounded-full hover:bg-background/80 transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/95 to-transparent p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{game.title}</h2>
          <p className="text-primary font-medium">{game.hook_text}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{game.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {game.tags?.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Dev handle */}
        {game.dev_x_handle && (
          <p className="text-xs text-muted-foreground">
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

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            size="lg"
            variant={isUpvoted ? "default" : "outline"}
            className={`flex-1 ${isUpvoted ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => handleInteraction("upvote")}
          >
            <Heart className={`h-5 w-5 mr-2 ${isUpvoted ? "fill-current" : ""}`} />
            {game.upvotes}
          </Button>

          <Button
            size="lg"
            variant={isWishlisted ? "default" : "outline"}
            className={`flex-1 ${isWishlisted ? "bg-secondary text-secondary-foreground" : ""}`}
            onClick={() => handleInteraction("wishlist")}
          >
            <ShoppingCart className={`h-5 w-5 mr-2 ${isWishlisted ? "fill-current" : ""}`} />
            Wishlist
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => handleInteraction("buy")}
            disabled={!game.steam_url && !game.itchio_url}
          >
            <ExternalLink className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
