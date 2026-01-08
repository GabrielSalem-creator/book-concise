import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flame, Sparkles, Trophy, Target, Gift, Zap, Star, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface WelcomeBackModalProps {
  streak: number;
  hasReadToday: boolean;
  lastReadDate?: Date | null;
  userName?: string;
  booksRead: number;
}

export const WelcomeBackModal = ({ 
  streak, 
  hasReadToday, 
  lastReadDate, 
  userName,
  booksRead 
}: WelcomeBackModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'streak' | 'milestone' | 'welcome'>('welcome');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we should show welcome modal
    const lastWelcome = localStorage.getItem('lastWelcomeDate');
    const today = new Date().toDateString();
    
    if (lastWelcome !== today) {
      // Determine celebration type
      if (streak >= 7 && streak % 7 === 0) {
        setCelebrationType('milestone');
      } else if (streak > 0 && !hasReadToday) {
        setCelebrationType('streak');
      } else {
        setCelebrationType('welcome');
      }
      
      // Show after a short delay
      setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem('lastWelcomeDate', today);
      }, 1000);
    }
  }, [streak, hasReadToday]);

  const handleStartReading = () => {
    setIsOpen(false);
    navigate('/dashboard');
  };

  const getStreakMessage = () => {
    if (streak >= 30) return { emoji: "👑", message: "LEGENDARY status!", subtext: "You're in the top 1% of readers!" };
    if (streak >= 21) return { emoji: "🏆", message: "Incredible dedication!", subtext: "3 weeks strong!" };
    if (streak >= 14) return { emoji: "⚡", message: "Two weeks of power!", subtext: "You're unstoppable!" };
    if (streak >= 7) return { emoji: "🔥", message: "One week streak!", subtext: "Keep the momentum!" };
    if (streak >= 3) return { emoji: "✨", message: "Building momentum!", subtext: "Great start!" };
    return { emoji: "📚", message: "Welcome back!", subtext: "Ready to read?" };
  };

  const { emoji, message, subtext } = getStreakMessage();

  // Calculate tomorrow's potential rewards
  const tomorrowStreak = streak + 1;
  const weekMilestone = Math.ceil(tomorrowStreak / 7) * 7;
  const daysToMilestone = weekMilestone - tomorrowStreak + 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10" />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-primary/30 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`,
                width: `${12 + Math.random() * 8}px`,
              }}
            />
          ))}
        </div>

        <DialogHeader className="relative text-center">
          {/* Main celebration icon */}
          <div className="mx-auto mb-4">
            <div className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-primary via-accent to-secondary shadow-2xl",
              "animate-scale-in"
            )}>
              <span className="text-4xl">{emoji}</span>
              
              {streak >= 7 && (
                <div className="absolute -top-1 -right-1">
                  <Crown className="w-8 h-8 text-yellow-400 animate-bounce" />
                </div>
              )}
            </div>
          </div>
          
          <DialogTitle className="text-2xl font-bold">
            {userName ? `Hey ${userName}!` : 'Welcome Back!'} {emoji}
          </DialogTitle>
          
          <DialogDescription className="space-y-4 pt-2">
            {/* Streak Status */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
                <span className="text-4xl font-bold text-foreground">{streak}</span>
                <span className="text-lg text-muted-foreground">day streak</span>
              </div>
              <p className="text-sm font-medium text-foreground">{message}</p>
              <p className="text-xs text-muted-foreground">{subtext}</p>
            </div>

            {/* Today's Goals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Today's goal</p>
                <p className="font-semibold text-foreground">Read 1 book</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
                <Gift className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xs text-muted-foreground">Unlock in</p>
                <p className="font-semibold text-foreground">{daysToMilestone} days</p>
              </div>
            </div>

            {/* Tomorrow preview */}
            <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Complete today to unlock tomorrow:</p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">{tomorrowStreak}-day streak</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">+{Math.floor(tomorrowStreak / 7) + 1} credits</span>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          <Button 
            onClick={handleStartReading}
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 text-lg font-semibold"
          >
            <Zap className="w-5 h-5" />
            Start Reading
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
