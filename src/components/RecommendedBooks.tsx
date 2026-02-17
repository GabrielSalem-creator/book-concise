import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RecommendedBook {
  title: string;
  author: string;
  description: string;
  theme: string;
}

const CURATED_BOOKS: RecommendedBook[] = [
  { title: "Atomic Habits", author: "James Clear", description: "Tiny changes, remarkable results", theme: "Self-Help" },
  { title: "Sapiens", author: "Yuval Noah Harari", description: "A brief history of humankind", theme: "History" },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", description: "Two systems that drive the way we think", theme: "Psychology" },
  { title: "The Lean Startup", author: "Eric Ries", description: "How constant innovation creates successful businesses", theme: "Business" },
  { title: "1984", author: "George Orwell", description: "A dystopian social science fiction novel", theme: "Literature" },
  { title: "Zero to One", author: "Peter Thiel", description: "Notes on startups, or how to build the future", theme: "Startups" },
  { title: "The Power of Habit", author: "Charles Duhigg", description: "Why we do what we do in life and business", theme: "Psychology" },
  { title: "Meditations", author: "Marcus Aurelius", description: "Stoic philosophy for daily life", theme: "Philosophy" },
  { title: "Clean Code", author: "Robert C. Martin", description: "A handbook of agile software craftsmanship", theme: "Technology" },
  { title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", description: "What the rich teach their kids about money", theme: "Finance" },
  { title: "Man's Search for Meaning", author: "Viktor Frankl", description: "Finding purpose in life's suffering", theme: "Philosophy" },
  { title: "The Selfish Gene", author: "Richard Dawkins", description: "Evolution from a gene-centered view", theme: "Science" },
  { title: "Good to Great", author: "Jim Collins", description: "Why some companies make the leap", theme: "Business" },
  { title: "A Brief History of Time", author: "Stephen Hawking", description: "From the Big Bang to black holes", theme: "Science" },
  { title: "Influence", author: "Robert Cialdini", description: "The psychology of persuasion", theme: "Psychology" },
  { title: "The Innovators", author: "Walter Isaacson", description: "The history of the computer revolution", theme: "Technology" },
];

interface RecommendedBooksProps {
  userThemes?: string[];
}

export const RecommendedBooks = ({ userThemes = [] }: RecommendedBooksProps) => {
  const navigate = useNavigate();
  const [displayBooks, setDisplayBooks] = useState<RecommendedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Rotate books based on day of year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let pool = CURATED_BOOKS;
    
    // If user has theme preferences, prioritize those
    if (userThemes.length > 0) {
      const themed = CURATED_BOOKS.filter(b => 
        userThemes.some(t => b.theme.toLowerCase().includes(t.toLowerCase()))
      );
      const others = CURATED_BOOKS.filter(b => !themed.includes(b));
      pool = [...themed, ...others];
    }

    // Rotate based on day
    const rotated = [...pool.slice(dayOfYear % pool.length), ...pool.slice(0, dayOfYear % pool.length)];
    setDisplayBooks(rotated.slice(0, 6));
    setIsLoading(false);
  }, [userThemes]);

  const handleBookClick = async (book: RecommendedBook) => {
    // Check if the book exists in DB
    const { data: existingBook } = await supabase
      .from('books')
      .select('id, summaries(id)')
      .ilike('title', book.title)
      .maybeSingle();

    if (existingBook) {
      navigate(`/read/${existingBook.id}`);
    } else {
      // Create the book and navigate
      const { data: newBook } = await supabase
        .from('books')
        .insert({ title: book.title, author: book.author, description: book.description })
        .select('id')
        .single();

      if (newBook) {
        navigate(`/read/${newBook.id}?search=true`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3 animate-fade-in" aria-labelledby="recommended-heading">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 id="recommended-heading" className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Recommended for You
        </h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayBooks.map((book, i) => (
          <Card
            key={`${book.title}-${i}`}
            onClick={() => handleBookClick(book)}
            className="p-3 sm:p-4 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group bg-card/50 backdrop-blur-sm border border-border/50"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {book.theme}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="text-sm font-semibold leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            <p className="text-[10px] text-muted-foreground mb-1">{book.author}</p>
            <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{book.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
};
