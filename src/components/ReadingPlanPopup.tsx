import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export const ReadingPlanPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      checkReadingPlan();
    }
  }, [user]);

  const checkReadingPlan = async () => {
    if (!user) return;

    // Check if user has an active goal
    const { data: goal } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // If no active goal, show popup
    if (!goal) {
      // Check if popup was dismissed recently (within 24 hours)
      const dismissedAt = localStorage.getItem('readingPlanPopupDismissed');
      if (dismissedAt) {
        const dismissedTime = new Date(dismissedAt).getTime();
        const now = new Date().getTime();
        const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
        if (hoursSinceDismissed < 24) return;
      }
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    localStorage.setItem('readingPlanPopupDismissed', new Date().toISOString());
    setIsOpen(false);
  };

  const handleContinue = () => {
    setIsOpen(false);
    navigate('/chat');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="glass-morphism border-primary/20 sm:max-w-md" aria-describedby="reading-plan-description">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <DialogHeader className="text-center space-y-4 pt-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center" aria-hidden="true">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Create Your Reading Plan
          </DialogTitle>
          <DialogDescription id="reading-plan-description" className="text-muted-foreground text-base">
            Tell our AI about your goals and get a personalized reading plan tailored just for you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-6" role="group" aria-label="Reading plan actions">
          <Button
            onClick={handleContinue}
            className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity gap-2"
            aria-label="Start chat to create your reading plan"
          >
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
            Start Chat
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full text-muted-foreground hover:text-foreground"
            aria-label="Dismiss and close dialog"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
