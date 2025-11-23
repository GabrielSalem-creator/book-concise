import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Book {
  id: string;
  title: string;
  author: string;
  status: 'pending' | 'reading' | 'completed';
  orderIndex: number;
}

interface ReadingPlanProps {
  goalTitle?: string;
  books: Book[];
}

export const ReadingPlan = ({ goalTitle, books }: ReadingPlanProps) => {
  if (!goalTitle || books.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-2 border-border/50 bg-muted/20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No active reading plan</h3>
        <p className="text-sm text-muted-foreground">
          Visit the Chat tab to set a goal and get personalized book recommendations
        </p>
      </Card>
    );
  }

  const completedCount = books.filter(b => b.status === 'completed').length;
  const progressPercentage = (completedCount / books.length) * 100;

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur shadow-lg">
      <div className="p-6 border-b border-border/50 bg-muted/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">{goalTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {books.length} books completed
            </p>
          </div>
          <Badge variant="secondary" className="font-semibold">
            {Math.round(progressPercentage)}%
          </Badge>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="p-6 space-y-3">
          {books.map((book, idx) => (
            <div
              key={book.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                book.status === 'completed'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : book.status === 'reading'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-muted/30 border border-border/30'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background shadow-sm shrink-0">
                {book.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : book.status === 'reading' ? (
                  <BookOpen className="w-4 h-4 text-blue-500" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight mb-1 truncate">{book.title}</p>
                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
              </div>
              <Badge
                variant={book.status === 'completed' ? 'default' : 'outline'}
                className="shrink-0 text-xs"
              >
                {book.status === 'completed' ? 'Done' : book.status === 'reading' ? 'Reading' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};