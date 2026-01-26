import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Calendar, Crown } from "lucide-react";

interface NoCreditsPopupProps {
  open: boolean;
  onClose: () => void;
  daysUntilReset?: number;
}

export const NoCreditsPopup = ({ open, onClose, daysUntilReset = 7 }: NoCreditsPopupProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold text-center">
            No Credits Remaining
          </DialogTitle>
          <DialogDescription className="text-center space-y-3 pt-2">
            <p className="text-base text-foreground/80">
              You've used all your weekly credits for generating book summaries.
            </p>
            
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-muted/50 border">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">
                {daysUntilReset === 1 
                  ? "Credits reset tomorrow!" 
                  : `${daysUntilReset} days until reset`}
              </span>
            </div>

{/* Premium upgrade CTA - temporarily hidden
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-amber-700 dark:text-amber-400">Go Premium</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Get <span className="font-semibold text-amber-600 dark:text-amber-400">unlimited summaries</span>, 
                premium TTS voices, and all languages for just $9.99/month.
              </p>
              <Button 
                onClick={handleUpgrade}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </div>
*/}

            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 text-left">
              <Calendar className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Free Plan</p>
                <p className="text-sm text-muted-foreground">
                  You receive <span className="font-semibold text-primary">3 free credits</span> every week. 
                  Reading existing summaries is always free!
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onClose} className="px-8">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
