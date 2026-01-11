import { useState, useEffect } from "react";
import { Star, X, Gift, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FeedbackPopupProps {
  userId: string;
}

export const FeedbackPopup = ({ userId }: FeedbackPopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkIfShouldShow = async () => {
      // Check local storage for feedback status
      const lastFeedback = localStorage.getItem("nocturn_last_feedback");
      const feedbackCount = parseInt(localStorage.getItem("nocturn_feedback_count") || "0");
      const sessionCount = parseInt(localStorage.getItem("nocturn_session_count") || "0");

      // Increment session count
      const newSessionCount = sessionCount + 1;
      localStorage.setItem("nocturn_session_count", newSessionCount.toString());

      // Show feedback popup every 5 sessions if not submitted recently
      if (newSessionCount >= 5 && newSessionCount % 5 === 0) {
        // Check if feedback was given in the last 7 days
        if (lastFeedback) {
          const lastFeedbackDate = new Date(lastFeedback);
          const daysSince = Math.floor((Date.now() - lastFeedbackDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince < 7) return;
        }
        
        // Delay popup for better UX
        setTimeout(() => setIsOpen(true), 3000);
      }
    };

    checkIfShouldShow();
  }, [userId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Tap the stars to rate your experience",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Log activity
      await supabase.from("user_activity").insert({
        user_id: userId,
        action_type: "feedback_submitted",
        action_details: { rating, feedback, timestamp: new Date().toISOString() },
      });

      // Award 2 credits
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("daily_credits")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefs) {
        await supabase
          .from("user_preferences")
          .update({ daily_credits: (prefs.daily_credits || 0) + 2 })
          .eq("user_id", userId);
      }

      // Update local storage
      localStorage.setItem("nocturn_last_feedback", new Date().toISOString());
      localStorage.setItem(
        "nocturn_feedback_count",
        (parseInt(localStorage.getItem("nocturn_feedback_count") || "0") + 1).toString()
      );

      toast({
        title: "Thank you for your feedback! 🎉",
        description: "2 credits have been added to your account!",
      });

      setIsOpen(false);
      setRating(0);
      setFeedback("");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md glass-morphism border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Gift className="w-6 h-6 text-primary" />
            Share Your Thoughts
          </DialogTitle>
          <DialogDescription className="text-base">
            Rate your experience and earn <span className="font-bold text-primary">2 free credits!</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-muted-foreground">How's your experience with Nocturn?</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "w-10 h-10 transition-colors",
                      (hoveredRating || rating) >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <span className="text-sm font-medium text-primary animate-fade-in">
                {rating === 5 ? "Amazing! 🎉" : rating >= 4 ? "Great! 😊" : rating >= 3 ? "Good 👍" : rating >= 2 ? "Could be better" : "We'll improve!"}
              </span>
            )}
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Any suggestions? (optional)</span>
            <Textarea
              placeholder="Tell us what you love or what we can improve..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="resize-none h-24"
              maxLength={500}
            />
            <span className="text-xs text-muted-foreground text-right block">
              {feedback.length}/500
            </span>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {isSubmitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Get 2 Credits
                </>
              )}
            </Button>
          </div>

          {/* Credit Badge */}
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Gift className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">
              Submit feedback to earn <span className="text-primary font-bold">2 free credits!</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
