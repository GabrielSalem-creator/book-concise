import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Calendar } from "lucide-react";

interface NoCreditsPopupProps {
  open: boolean;
  onClose: () => void;
  daysUntilReset?: number;
}

export const NoCreditsPopup = ({ open, onClose, daysUntilReset = 7 }: NoCreditsPopupProps) => {
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

            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 text-left">
              <Calendar className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Weekly Credit System</p>
                <p className="text-sm text-muted-foreground">
                  You receive <span className="font-semibold text-primary">3 free credits</span> every week 
                  to generate new book summaries. Reading existing summaries is always free!
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center pt-2">
          <Button onClick={onClose} className="px-8">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
