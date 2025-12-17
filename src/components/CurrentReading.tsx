import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CurrentReadingProps {
  bookId?: string;
  bookTitle?: string;
  bookAuthor?: string;
  progress: number;
  isPaused: boolean;
  onResume: () => void;
  onPause: () => void;
}

export const CurrentReading = ({ 
  bookId,
  bookTitle, 
  bookAuthor, 
  progress, 
  isPaused,
  onResume,
  onPause 
}: CurrentReadingProps) => {
  const navigate = useNavigate();
  if (!bookTitle) {
    return (
      <Card className="p-8 text-center border-dashed border-2 border-border/50 bg-muted/20" role="status" aria-label="No book currently being read">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No book in progress</h3>
        <p className="text-sm text-muted-foreground">Start reading to see your progress here</p>
      </Card>
    );
  }

  return (
    <Card 
      className="overflow-hidden glass-morphism border-primary/20 glow-effect hover-lift cursor-pointer transition-all"
      onClick={() => bookId && navigate(`/read/${bookId}`)}
      role="article"
      aria-label={`Currently reading ${bookTitle} by ${bookAuthor}, ${Math.round(progress)}% complete`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && bookId && navigate(`/read/${bookId}`)}
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-16 sm:w-16 sm:h-20 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg glow-effect shrink-0" aria-hidden="true">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent line-clamp-2 break-words">{bookTitle}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">{bookAuthor}</p>
            <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold text-primary" aria-label={`${Math.round(progress)} percent complete`}>{Math.round(progress)}%</span>
              </div>
              <div 
                className="relative h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden" 
                role="progressbar" 
                aria-valuenow={Math.round(progress)} 
                aria-valuemin={0} 
                aria-valuemax={100}
                aria-label="Reading progress"
              >
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500 glow-effect"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-6">
          <Button 
            className="w-full gap-2 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-opacity glow-effect text-sm sm:text-base h-9 sm:h-10"
            aria-label={`Continue reading ${bookTitle}`}
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            Continue Reading
          </Button>
        </div>
      </div>
    </Card>
  );
};