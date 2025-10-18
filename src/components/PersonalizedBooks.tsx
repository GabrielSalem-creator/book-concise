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
    
    // Get day of year for daily rotation
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    for (const theme of themes.slice(0, 5)) {
      const mockBooks = generateMockBooks(theme);
      // Rotate books daily based on day of year
      const rotationIndex = dayOfYear % mockBooks.length;
      const rotatedBooks = [...mockBooks.slice(rotationIndex), ...mockBooks.slice(0, rotationIndex)];
      allBooks.push(...rotatedBooks.slice(0, 4)); // Show 4 books per theme
    }

    setBooks(allBooks);
  };

  const generateMockBooks = (theme: string): Book[] => {
    const bookData: Record<string, Book[]> = {
      Technology: [
        { title: "The Innovators", author: "Walter Isaacson", description: "The history of computer revolution", theme: "Technology" },
        { title: "Clean Code", author: "Robert C. Martin", description: "A handbook of agile software craftsmanship", theme: "Technology" },
        { title: "The Pragmatic Programmer", author: "Andrew Hunt", description: "Your journey to mastery", theme: "Technology" },
        { title: "Code Complete", author: "Steve McConnell", description: "A practical handbook of software construction", theme: "Technology" },
        { title: "The Phoenix Project", author: "Gene Kim", description: "A novel about IT, DevOps, and helping your business win", theme: "Technology" },
        { title: "Algorithms to Live By", author: "Brian Christian", description: "The computer science of human decisions", theme: "Technology" },
      ],
      Literature: [
        { title: "1984", author: "George Orwell", description: "A dystopian social science fiction novel", theme: "Literature" },
        { title: "To Kill a Mockingbird", author: "Harper Lee", description: "A classic of modern American literature", theme: "Literature" },
        { title: "Pride and Prejudice", author: "Jane Austen", description: "A romantic novel of manners", theme: "Literature" },
        { title: "The Great Gatsby", author: "F. Scott Fitzgerald", description: "The story of the fabulously wealthy Jay Gatsby", theme: "Literature" },
        { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez", description: "A multi-generational story of the Buendía family", theme: "Literature" },
        { title: "Brave New World", author: "Aldous Huxley", description: "A dystopian novel set in a futuristic World State", theme: "Literature" },
      ],
      Physics: [
        { title: "A Brief History of Time", author: "Stephen Hawking", description: "From the Big Bang to black holes", theme: "Physics" },
        { title: "The Elegant Universe", author: "Brian Greene", description: "Superstrings and the quest for the ultimate theory", theme: "Physics" },
        { title: "Quantum Physics for Beginners", author: "Alastair Rae", description: "Understanding the quantum world", theme: "Physics" },
        { title: "The Fabric of the Cosmos", author: "Brian Greene", description: "Space, time, and the texture of reality", theme: "Physics" },
        { title: "Relativity", author: "Albert Einstein", description: "The special and general theory", theme: "Physics" },
        { title: "The Feynman Lectures on Physics", author: "Richard Feynman", description: "The definitive physics textbook", theme: "Physics" },
      ],
      Mathematics: [
        { title: "The Joy of x", author: "Steven Strogatz", description: "A guided tour of math", theme: "Mathematics" },
        { title: "Fermat's Enigma", author: "Simon Singh", description: "The quest to solve the world's greatest mathematical problem", theme: "Mathematics" },
        { title: "How Not to Be Wrong", author: "Jordan Ellenberg", description: "The power of mathematical thinking", theme: "Mathematics" },
        { title: "The Man Who Knew Infinity", author: "Robert Kanigel", description: "A life of the genius Ramanujan", theme: "Mathematics" },
        { title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", description: "An eternal golden braid", theme: "Mathematics" },
        { title: "A Mathematician's Apology", author: "G.H. Hardy", description: "Reflections on mathematics", theme: "Mathematics" },
      ],
      Business: [
        { title: "Good to Great", author: "Jim Collins", description: "Why some companies make the leap", theme: "Business" },
        { title: "Zero to One", author: "Peter Thiel", description: "Notes on startups", theme: "Business" },
        { title: "The Innovator's Dilemma", author: "Clayton Christensen", description: "When new technologies cause great firms to fail", theme: "Business" },
        { title: "Built to Last", author: "Jim Collins", description: "Successful habits of visionary companies", theme: "Business" },
        { title: "The E-Myth Revisited", author: "Michael Gerber", description: "Why most small businesses don't work", theme: "Business" },
        { title: "Crossing the Chasm", author: "Geoffrey Moore", description: "Marketing and selling high-tech products", theme: "Business" },
      ],
      Startups: [
        { title: "The Lean Startup", author: "Eric Ries", description: "How constant innovation creates radically successful businesses", theme: "Startups" },
        { title: "The Hard Thing About Hard Things", author: "Ben Horowitz", description: "Building a business when there are no easy answers", theme: "Startups" },
        { title: "The Four Steps to the Epiphany", author: "Steve Blank", description: "Successful strategies for products that win", theme: "Startups" },
        { title: "Rework", author: "Jason Fried", description: "A better, faster, easier way to succeed in business", theme: "Startups" },
        { title: "The Startup Owner's Manual", author: "Steve Blank", description: "The step-by-step guide for building a great company", theme: "Startups" },
        { title: "Hooked", author: "Nir Eyal", description: "How to build habit-forming products", theme: "Startups" },
      ],
      Finance: [
        { title: "The Intelligent Investor", author: "Benjamin Graham", description: "The definitive book on value investing", theme: "Finance" },
        { title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", description: "What the rich teach their kids about money", theme: "Finance" },
        { title: "A Random Walk Down Wall Street", author: "Burton Malkiel", description: "The time-tested strategy for successful investing", theme: "Finance" },
        { title: "The Little Book of Common Sense Investing", author: "John Bogle", description: "The only way to guarantee your fair share", theme: "Finance" },
        { title: "Your Money or Your Life", author: "Vicki Robin", description: "Transforming your relationship with money", theme: "Finance" },
        { title: "The Millionaire Next Door", author: "Thomas Stanley", description: "The surprising secrets of America's wealthy", theme: "Finance" },
      ],
      Politics: [
        { title: "The Prince", author: "Niccolò Machiavelli", description: "A political treatise", theme: "Politics" },
        { title: "Democracy in America", author: "Alexis de Tocqueville", description: "A classic text on American politics", theme: "Politics" },
        { title: "The Federalist Papers", author: "Hamilton, Madison, Jay", description: "Arguments for the U.S. Constitution", theme: "Politics" },
        { title: "The Communist Manifesto", author: "Karl Marx", description: "A political pamphlet", theme: "Politics" },
        { title: "On Liberty", author: "John Stuart Mill", description: "The nature and limits of power", theme: "Politics" },
        { title: "The Second Sex", author: "Simone de Beauvoir", description: "A detailed analysis of women's oppression", theme: "Politics" },
      ],
      History: [
        { title: "Sapiens", author: "Yuval Noah Harari", description: "A brief history of humankind", theme: "History" },
        { title: "Guns, Germs, and Steel", author: "Jared Diamond", description: "The fates of human societies", theme: "History" },
        { title: "A People's History of the United States", author: "Howard Zinn", description: "American history from the bottom up", theme: "History" },
        { title: "The History of the Ancient World", author: "Susan Wise Bauer", description: "From the earliest accounts to the fall of Rome", theme: "History" },
        { title: "SPQR", author: "Mary Beard", description: "A history of ancient Rome", theme: "History" },
        { title: "The Silk Roads", author: "Peter Frankopan", description: "A new history of the world", theme: "History" },
      ],
      Psychology: [
        { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", description: "Two systems that drive the way we think", theme: "Psychology" },
        { title: "Man's Search for Meaning", author: "Viktor Frankl", description: "Finding purpose in life", theme: "Psychology" },
        { title: "Influence", author: "Robert Cialdini", description: "The psychology of persuasion", theme: "Psychology" },
        { title: "The Power of Habit", author: "Charles Duhigg", description: "Why we do what we do in life and business", theme: "Psychology" },
        { title: "Emotional Intelligence", author: "Daniel Goleman", description: "Why it can matter more than IQ", theme: "Psychology" },
        { title: "Mindset", author: "Carol Dweck", description: "The new psychology of success", theme: "Psychology" },
      ],
      Philosophy: [
        { title: "Meditations", author: "Marcus Aurelius", description: "Stoic philosophy", theme: "Philosophy" },
        { title: "The Republic", author: "Plato", description: "Socratic dialogue on justice", theme: "Philosophy" },
        { title: "Beyond Good and Evil", author: "Friedrich Nietzsche", description: "Prelude to a philosophy of the future", theme: "Philosophy" },
        { title: "Being and Time", author: "Martin Heidegger", description: "A treatise on Being", theme: "Philosophy" },
        { title: "The Myth of Sisyphus", author: "Albert Camus", description: "An essay on the absurd", theme: "Philosophy" },
        { title: "Ethics", author: "Baruch Spinoza", description: "Demonstrated in geometrical order", theme: "Philosophy" },
      ],
      Science: [
        { title: "The Selfish Gene", author: "Richard Dawkins", description: "Evolution from a gene-centered view", theme: "Science" },
        { title: "Cosmos", author: "Carl Sagan", description: "A personal voyage through the universe", theme: "Science" },
        { title: "The Origin of Species", author: "Charles Darwin", description: "On natural selection", theme: "Science" },
        { title: "The Double Helix", author: "James Watson", description: "A personal account of the discovery of DNA", theme: "Science" },
        { title: "The Gene", author: "Siddhartha Mukherjee", description: "An intimate history", theme: "Science" },
        { title: "The Sixth Extinction", author: "Elizabeth Kolbert", description: "An unnatural history", theme: "Science" },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
