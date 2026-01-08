import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flame, Clock, Gift, AlertTriangle, BookOpen, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ExitIntentPopupProps {
  streak: number;
  hasReadToday: boolean;
  userName?: string;
}

export const ExitIntentPopup = ({ streak, hasReadToday, userName }: ExitIntentPopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [countdown, setCountdown] = useState("");
  const navigate = useNavigate();

  // Calculate countdown to midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Exit intent detection
  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves toward top of page (exit intent)
    if (e.clientY < 50 && !hasTriggered && !hasReadToday && streak > 0) {
      // Check if already shown in this session
      const lastShown = sessionStorage.getItem('exitIntentShown');
      if (!lastShown) {
        setIsOpen(true);
        setHasTriggered(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    }
  }, [hasTriggered, hasReadToday, streak]);

  // Page visibility change detection
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && !hasTriggered && !hasReadToday && streak > 0) {
      const lastShown = sessionStorage.getItem('exitIntentShown');
      if (!lastShown) {
        setIsOpen(true);
        setHasTriggered(true);
        sessionStorage.setItem('exitIntentShown', 'true');
      }
    }
  }, [hasTriggered, hasReadToday, streak]);

  useEffect(() => {
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleMouseLeave, handleVisibilityChange]);

  const handleContinueReading = () => {
    setIsOpen(false);
    navigate('/dashboard');
  };

  if (hasReadToday) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-destructive/30 bg-gradient-to-b from-background to-destructive/5">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 relative">
            {/* Animated warning icon */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center animate-pulse shadow-2xl">
              <Flame className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive flex items-center justify-center animate-bounce">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <DialogTitle className="text-2xl font-bold">
            Wait{userName ? `, ${userName}` : ''}! 🔥
          </DialogTitle>
          
          <DialogDescription className="text-base space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="font-semibold text-destructive flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Your {streak}-day streak will reset in
              </p>
              <p className="text-3xl font-mono font-bold text-destructive mt-1">
                {countdown}
              </p>
            </div>
            
            <p className="text-muted-foreground">
              Don't lose all your progress! Just <span className="font-semibold text-foreground">5 minutes of reading</span> will save your streak.
            </p>

            {/* Loss preview */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">You'll lose</p>
                <p className="text-lg font-bold text-destructive">🔥 {streak} days</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Start from</p>
                <p className="text-lg font-bold text-muted-foreground">Day 0</p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button 
            onClick={handleContinueReading}
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 text-lg font-semibold animate-pulse"
          >
            <BookOpen className="w-5 h-5" />
            Save My Streak
            <ArrowRight className="w-5 h-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            I'll come back later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
