import { useState } from "react";
import { DollarSign } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TipButtonProps {
  gameId: string;
  gameTitle: string;
  devHandle?: string;
}

export const TipButton = ({ gameId, gameTitle, devHandle }: TipButtonProps) => {
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [amount, setAmount] = useState("5");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTip = async () => {
    try {
      setIsProcessing(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to tip developers");
        return;
      }

      const tipAmount = parseFloat(amount);
      if (isNaN(tipAmount) || tipAmount < 1) {
        toast.error("Minimum tip is $1.00");
        return;
      }

      // Convert to cents
      const amountInCents = Math.floor(tipAmount * 100);

      const { data, error } = await supabase.functions.invoke("create-tip-payment", {
        body: { gameId, amount: amountInCents },
      });

      if (error) throw error;

      toast.success(`Tip payment created! Developer will receive $${(tipAmount * 0.9).toFixed(2)}`);
      setShowTipDialog(false);
      setAmount("5");
    } catch (error: any) {
      console.error("Tip error:", error);
      toast.error(error.message || "Failed to process tip");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!devHandle) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={() => setShowTipDialog(true)}
      >
        <DollarSign className="h-4 w-4" />
        Tip Dev
      </Button>

      {showTipDialog && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTipDialog(false)}
        >
          <Card
            className="w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Tip Developer</h3>
              <p className="text-sm text-muted-foreground">
                Support {devHandle ? `@${devHandle}` : "the developer"} for{" "}
                {gameTitle}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tip-amount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="tip-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                  placeholder="5.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Platform fee: 10% • Developer receives: $
                {(parseFloat(amount || "0") * 0.9).toFixed(2)}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowTipDialog(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-primary"
                onClick={handleTip}
                disabled={isProcessing || !amount}
              >
                {isProcessing ? "Processing..." : "Send Tip"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Backend payment creation works! Full payment UI requires Stripe Elements setup.
            </p>
          </Card>
        </div>
      )}
    </>
  );
};
