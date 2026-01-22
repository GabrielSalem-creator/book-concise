import { useState, useEffect } from "react";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
  streak: number;
  lastReadDate?: Date | null;
  showUrgency?: boolean;
}

export const StreakDisplay = ({ streak, lastReadDate, showUrgency = true }: StreakDisplayProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(24);
  const [isAtRisk, setIsAtRisk] = useState(false);

  useEffect(() => {
    // Calculate hours left until streak resets (midnight)
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      setHoursLeft(hours);
      
      // Check if user hasn't read today
      if (lastReadDate) {
        const lastRead = new Date(lastReadDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastReadDay = new Date(lastRead);
        lastReadDay.setHours(0, 0, 0, 0);
        
        setIsAtRisk(lastReadDay.getTime() < today.getTime());
      } else if (streak > 0) {
        setIsAtRisk(true);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [lastReadDate, streak]);

  useEffect(() => {
    // Trigger animation periodically to draw attention
    const animationInterval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }, 5000);

    return () => clearInterval(animationInterval);
  }, []);

  // Calculate streak tier for visual intensity - using semantic design tokens
  const getStreakTier = () => {
    if (streak >= 30) return { tier: "legendary", color: "from-accent via-primary to-destructive" };
    if (streak >= 14) return { tier: "blazing", color: "from-primary via-destructive to-accent" };
    if (streak >= 7) return { tier: "hot", color: "from-primary to-accent" };
    if (streak >= 3) return { tier: "warm", color: "from-secondary to-primary" };
    return { tier: "starting", color: "from-secondary to-accent" };
  };

  const { tier, color } = getStreakTier();

  return (
    <div className="relative flex-shrink-0">
      {/* Main Streak Display - Clean and polished */}
      <div 
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all duration-300",
          "bg-gradient-to-r shadow-sm border border-primary-foreground/20",
          color,
          isAnimating && "scale-105 shadow-lg",
        )}
        role="status"
        aria-label={`${streak} day reading streak`}
      >
        {/* Flame Icon */}
        <Flame 
          className={cn(
            "w-4 h-4 text-primary-foreground drop-shadow-sm",
            isAnimating && "animate-bounce",
          )}
          aria-hidden="true"
        />
        
        {/* Streak Number */}
        <span className="text-sm font-bold text-primary-foreground drop-shadow-sm tabular-nums">
          {streak}
        </span>

        {/* Sparkle for high streaks */}
        {streak >= 7 && (
          <Zap className={cn(
            "w-3 h-3 text-primary-foreground/90 drop-shadow-sm",
            isAnimating && "animate-ping"
          )} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
