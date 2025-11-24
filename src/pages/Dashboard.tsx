import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BookOpen, LogOut, Library as LibraryIcon, Compass, MessageSquare, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/BookSearch";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { DashboardStats } from "@/components/DashboardStats";
import { CurrentReading } from "@/components/CurrentReading";
import { ReadingPlan } from "@/components/ReadingPlan";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [summary, setSummary] = useState<string>("");
  const [bookTitle, setBookTitle] = useState<string>("");
  const [booksRead, setBooksRead] = useState(0);
  const [currentReading, setCurrentReading] = useState<any>(null);
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [readingPlanBooks, setReadingPlanBooks] = useState<any[]>([]);
  const [readingStreak, setReadingStreak] = useState(0);
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
      setCurrentReading({
        bookTitle: currentSession.books.title,
        bookAuthor: currentSession.books.author,
        progress: currentSession.progress_percentage || 0,
        isPaused: false,
      });
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
          id: rpb.id,
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
      <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
        <BookOpen className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Dashboard</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/library')}>
        <LibraryIcon className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Library</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/explore')}>
        <Compass className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Explore</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate('/chat')}>
        <MessageSquare className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Chat</span>
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                BookConcise
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <NavLinks />
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </nav>

            {/* Mobile Navigation */}
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <div className="flex flex-col gap-4 mt-8">
                    <NavLinks />
                    <Button variant="outline" onClick={handleSignOut} className="w-full justify-start">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar */}
      <div className="sticky top-16 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <BookSearch
            onSummaryGenerated={handleSummaryGenerated}
            initialBookName=""
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold">
              Welcome back, <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{user.email?.split('@')[0]}</span>
            </h1>
            <p className="text-muted-foreground">Track your reading journey and achieve your goals</p>
          </div>

          {/* Stats Grid */}
          <DashboardStats
            booksRead={booksRead}
            readingStreak={readingStreak}
          />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Currently Reading</h2>
                <CurrentReading
                  bookTitle={currentReading?.bookTitle}
                  bookAuthor={currentReading?.bookAuthor}
                  progress={currentReading?.progress || 0}
                  isPaused={currentReading?.isPaused || false}
                  onResume={handleResumeReading}
                  onPause={handlePauseReading}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Reading Plan</h2>
                <ReadingPlan
                  goalTitle={activeGoal?.title}
                  books={readingPlanBooks}
                />
              </div>
            </div>
          </div>

          {/* Summary Display (Full Width) */}
          {summary && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-4">Generated Summary</h2>
              <SummaryDisplay summary={summary} bookTitle={bookTitle} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;