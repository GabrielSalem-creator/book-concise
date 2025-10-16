import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BookOpen, Sparkles, LogOut, User, Library as LibraryIcon, Compass, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/BookSearch";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PersonalizedBooks } from "@/components/PersonalizedBooks";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [summary, setSummary] = useState<string>("");
  const [bookTitle, setBookTitle] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else {
      checkUserPreferences();
    }
  }, [user, navigate]);

  const checkUserPreferences = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_preferences")
      .select("themes, completed_onboarding")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data || !data.completed_onboarding || !data.themes?.length) {
      setHasPreferences(false);
      setShowOnboarding(true);
    } else {
      setHasPreferences(true);
      setShowOnboarding(false);
    }
  };

  // Handle incoming summary from Explore/Library and auth redirect fallback
  useEffect(() => {
    if (location.state?.summary) {
      setSummary(location.state.summary);
      setBookTitle(location.state.bookTitle || "");
      // Clear the state to prevent re-loading on refresh
      window.history.replaceState({}, document.title);
    } else {
      const pendingSummary = localStorage.getItem('pendingSummary');
      const pendingBookTitle = localStorage.getItem('pendingBookTitle');
      if (pendingSummary) {
        setSummary(pendingSummary);
        setBookTitle(pendingBookTitle || "");
        localStorage.removeItem('pendingSummary');
        localStorage.removeItem('pendingBookTitle');
      }
    }
  }, [location]);

  const handleSummaryGenerated = (newSummary: string, title: string) => {
    setSummary(newSummary);
    setBookTitle(title);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate("/landing");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm bg-background/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3">
            <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              BookConcise
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/explore")}
              className="hover:bg-accent/10"
            >
              <Compass className="w-4 h-4 mr-2" />
              Explore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/library")}
              className="hover:bg-primary/10"
            >
              <LibraryIcon className="w-4 h-4 mr-2" />
              Library
            </Button>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden lg:inline truncate max-w-[150px]">{user.email}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Sign Out</span>
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center space-x-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col space-y-4 mt-8">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground pb-4 border-b">
                    <User className="w-4 h-4" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate("/explore")}
                  >
                    <Compass className="w-4 h-4 mr-2" />
                    Explore
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate("/library")}
                  >
                    <LibraryIcon className="w-4 h-4 mr-2" />
                    Library
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start hover:bg-destructive hover:text-destructive-foreground"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center space-y-4 mb-8 md:mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-primary" />
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-accent" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Welcome back!
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform any book into a concise, AI-powered summary. Search, extract, and listen to key insights in seconds.
          </p>
        </div>

        {/* Search Component */}
        <div className="max-w-4xl mx-auto mb-12">
          <BookSearch onSummaryGenerated={handleSummaryGenerated} />
        </div>

        {/* Summary Display */}
        {summary && !showOnboarding && (
          <div className="max-w-4xl mx-auto">
            <SummaryDisplay summary={summary} bookTitle={bookTitle} />
          </div>
        )}

        {/* Onboarding MCQ */}
        {showOnboarding && (
          <div className="max-w-4xl mx-auto">
            <PersonalizedBooks 
              onBookSelect={(title) => {
                setBookTitle(title);
                const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                if (searchInput) {
                  searchInput.value = title;
                  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }}
              showOnboarding={true}
              onOnboardingComplete={() => {
                setShowOnboarding(false);
                setHasPreferences(true);
                checkUserPreferences();
              }}
            />
          </div>
        )}

        {/* Personalized Book Recommendations */}
        {!summary && !showOnboarding && hasPreferences && (
          <div className="max-w-7xl mx-auto mt-12">
            <PersonalizedBooks 
              onBookSelect={(title) => {
                setBookTitle(title);
                const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                if (searchInput) {
                  searchInput.value = title;
                  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
