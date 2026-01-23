import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, ArrowRight, Headphones, BookOpen, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header with top spacing */}
      <div className="h-5 bg-background relative z-10" />
      <header className="relative z-10 border-b border-border/30 backdrop-blur-xl bg-background/50">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">Nocturn</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              onClick={() => window.open("/auth", "_blank")}
              className="hidden sm:inline-flex"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => window.open("/auth", "_blank")}
              className="bg-primary hover:bg-primary/90"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 container mx-auto px-6">
        <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center text-center py-20">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1]">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Read Smarter
              </span>
              <br />
              <span className="text-foreground/90">Not Longer</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI-powered book summaries. Listen or read. Achieve your goals faster.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all group"
              >
                Start Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => navigate("/explore")}
                className="h-14 px-10 text-lg border-2 hover:bg-primary/10"
              >
                Explore Library
              </Button>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-4 mt-20 max-w-3xl">
            <div className="flex items-center gap-3 px-6 py-3 rounded-full glass-morphism border border-primary/20">
              <Headphones className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Listen Anywhere</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full glass-morphism border border-accent/20">
              <BookOpen className="w-5 h-5 text-accent" />
              <span className="text-sm font-medium">Instant Summaries</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full glass-morphism border border-secondary/20">
              <Target className="w-5 h-5 text-secondary" />
              <span className="text-sm font-medium">AI Reading Plans</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 sm:gap-16 mt-20 pt-10 border-t border-border/30 max-w-2xl mx-auto w-full">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary">10K+</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">Books</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-accent">5K+</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">Readers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-secondary">95%</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">Time Saved</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
