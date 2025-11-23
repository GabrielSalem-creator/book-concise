import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Play, Pause, RotateCcw } from "lucide-react";

interface CurrentReadingProps {
  bookTitle?: string;
  bookAuthor?: string;
  progress: number;
  isPaused: boolean;
  onResume: () => void;
  onPause: () => void;
}

export const CurrentReading = ({ 
  bookTitle, 
  bookAuthor, 
  progress, 
  isPaused,
  onResume,
  onPause 
}: CurrentReadingProps) => {
  if (!bookTitle) {
    return (
      <Card className="p-8 text-center border-dashed border-2 border-border/50 bg-muted/20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No book in progress</h3>
        <p className="text-sm text-muted-foreground">Start reading to see your progress here</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-shadow">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{bookTitle}</h3>
            <p className="text-sm text-muted-foreground truncate">{bookAuthor}</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {isPaused ? (
            <Button onClick={onResume} className="flex-1 gap-2">
              <Play className="w-4 h-4" />
              Resume Reading
            </Button>
          ) : (
            <Button onClick={onPause} variant="outline" className="flex-1 gap-2">
              <Pause className="w-4 h-4" />
              Pause Reading
            </Button>
          )}
          <Button variant="ghost" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};