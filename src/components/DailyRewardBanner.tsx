import { useState, useEffect } from "react";
import { Gift, Sparkles, Clock, ChevronRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DailyRewardBannerProps {
  streak: number;
  hasReadToday: boolean;
  onDismiss?: () => void;
}

export const DailyRewardBanner = ({ streak, hasReadToday, onDismiss }: DailyRewardBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Periodic attention grab
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible || hasReadToday) return null;

  // Calculate what they'll get tomorrow based on streak
  const nextStreakBonus = Math.min(streak + 1, 30);
  const bonusCredits = Math.floor(nextStreakBonus / 7) + 1;

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30 transition-all duration-500",
        "bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20",
        isAnimating && "scale-[1.02] shadow-2xl border-primary/50"
      )}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative p-4 sm:p-5">
        <div className="flex items-center gap-4">
          {/* Gift Icon with glow */}
          <div className={cn(
            "relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center",
            "bg-gradient-to-br from-primary to-accent shadow-lg",
            isAnimating && "animate-bounce"
          )}>
            <Gift className="w-7 h-7 text-white" />
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 animate-pulse" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground">Don't Break Your Streak!</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-destructive/20 rounded-full">
                <Clock className="w-3 h-3 text-destructive" />
                <span className="text-xs font-medium text-destructive">{timeLeft}</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              Read today to keep your <span className="font-semibold text-primary">{streak}-day streak</span> and unlock tomorrow's rewards!
            </p>

            {/* Reward preview */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-accent">
                <Flame className="w-3.5 h-3.5" />
                <span>{nextStreakBonus}-day streak</span>
              </div>
              <div className="flex items-center gap-1 text-secondary">
                <Sparkles className="w-3.5 h-3.5" />
                <span>+{bonusCredits} bonus credits</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Button 
            onClick={() => navigate('/explore')}
            className={cn(
              "flex-shrink-0 gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90",
              isAnimating && "animate-pulse"
            )}
          >
            Read Now
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
