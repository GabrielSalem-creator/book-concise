import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

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

const Onboarding = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSelect = (option: string) => {
    if (!selectedThemes.includes(option)) {
      setSelectedThemes([...selectedThemes, option]);
    }
    
    if (currentQuestion < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    }
  };

  const handleComplete = async () => {
    try {
      setIsLoading(true);
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
        .insert({
          user_id: user.id,
          themes: selectedThemes,
          completed_onboarding: true,
        });

      if (error) throw error;

      toast({
        title: "Preferences saved!",
        description: "Let's find books tailored for you.",
      });

      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <div className="flex items-center space-x-3 mb-4">
            <BookOpen className="w-12 h-12 text-primary" />
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Welcome to BookConcise
          </h1>
          <p className="text-muted-foreground text-center">
            Let's personalize your reading experience
          </p>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Question {currentQuestion + 1} of {QUESTIONS.length}
          </p>
        </div>

        <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 animate-scale-in">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">
            {QUESTIONS[currentQuestion].question}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUESTIONS[currentQuestion].options.map((option) => (
              <Button
                key={option}
                onClick={() => handleSelect(option)}
                variant="outline"
                className="h-auto p-6 text-left justify-start hover:border-primary hover:bg-primary/5 transition-all group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-between w-full">
                  <span className="text-lg">{option}</span>
                  {selectedThemes.includes(option) && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </span>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            ))}
          </div>

          {currentQuestion === QUESTIONS.length - 1 && (
            <Button
              onClick={handleComplete}
              disabled={isLoading || selectedThemes.length === 0}
              className="w-full mt-8 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              {isLoading ? "Saving..." : "Complete Setup"}
            </Button>
          )}
        </Card>

        <div className="mt-6 flex flex-wrap gap-2 justify-center animate-fade-in">
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
    </div>
  );
};

export default Onboarding;
