import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface TipPaymentFormProps {
  amount: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TipPaymentForm = ({ amount, onSuccess, onCancel }: TipPaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message || "Payment failed");
      } else {
        toast.success(`Tip sent! Developer receives $${(parseFloat(amount) * 0.9).toFixed(2)}`);
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-gradient-primary"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? "Processing..." : `Send $${amount} Tip`}
        </Button>
      </div>
    </form>
  );
};
