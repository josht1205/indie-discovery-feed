import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GameCard } from "@/components/GameCard";
import { Navigation } from "@/components/Navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Feed = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userInteractions, setUserInteractions] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAuth();
    fetchGames();
    fetchUserInteractions();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error: any) {
      toast.error("Failed to load games");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserInteractions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("game_interactions")
      .select("game_id, action")
      .eq("user_id", user.id);

    if (data) {
      const interactions = new Set(data.map((i) => `${i.action}-${i.game_id}`));
      setUserInteractions(interactions);
    }
  };

  const handleSwipe = (direction: "left" | "right" | "up") => {
    if (direction === "left" || direction === "up") {
      // Skip to next game
      setCurrentIndex((prev) => (prev + 1) % games.length);
    } else if (direction === "right") {
      // Wishlist and next
      setCurrentIndex((prev) => (prev + 1) % games.length);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">No games yet</h2>
            <p className="text-muted-foreground">Check back soon for new indie discoveries!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md h-[calc(100vh-10rem)] slide-up">
          <GameCard
            game={games[currentIndex]}
            onSwipe={handleSwipe}
            userInteractions={userInteractions}
          />
        </div>
      </div>
    </div>
  );
};

export default Feed;
