import { useState, useEffect } from "react";
import { Flame, Zap, Gift, Clock, AlertTriangle } from "lucide-react";
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

  // Calculate streak tier for visual intensity
  const getStreakTier = () => {
    if (streak >= 30) return { tier: "legendary", color: "from-yellow-400 via-orange-500 to-red-600", flames: 5 };
    if (streak >= 14) return { tier: "blazing", color: "from-orange-400 via-red-500 to-pink-600", flames: 4 };
    if (streak >= 7) return { tier: "hot", color: "from-orange-500 to-red-500", flames: 3 };
    if (streak >= 3) return { tier: "warm", color: "from-yellow-500 to-orange-500", flames: 2 };
    return { tier: "starting", color: "from-yellow-400 to-yellow-600", flames: 1 };
  };

  const { tier, color, flames } = getStreakTier();

  return (
    <div className="relative flex-shrink-0">
      {/* Main Streak Display - Compact and non-overlapping */}
      <div 
        className={cn(
          "relative flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg transition-all duration-500",
          "bg-gradient-to-r",
          color,
          isAnimating && "scale-105",
          isAtRisk && showUrgency && "animate-pulse"
        )}
      >
        {/* Flame Icon */}
        <Flame 
          className={cn(
            "w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-md",
            isAnimating && "animate-bounce",
          )}
        />
        
        {/* Streak Number */}
        <span className="text-xs sm:text-sm font-bold text-white drop-shadow-sm leading-none">
          {streak}
        </span>

        {/* Sparkle for high streaks - desktop only */}
        {streak >= 7 && (
          <Zap className={cn(
            "hidden sm:block w-3 h-3 text-yellow-300",
            isAnimating && "animate-ping"
          )} />
        )}
      </div>

      {/* Urgency Warning - Only on larger screens, positioned below */}
      {isAtRisk && showUrgency && streak > 0 && (
        <div className="hidden lg:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max z-50">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/90 text-destructive-foreground rounded-md text-[10px] font-medium shadow-lg whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" />
            <span>{hoursLeft}h left!</span>
          </div>
        </div>
      )}
    </div>
  );
};
