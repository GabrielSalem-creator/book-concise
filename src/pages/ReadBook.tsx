import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Volume2, VolumeX, BookmarkPlus, Share2, ArrowLeft, Settings, Play, Pause } from "lucide-react";
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

  useEffect(() => {
    if (bookId) {
      loadBook();
      checkBookmark();
      loadReadingSession();
    }
  }, [bookId, user]);

  const loadBook = async () => {
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

    // Check if there's another active session and complete it
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
    await createOrUpdateSession();

    if (isPaused && utterance) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsReading(true);
      return;
    }

    const newUtterance = new SpeechSynthesisUtterance(summary);
    newUtterance.rate = 0.9;
    newUtterance.pitch = 1;
    newUtterance.volume = 1;

    const voice = getVoice();
    if (voice) {
      newUtterance.voice = voice;
      console.log(`Selected voice: ${voice.name}`);
    }

    let lastProgress = 0;
    newUtterance.onboundary = (event) => {
      if (event.charIndex > 0) {
        const currentProgress = (event.charIndex / summary.length) * 100;
        setProgress(currentProgress);
        
        // Update database every 10% progress
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

      // Mark as completed
      if (readingSessionId) {
        await supabase
          .from('reading_sessions')
          .update({ 
            progress_percentage: 100,
            completed_at: new Date().toISOString()
          })
          .eq('id', readingSessionId);

        // Update reading plan book status if it's part of a plan
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

          // Check if all books in the goal are completed
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
    if (utterance) {
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

  if (!book) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">{book.title}</h1>
              {book.author && (
                <p className="text-muted-foreground">{book.author}</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <Card className="p-6 bg-card/50 backdrop-blur border-border/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  {isPaused || !isReading ? (
                    <Button
                      size="lg"
                      onClick={handlePlay}
                      className="gap-2"
                    >
                      <Play className="w-5 h-5" />
                      {isPaused ? 'Resume' : 'Play'}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handlePause}
                      className="gap-2"
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </Button>
                  )}
                  
                  {(isReading || isPaused) && (
                    <Button
                      variant="outline"
                      onClick={handleStop}
                    >
                      Stop
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
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
                    className={isBookmarked ? "bg-primary text-primary-foreground" : ""}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {(isReading || isPaused || progress > 0) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </Card>

          {/* Summary Content */}
          <Card className="p-6 bg-card/50 backdrop-blur border-border/50">
            <div className="prose prose-sm md:prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {summary}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReadBook;
