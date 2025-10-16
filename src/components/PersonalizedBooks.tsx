import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Book {
  title: string;
  author?: string;
  description?: string;
  theme: string;
}

export const PersonalizedBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userThemes, setUserThemes] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: preferences } = await supabase
        .from("user_preferences")
        .select("themes")
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferences?.themes) {
        setUserThemes(preferences.themes);
        await fetchBooksForThemes(preferences.themes);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBooksForThemes = async (themes: string[]) => {
    const allBooks: Book[] = [];

    for (const theme of themes.slice(0, 3)) {
      const mockBooks = generateMockBooks(theme);
      allBooks.push(...mockBooks);
    }

    setBooks(allBooks);
  };

  const generateMockBooks = (theme: string): Book[] => {
    const bookData: Record<string, Book[]> = {
      Technology: [
        { title: "The Innovators", author: "Walter Isaacson", description: "The history of computer revolution", theme: "Technology" },
        { title: "Clean Code", author: "Robert C. Martin", description: "A handbook of agile software craftsmanship", theme: "Technology" },
      ],
      Literature: [
        { title: "1984", author: "George Orwell", description: "A dystopian social science fiction novel", theme: "Literature" },
        { title: "To Kill a Mockingbird", author: "Harper Lee", description: "A classic of modern American literature", theme: "Literature" },
      ],
      Physics: [
        { title: "A Brief History of Time", author: "Stephen Hawking", description: "From the Big Bang to black holes", theme: "Physics" },
        { title: "The Elegant Universe", author: "Brian Greene", description: "Superstrings and the quest for the ultimate theory", theme: "Physics" },
      ],
      Mathematics: [
        { title: "The Joy of x", author: "Steven Strogatz", description: "A guided tour of math", theme: "Mathematics" },
        { title: "Fermat's Enigma", author: "Simon Singh", description: "The quest to solve the world's greatest mathematical problem", theme: "Mathematics" },
      ],
      Business: [
        { title: "Good to Great", author: "Jim Collins", description: "Why some companies make the leap", theme: "Business" },
        { title: "Zero to One", author: "Peter Thiel", description: "Notes on startups", theme: "Business" },
      ],
      Startups: [
        { title: "The Lean Startup", author: "Eric Ries", description: "How constant innovation creates radically successful businesses", theme: "Startups" },
        { title: "The Hard Thing About Hard Things", author: "Ben Horowitz", description: "Building a business when there are no easy answers", theme: "Startups" },
      ],
      Finance: [
        { title: "The Intelligent Investor", author: "Benjamin Graham", description: "The definitive book on value investing", theme: "Finance" },
        { title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", description: "What the rich teach their kids about money", theme: "Finance" },
      ],
      Politics: [
        { title: "The Prince", author: "Niccolò Machiavelli", description: "A political treatise", theme: "Politics" },
        { title: "Democracy in America", author: "Alexis de Tocqueville", description: "A classic text on American politics", theme: "Politics" },
      ],
      History: [
        { title: "Sapiens", author: "Yuval Noah Harari", description: "A brief history of humankind", theme: "History" },
        { title: "Guns, Germs, and Steel", author: "Jared Diamond", description: "The fates of human societies", theme: "History" },
      ],
      Psychology: [
        { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", description: "Two systems that drive the way we think", theme: "Psychology" },
        { title: "Man's Search for Meaning", author: "Viktor Frankl", description: "Finding purpose in life", theme: "Psychology" },
      ],
      Philosophy: [
        { title: "Meditations", author: "Marcus Aurelius", description: "Stoic philosophy", theme: "Philosophy" },
        { title: "The Republic", author: "Plato", description: "Socratic dialogue on justice", theme: "Philosophy" },
      ],
      Science: [
        { title: "The Selfish Gene", author: "Richard Dawkins", description: "Evolution from a gene-centered view", theme: "Science" },
        { title: "Cosmos", author: "Carl Sagan", description: "A personal voyage through the universe", theme: "Science" },
      ],
    };

    return bookData[theme] || [];
  };

  const handleBookClick = async (book: Book) => {
    toast({
      title: "Generating summary",
      description: `Preparing ${book.title}...`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recommended for You</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Recommended for You
        </h2>
        <p className="text-muted-foreground">Based on your interests: {userThemes.slice(0, 3).join(", ")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book, index) => (
          <Card
            key={index}
            className="p-6 hover:shadow-lg transition-all hover:scale-105 cursor-pointer group bg-card/50 backdrop-blur-sm border-2 hover:border-primary/50"
            onClick={() => handleBookClick(book)}
          >
            <div className="flex items-start justify-between mb-3">
              <BookOpen className="w-8 h-8 text-primary" />
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {book.theme}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
              {book.title}
            </h3>
            
            {book.author && (
              <p className="text-sm text-muted-foreground mb-3">
                by {book.author}
              </p>
            )}
            
            {book.description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {book.description}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 group-hover:border-primary group-hover:text-primary transition-colors"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Read
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 group-hover:border-accent group-hover:text-accent transition-colors"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Listen
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
