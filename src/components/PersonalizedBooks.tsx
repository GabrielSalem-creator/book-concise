import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Check, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface Book {
  title: string;
  author?: string;
  description?: string;
  theme: string;
}

interface PersonalizedBooksProps {
  onBookSelect?: (title: string) => void;
  showOnboarding?: boolean;
  onOnboardingComplete?: () => void;
}

const THEMES = [
  "Technology",
  "Literature",
  "Physics",
  "Mathematics",
  "Business",
  "Startups",
  "Finance",
  "Politics",
  "History",
  "Psychology",
  "Philosophy",
  "Science",
];

const QUESTIONS = [
  {
    id: 1,
    question: "What's your primary reading interest?",
    options: ["Technology", "Literature", "Science", "Business"],
  },
  {
    id: 2,
    question: "Which topic excites you the most?",
    options: ["Startups", "Finance", "Politics", "History"],
  },
  {
    id: 3,
    question: "What field would you like to explore?",
    options: ["Psychology", "Philosophy", "Mathematics", "Physics"],
  },
  {
    id: 4,
    question: "What drives your curiosity?",
    options: ["Innovation", "Human Behavior", "Economics", "Arts"],
  },
  {
    id: 5,
    question: "Pick your learning style:",
    options: ["Practical", "Theoretical", "Historical", "Futuristic"],
  },
  {
    id: 6,
    question: "What's your goal?",
    options: ["Career Growth", "Personal Development", "Academic Research", "General Knowledge"],
  },
  {
    id: 7,
    question: "Final preference:",
    options: ["Deep Dives", "Quick Reads", "Case Studies", "Biographies"],
  },
];

export const PersonalizedBooks = ({ onBookSelect, showOnboarding = false, onOnboardingComplete }: PersonalizedBooksProps) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userThemes, setUserThemes] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!showOnboarding) {
      loadUserPreferences();
    } else {
      setIsLoading(false);
    }
  }, [showOnboarding]);

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
    if (onBookSelect) {
      onBookSelect(book.title);
      toast({
        title: "Book selected",
        description: `${book.title} added to search box`,
      });
    }
  };

  const handleSelect = (option: string) => {
    if (selectedThemes.includes(option)) {
      setSelectedThemes(selectedThemes.filter(t => t !== option));
    } else {
      setSelectedThemes([...selectedThemes, option]);
    }
  };

  const handleNext = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleComplete = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          themes: selectedThemes,
          completed_onboarding: true,
        });

      if (error) throw error;

      toast({
        title: "Preferences saved!",
        description: "Your personalized recommendations are ready.",
      });

      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (showOnboarding) {
    const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Let's personalize your experience
          </h2>
          <p className="text-muted-foreground">
            Answer a few questions to get book recommendations tailored for you
          </p>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Question {currentQuestion + 1} of {QUESTIONS.length}
          </p>
        </div>

        <Card className="p-8 bg-card/50 backdrop-blur-sm border-2">
          <h3 className="text-2xl font-semibold mb-6">
            {QUESTIONS[currentQuestion].question}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUESTIONS[currentQuestion].options.map((option) => (
              <Button
                key={option}
                onClick={() => handleSelect(option)}
                variant={selectedThemes.includes(option) ? "default" : "outline"}
                className="h-auto p-6 text-left justify-start hover:border-primary transition-all group relative"
              >
                <span className="flex items-center justify-between w-full">
                  <span className="text-lg">{option}</span>
                  {selectedThemes.includes(option) && (
                    <Check className="w-5 h-5" />
                  )}
                </span>
              </Button>
            ))}
          </div>

          <div className="flex gap-4 mt-8">
            {currentQuestion < QUESTIONS.length - 1 && (
              <Button
                onClick={handleNext}
                disabled={selectedThemes.length === 0}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                Next Question
              </Button>
            )}
            {currentQuestion === QUESTIONS.length - 1 && (
              <Button
                onClick={handleComplete}
                disabled={isSaving || selectedThemes.length === 0}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                {isSaving ? "Saving..." : "Complete Setup"}
              </Button>
            )}
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 justify-center">
          <p className="text-sm text-muted-foreground w-full text-center mb-2">
            Selected preferences:
          </p>
          {selectedThemes.map((theme) => (
            <span
              key={theme}
              className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20"
            >
              {theme}
            </span>
          ))}
        </div>
      </div>
    );
  }

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

            <Button
              size="sm"
              variant="outline"
              className="w-full group-hover:border-primary group-hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleBookClick(book);
              }}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Read Summary
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
