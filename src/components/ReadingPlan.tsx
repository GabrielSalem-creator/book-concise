import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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
    <Card className="overflow-hidden glass-morphism border-primary/20 glow-effect">
      <div className="p-6 border-b border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {goalTitle}
            </h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {books.length} books completed
            </p>
          </div>
          <Badge variant="secondary" className="font-semibold bg-primary/20 text-primary border-primary/30">
            {Math.round(progressPercentage)}%
          </Badge>
        </div>
        <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="p-6 space-y-3">
          {books.map((book, idx) => (
            <div
              key={book.id}
              onClick={() => navigate(`/read/${book.id}?search=true`)}
              className={`group flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer hover-lift ${
                book.status === 'completed'
                  ? 'bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/30'
                  : book.status === 'reading'
                  ? 'bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 ring-2 ring-primary/30'
                  : 'bg-muted/20 border border-border/30 hover:bg-muted/30'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all ${
                book.status === 'completed' 
                  ? 'bg-green-500/20 group-hover:bg-green-500/30' 
                  : book.status === 'reading'
                  ? 'bg-primary/20 group-hover:bg-primary/30'
                  : 'bg-muted/30 group-hover:bg-muted/40'
              }`}>
                {book.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : book.status === 'reading' ? (
                  <BookOpen className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight mb-1 truncate group-hover:text-primary transition-colors">
                  {book.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
              </div>
              <Badge
                variant={book.status === 'completed' ? 'default' : 'outline'}
                className={`shrink-0 text-xs ${
                  book.status === 'completed' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : book.status === 'reading'
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : ''
                }`}
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