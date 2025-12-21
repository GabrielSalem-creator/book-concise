import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Moon, LogOut, Library as LibraryIcon, Compass, MessageSquare, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/BookSearch";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { CurrentReading } from "@/components/CurrentReading";
import { ReadingPlan } from "@/components/ReadingPlan";
import { ReadingPlanPopup } from "@/components/ReadingPlanPopup";
import { AccountSettings } from "@/components/AccountSettings";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [summary, setSummary] = useState<string>("");
  const [bookTitle, setBookTitle] = useState<string>("");
  const [booksRead, setBooksRead] = useState(0);
  const [currentBook, setCurrentBook] = useState<any>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [readingPlanBooks, setReadingPlanBooks] = useState<any[]>([]);
  const [readingStreak, setReadingStreak] = useState(0);
  const [showSearch, setShowSearch] = useState(true);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const lastScrollY = useRef(0);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else {
      loadDashboardData();
    }
  }, [user, navigate]);

  useEffect(() => {
    if (location.state?.summary) {
      setSummary(location.state.summary);
      setBookTitle(location.state.bookTitle || "");
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Scroll handler for search bar visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowSearch(false);
      } else {
        setShowSearch(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;

    // Load books read count
    const { count: completedCount } = await supabase
      .from('reading_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);
    
    setBooksRead(completedCount || 0);

    // Load current reading session
    const { data: currentSession } = await supabase
      .from('reading_sessions')
      .select('*, books(*)')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('last_read_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentSession) {
      setCurrentBook({
        id: currentSession.books.id,
        title: currentSession.books.title,
        author: currentSession.books.author,
      });
      setCurrentProgress(currentSession.progress_percentage || 0);
    }

    // Load active goal and reading plan
    const { data: goal } = await supabase
      .from('goals')
      .select('*, reading_plan_books(*, books(*))')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goal) {
      setActiveGoal(goal);
      setReadingPlanBooks(
        goal.reading_plan_books.map((rpb: any) => ({
          id: rpb.books.id,
          title: rpb.books.title,
          author: rpb.books.author,
          status: rpb.status,
          orderIndex: rpb.order_index,
        })).sort((a: any, b: any) => a.orderIndex - b.orderIndex)
      );
    }

    // Calculate reading streak (simplified - just show days with activity)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentSessions } = await supabase
      .from('reading_sessions')
      .select('last_read_at')
      .eq('user_id', user.id)
      .gte('last_read_at', thirtyDaysAgo.toISOString());

    if (recentSessions) {
      const uniqueDays = new Set(
        recentSessions.map(s => new Date(s.last_read_at).toDateString())
      );
      setReadingStreak(uniqueDays.size);
    }
  };

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

  const handleDeletePlan = async () => {
    if (!activeGoal) return;
    
    try {
      // Delete reading plan books first
      await supabase
        .from('reading_plan_books')
        .delete()
        .eq('goal_id', activeGoal.id);
      
      // Delete the goal
      await supabase
        .from('goals')
        .delete()
        .eq('id', activeGoal.id);
      
      // Clear local state
      setActiveGoal(null);
      setReadingPlanBooks([]);
      
      toast({
        title: "Plan deleted",
        description: "Your reading plan has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plan. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResumeReading = () => {
    toast({
      title: "Resuming reading",
      description: "Continue where you left off",
    });
  };

  const handlePauseReading = () => {
    toast({
      title: "Reading paused",
      description: "Progress saved automatically",
    });
  };

  if (!user) {
    return null;
  }

  const NavLinks = () => (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} aria-label="Go to Dashboard">
        <Moon className="w-4 h-4 mr-2" aria-hidden="true" />
        Dashboard
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/library')} aria-label="Go to Library">
        <LibraryIcon className="w-4 h-4 mr-2" aria-hidden="true" />
        Library
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/explore')} aria-label="Go to Explore">
        <Compass className="w-4 h-4 mr-2" aria-hidden="true" />
        Explore
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/chat')} aria-label="Go to Chat">
        <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
        Chat
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Skip to content link for screen readers */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Header with Stats */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20" role="banner">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <Moon className="w-5 h-5 sm:w-7 sm:h-7 text-primary glow-effect" aria-hidden="true" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Nocturn
                </h1>
              </div>
              
              {/* Stats in Header */}
              <div className="hidden md:flex items-center gap-2 lg:gap-4" role="status" aria-label="Reading statistics">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg glass-morphism border border-primary/20">
                  <span className="text-xs text-muted-foreground">Books:</span>
                  <span className="text-sm font-bold text-primary" aria-label={`${booksRead} books completed`}>{booksRead}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg glass-morphism border border-accent/20">
                  <span className="text-xs text-muted-foreground">Streak:</span>
                  <span className="text-sm font-bold text-accent" aria-label={`${readingStreak} day reading streak`}>{readingStreak}</span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
              <NavLinks />
              <ThemeToggle />
              <AccountSettings />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut} 
                className="hover-lift"
                aria-label="Sign out of your account"
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Sign Out
              </Button>
            </nav>

            {/* Mobile Navigation */}
            <div className="flex lg:hidden items-center gap-1.5">
              <ThemeToggle />
              <AccountSettings />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open navigation menu">
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="glass-morphism w-[280px]" aria-label="Navigation menu">
                  <nav className="flex flex-col gap-3 mt-6" aria-label="Mobile navigation">
                    <div className="flex gap-2 mb-3" role="status" aria-label="Reading statistics">
                      <div className="flex-1 text-center p-2 rounded-lg glass-morphism border border-primary/20">
                        <div className="text-xl font-bold text-primary" aria-label={`${booksRead} books completed`}>{booksRead}</div>
                        <div className="text-xs text-muted-foreground">Books</div>
                      </div>
                      <div className="flex-1 text-center p-2 rounded-lg glass-morphism border border-accent/20">
                        <div className="text-xl font-bold text-accent" aria-label={`${readingStreak} day streak`}>{readingStreak}</div>
                        <div className="text-xs text-muted-foreground">Streak</div>
                      </div>
                    </div>
                    <NavLinks />
                    <Button 
                      variant="outline" 
                      onClick={handleSignOut} 
                      className="w-full justify-start"
                      aria-label="Sign out of your account"
                    >
                      <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                      Sign Out
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Compact Sticky Search Bar with scroll visibility */}
      <div 
        className={`sticky top-14 sm:top-16 z-40 glass-morphism border-b border-primary/20 transition-all duration-300 ${
          showSearch ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          {searchExpanded ? (
            <BookSearch
              onSummaryGenerated={handleSummaryGenerated}
              initialBookName=""
              compact
            />
          ) : (
            <Button
              variant="outline"
              className="w-full h-10 sm:h-11 justify-start text-muted-foreground hover:text-foreground border-primary/20 bg-background/50"
              onClick={() => setSearchExpanded(true)}
              aria-label="Click to search for a book"
            >
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              <span className="text-sm">Search for a book...</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8" role="main">
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Left Column */}
            <section className="space-y-3 sm:space-y-4" aria-labelledby="currently-reading-heading">
              <h2 id="currently-reading-heading" className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Currently Reading
              </h2>
              <CurrentReading
                bookId={currentBook?.id}
                bookTitle={currentBook?.title}
                bookAuthor={currentBook?.author}
                progress={currentProgress}
                isPaused={false}
                onResume={handleResumeReading}
                onPause={handlePauseReading}
              />
            </section>

            {/* Right Column */}
            <section className="space-y-3 sm:space-y-4" aria-labelledby="reading-plan-heading">
              <h2 id="reading-plan-heading" className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                Reading Plan
              </h2>
              <ReadingPlan
                goalId={activeGoal?.id}
                goalTitle={activeGoal?.title}
                books={readingPlanBooks}
                onDeletePlan={handleDeletePlan}
              />
            </section>
          </div>

          {/* Summary Display (Full Width) */}
          {summary && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="text-lg sm:text-xl lg:text-2xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Generated Summary
              </h2>
              <SummaryDisplay summary={summary} bookTitle={bookTitle} />
            </section>
          )}
        </div>
      </main>

      {/* Reading Plan Popup for new users */}
      <ReadingPlanPopup />
    </div>
  );
};

export default Dashboard;