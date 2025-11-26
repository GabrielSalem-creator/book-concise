import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookmarkPlus, Share2, ArrowLeft, Settings, Play, Pause, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ReadBook = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [book, setBook] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<"random" | "male" | "female">("random");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldSearch = params.get('search') === 'true';
    
    if (bookId) {
      if (shouldSearch) {
        searchAndLoadBook();
      } else {
        loadBook();
      }
      checkBookmark();
      loadReadingSession();
    }
  }, [bookId, user]);

  const searchAndLoadBook = async () => {
    setIsLoading(true);
    
    // First try to load the book directly
    const { data: existingBook, error: bookError } = await supabase
      .from('books')
      .select(`
        *,
        summaries (content)
      `)
      .eq('id', bookId)
      .single();

    if (existingBook && existingBook.summaries && existingBook.summaries.length > 0) {
      setBook(existingBook);
      const cleanSummary = existingBook.summaries[0].content
        .replace(/#+\s/g, '')
        .replace(/[-*_]{2,}/g, '')
        .replace(/^\s*[-*]\s/gm, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
      setSummary(cleanSummary);
      setIsLoading(false);
      return;
    }

    // If no summary exists, search and generate
    if (existingBook) {
      toast({
        title: "Generating summary",
        description: "Please wait while we generate the book summary...",
      });

      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
        body: { bookTitle: existingBook.title, bookId: existingBook.id }
      });

      if (summaryError || !summaryData?.summary) {
        toast({
          title: "Error",
          description: "Failed to generate summary",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      const cleanSummary = summaryData.summary
        .replace(/#+\s/g, '')
        .replace(/[-*_]{2,}/g, '')
        .replace(/^\s*[-*]\s/gm, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
      
      setBook(existingBook);
      setSummary(cleanSummary);
    } else {
      toast({
        title: "Error",
        description: "Book not found",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const loadBook = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select(`
        *,
        summaries (content)
      `)
      .eq('id', bookId)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to load book",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    setBook(data);
    if (data.summaries && data.summaries.length > 0) {
      const cleanSummary = data.summaries[0].content
        .replace(/#+\s/g, '')
        .replace(/[-*_]{2,}/g, '')
        .replace(/^\s*[-*]\s/gm, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
      setSummary(cleanSummary);
    }
    setIsLoading(false);
  };

  const loadReadingSession = async () => {
    if (!user || !bookId) return;

    const { data } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .is('completed_at', null)
      .maybeSingle();

    if (data) {
      setReadingSessionId(data.id);
      setProgress(data.progress_percentage || 0);
    }
  };

  const checkBookmark = async () => {
    if (!user || !bookId) return;

    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle();

    setIsBookmarked(!!data);
  };

  const createOrUpdateSession = async () => {
    if (!user || !bookId) return;

    // Complete other active sessions
    const { data: activeSessions } = await supabase
      .from('reading_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .neq('book_id', bookId);

    if (activeSessions && activeSessions.length > 0) {
      await supabase
        .from('reading_sessions')
        .update({ completed_at: new Date().toISOString() })
        .in('id', activeSessions.map(s => s.id));
    }

    // Create or update current session
    if (readingSessionId) {
      await supabase
        .from('reading_sessions')
        .update({ last_read_at: new Date().toISOString() })
        .eq('id', readingSessionId);
    } else {
      const { data: newSession } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: user.id,
          book_id: bookId,
          progress_percentage: 0,
        })
        .select()
        .single();

      if (newSession) {
        setReadingSessionId(newSession.id);
      }
    }
  };

  const getVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    
    const femaleVoices = voices.filter(voice => 
      voice.name.toLowerCase().includes('female') || 
      voice.name.toLowerCase().includes('woman') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Victoria') ||
      voice.name.includes('Karen') ||
      voice.name.includes('Zira')
    );
    
    const maleVoices = voices.filter(voice => 
      voice.name.toLowerCase().includes('male') || 
      voice.name.toLowerCase().includes('man') ||
      voice.name.includes('Daniel') ||
      voice.name.includes('Alex') ||
      voice.name.includes('Fred') ||
      voice.name.includes('David')
    );

    if (selectedVoice === "female" && femaleVoices.length > 0) {
      return femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
    } else if (selectedVoice === "male" && maleVoices.length > 0) {
      return maleVoices[Math.floor(Math.random() * maleVoices.length)];
    } else {
      const useFemale = Math.random() > 0.5;
      const selectedVoices = useFemale ? femaleVoices : maleVoices;
      return selectedVoices.length > 0 
        ? selectedVoices[Math.floor(Math.random() * selectedVoices.length)]
        : null;
    }
  };

  const handlePlay = async () => {
    if (!summary) {
      toast({
        title: "No content",
        description: "No summary available to read",
        variant: "destructive",
      });
      return;
    }

    await createOrUpdateSession();

    if (isPaused && utterance) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsReading(true);
      return;
    }

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    const newUtterance = new SpeechSynthesisUtterance(summary);
    newUtterance.rate = 0.9;
    newUtterance.pitch = 1;
    newUtterance.volume = 1;

    // Load voices and select one
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Wait for voices to load
      window.speechSynthesis.onvoiceschanged = () => {
        const voice = getVoice();
        if (voice) {
          newUtterance.voice = voice;
        }
      };
    } else {
      const voice = getVoice();
      if (voice) {
        newUtterance.voice = voice;
      }
    }

    let lastProgress = 0;
    newUtterance.onboundary = (event) => {
      if (event.charIndex > 0) {
        const currentProgress = (event.charIndex / summary.length) * 100;
        setProgress(currentProgress);
        
        if (currentProgress - lastProgress >= 10 && readingSessionId) {
          lastProgress = currentProgress;
          supabase
            .from('reading_sessions')
            .update({ 
              progress_percentage: currentProgress,
              last_read_at: new Date().toISOString()
            })
            .eq('id', readingSessionId)
            .then();
        }
      }
    };

    newUtterance.onend = async () => {
      setIsReading(false);
      setIsPaused(false);
      setProgress(100);

      if (readingSessionId) {
        await supabase
          .from('reading_sessions')
          .update({ 
            progress_percentage: 100,
            completed_at: new Date().toISOString()
          })
          .eq('id', readingSessionId);

        const { data: planBook } = await supabase
          .from('reading_plan_books')
          .select('id, goal_id')
          .eq('book_id', bookId)
          .eq('status', 'reading')
          .maybeSingle();

        if (planBook) {
          await supabase
            .from('reading_plan_books')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', planBook.id);

          const { data: allPlanBooks } = await supabase
            .from('reading_plan_books')
            .select('status')
            .eq('goal_id', planBook.goal_id);

          const allCompleted = allPlanBooks?.every(b => b.status === 'completed');
          if (allCompleted) {
            await supabase
              .from('goals')
              .update({ 
                status: 'completed',
                completed_at: new Date().toISOString()
              })
              .eq('id', planBook.goal_id);
          }
        }

        toast({
          title: "Book completed!",
          description: "This book has been marked as completed.",
        });
      }
    };

    newUtterance.onerror = () => {
      setIsReading(false);
      setIsPaused(false);
      toast({
        title: "Error",
        description: "Failed to read summary",
        variant: "destructive",
      });
    };

    setUtterance(newUtterance);
    window.speechSynthesis.speak(newUtterance);
    setIsReading(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (utterance && isReading) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsReading(false);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    setUtterance(null);
  };

  const handleBookmark = async () => {
    if (!user || !bookId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save bookmarks",
        variant: "destructive",
      });
      return;
    }

    if (isBookmarked) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('book_id', bookId);

      if (!error) {
        setIsBookmarked(false);
        toast({
          title: "Removed",
          description: "Book removed from library",
        });
      }
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          book_id: bookId,
        });

      if (error && error.code !== '23505') {
        toast({
          title: "Error",
          description: "Failed to save bookmark",
          variant: "destructive",
        });
      } else {
        setIsBookmarked(true);
        toast({
          title: "Saved!",
          description: "Book added to your library",
        });
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(summary);
    toast({
      title: "Copied!",
      description: "Summary copied to clipboard",
    });
  };

  if (isLoading || !book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4 glow-effect"></div>
          <p className="text-muted-foreground">Loading book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="hover-lift"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-muted-foreground mt-1 text-lg">{book.author}</p>
              )}
            </div>
          </div>

          {/* Controls Card */}
          <Card className="glass-morphism p-8 border-primary/20 hover-lift glow-effect">
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {isPaused || !isReading ? (
                    <Button
                      size="lg"
                      onClick={handlePlay}
                      className="gap-2 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-opacity px-8 glow-effect"
                    >
                      <Play className="w-5 h-5" />
                      {isPaused ? 'Resume' : 'Play'}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={handlePause}
                      className="gap-2 px-8"
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </Button>
                  )}
                  
                  {(isReading || isPaused) && (
                    <Button
                      variant="outline"
                      onClick={handleStop}
                      className="gap-2 hover-lift"
                    >
                      <StopCircle className="w-4 h-4" />
                      Stop
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="hover-lift">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="glass-morphism">
                      <DropdownMenuItem onClick={() => setSelectedVoice("random")}>
                        Random Voice {selectedVoice === "random" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedVoice("male")}>
                        Male Voice {selectedVoice === "male" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedVoice("female")}>
                        Female Voice {selectedVoice === "female" && "✓"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBookmark}
                    className={`hover-lift ${isBookmarked ? "bg-primary/20 text-primary border-primary/30" : ""}`}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    className="hover-lift"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {(isReading || isPaused || progress > 0) && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500 glow-effect"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Summary Content */}
          <Card className="glass-morphism p-8 border-primary/20">
            <div className="prose prose-lg max-w-none prose-invert">
              <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 text-lg">
                {summary || "No summary available for this book."}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReadBook;
