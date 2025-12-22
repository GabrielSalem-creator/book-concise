import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookmarkPlus, Share2, ArrowLeft, Settings, Play, Pause, StopCircle, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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
  const [savedCharPosition, setSavedCharPosition] = useState(0);
  const [ttsInitialized, setTtsInitialized] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  
  // Ref to track if we're in iOS WebView
  const isIOSWebView = useRef(
    typeof navigator !== 'undefined' && 
    /iPhone|iPad|iPod/.test(navigator.userAgent) && 
    !(navigator as any).standalone
  );

  // Initialize TTS on first user interaction (required for iOS WebView)
  const initializeTTS = useCallback(() => {
    if (ttsInitialized) return;
    
    try {
      // For iOS WebView, we need to trigger speech synthesis with user gesture
      const silentUtterance = new SpeechSynthesisUtterance(' ');
      silentUtterance.volume = 0.01; // Very quiet but not silent (iOS quirk)
      silentUtterance.rate = 10; // Fast to complete quickly
      
      // Some iOS versions need the utterance to actually complete
      silentUtterance.onend = () => {
        window.speechSynthesis.cancel();
      };
      
      window.speechSynthesis.speak(silentUtterance);
      
      // Pre-load voices with a slight delay for iOS
      setTimeout(() => {
        window.speechSynthesis.getVoices();
      }, 100);
      
      setTtsInitialized(true);
    } catch (e) {
      console.warn('TTS initialization failed:', e);
    }
  }, [ttsInitialized]);

  // Cleanup: Stop audio when leaving the page
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);
  
  // Initialize TTS on mount with user gesture for iOS
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeTTS();
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
    
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
  }, [initializeTTS]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldSearch = params.get('search') === 'true';
    
    if (bookId && user) {
      if (shouldSearch) {
        searchAndLoadBook();
      } else {
        loadBook();
      }
      checkBookmark();
      loadReadingSession();
      // Create reading session immediately when page loads
      createInitialSession();
    }
  }, [bookId, user]);

  const createInitialSession = async () => {
    if (!user || !bookId) return;

    // Check if there's already an active session for this book
    const { data: existingSession } = await supabase
      .from('reading_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .is('completed_at', null)
      .maybeSingle();

    if (existingSession) {
      setReadingSessionId(existingSession.id);
      return;
    }

    // Complete other active sessions
    await supabase
      .from('reading_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('completed_at', null)
      .neq('book_id', bookId);

    // Create new session
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
  };

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

    // If book exists but no summary, generate it
    if (existingBook) {
      toast({
        title: "Generating summary",
        description: "Please wait while we generate the book summary...",
      });

      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
        body: { bookTitle: existingBook.title, bookId: existingBook.id }
      });

    if (summaryError || !summaryData?.summary) {
      // Check if it's a credit error by looking at the response
      const errorMessage = summaryData?.error || summaryError?.message || '';
      const isCreditsError = errorMessage.includes('No credits remaining') || 
                            summaryData?.creditsRemaining === 0;
      
      if (isCreditsError) {
        toast({
          title: "Daily limit reached",
          description: "You've used your 2 daily summary credits. They reset tomorrow!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate summary",
          variant: "destructive",
        });
      }
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
      setIsLoading(false);
      return;
    }

    // If book doesn't exist at all, search for it using the title from reading plan
    const { data: planBook } = await supabase
      .from('reading_plan_books')
      .select('books(title)')
      .eq('book_id', bookId)
      .single();

    if (!planBook?.books?.title) {
      toast({
        title: "Error",
        description: "Book not found in reading plan",
        variant: "destructive",
      });
      navigate('/dashboard');
      setIsLoading(false);
      return;
    }

    const bookTitle = planBook.books.title;

    toast({
      title: "Searching for book",
      description: `Finding "${bookTitle}"...`,
    });

    // Search for the PDF
    const { data: pdfData, error: pdfError } = await supabase.functions.invoke('search-book-pdf', {
      body: { query: bookTitle }
    });

    if (pdfError || !pdfData?.pdfUrl) {
      toast({
        title: "Error",
        description: "Could not find book PDF",
        variant: "destructive",
      });
      navigate('/dashboard');
      setIsLoading(false);
      return;
    }

    // Update the book with the PDF URL
    const { error: updateError } = await supabase
      .from('books')
      .update({ pdf_url: pdfData.pdfUrl })
      .eq('id', bookId);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to save book PDF",
        variant: "destructive",
      });
      navigate('/dashboard');
      setIsLoading(false);
      return;
    }

    toast({
      title: "Generating summary",
      description: "Please wait while we generate the book summary...",
    });

    // Generate the summary
    const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
      body: { bookTitle, bookId }
    });

    if (summaryError || !summaryData?.summary) {
      // Check if it's a credit error by looking at the response
      const errorMessage = summaryData?.error || summaryError?.message || '';
      const isCreditsError = errorMessage.includes('No credits remaining') || 
                            summaryData?.creditsRemaining === 0;
      
      if (isCreditsError) {
        toast({
          title: "Daily limit reached",
          description: "You've used your 2 daily summary credits. They reset tomorrow!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate summary",
          variant: "destructive",
        });
      }
      navigate('/dashboard');
      setIsLoading(false);
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

    // Load the complete book data
    const { data: finalBook } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    setBook(finalBook);
    setSummary(cleanSummary);
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
    
    // If summary exists, use it (no credits consumed)
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
      setIsLoading(false);
      return;
    }

    // No summary exists - generate one (will consume credits)
    toast({
      title: "Generating summary",
      description: "Please wait while we generate the book summary...",
    });

    const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
      body: { bookTitle: data.title, bookAuthor: data.author, bookId: data.id }
    });

    if (summaryError || !summaryData?.summary) {
      const errorMessage = summaryData?.error || summaryError?.message || '';
      const isCreditsError = errorMessage.includes('No credits remaining') || 
                            summaryData?.creditsRemaining === 0;
      
      if (isCreditsError) {
        toast({
          title: "Daily limit reached",
          description: "You've used your 2 daily summary credits. They reset tomorrow!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate summary",
          variant: "destructive",
        });
      }
      navigate('/dashboard');
      setIsLoading(false);
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
    
    setSummary(cleanSummary);
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
      // Restore character position from last_position
      if (data.last_position) {
        const charPos = parseInt(data.last_position, 10);
        setSavedCharPosition(charPos);
      }
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
    
    // Prioritize high-quality voices (premium/enhanced voices)
    const premiumVoiceNames = [
      // iOS Premium Voices
      'Samantha', 'Karen', 'Daniel', 'Moira', 'Tessa', 'Rishi', 'Veena',
      // macOS Premium Voices  
      'Alex', 'Ava', 'Allison', 'Susan', 'Tom', 'Oliver', 'Kate',
      // Windows Premium Voices
      'Zira', 'David', 'Mark', 'Hazel', 'George', 'Susan',
      // Google Premium Voices
      'Google US English', 'Google UK English Female', 'Google UK English Male',
      // Android Voices
      'English United States', 'English United Kingdom'
    ];
    
    // Filter for high-quality English voices first
    const englishVoices = voices.filter(v => 
      v.lang.startsWith('en') || v.lang === 'en-US' || v.lang === 'en-GB'
    );
    
    // Find premium voices that match gender preference
    const findPremiumVoice = (gender: 'male' | 'female' | 'any') => {
      const genderKeywords = {
        female: ['Samantha', 'Karen', 'Ava', 'Allison', 'Susan', 'Zira', 'Kate', 'Hazel', 'Moira', 'Tessa', 'Veena', 'Female'],
        male: ['Daniel', 'Alex', 'David', 'Tom', 'Oliver', 'Mark', 'George', 'Rishi', 'Male']
      };
      
      // First try premium voices
      for (const premiumName of premiumVoiceNames) {
        const match = englishVoices.find(v => v.name.includes(premiumName));
        if (match) {
          if (gender === 'any') return match;
          const keywords = genderKeywords[gender];
          if (keywords.some(k => match.name.includes(k))) return match;
        }
      }
      
      // Fallback to any English voice with gender match
      if (gender !== 'any') {
        const keywords = genderKeywords[gender];
        const genderMatch = englishVoices.find(v => 
          keywords.some(k => v.name.toLowerCase().includes(k.toLowerCase()))
        );
        if (genderMatch) return genderMatch;
      }
      
      // Final fallback: first English voice or any voice
      return englishVoices[0] || voices[0] || null;
    };

    if (selectedVoice === "female") {
      return findPremiumVoice('female');
    } else if (selectedVoice === "male") {
      return findPremiumVoice('male');
    } else {
      // Random: pick best available
      return findPremiumVoice('any');
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

    // Helper function to start speech with voice
    const startSpeech = (voice: SpeechSynthesisVoice | null) => {
      // If we have a saved position, start from there
      const startPos = savedCharPosition > 0 ? savedCharPosition : 0;
      const textToRead = startPos > 0 ? summary.substring(startPos) : summary;
      
      const newUtterance = new SpeechSynthesisUtterance(textToRead);
      newUtterance.rate = 0.9;
      newUtterance.pitch = 1;
      newUtterance.volume = 1;
      
      if (voice) {
        newUtterance.voice = voice;
      }

      let lastProgress = startPos > 0 ? (startPos / summary.length) * 100 : 0;
      
      newUtterance.onboundary = (event) => {
        if (event.charIndex >= 0) {
          // Calculate actual character position in the full summary
          const actualCharPos = startPos + event.charIndex;
          const currentProgress = (actualCharPos / summary.length) * 100;
          setProgress(currentProgress);
          setSavedCharPosition(actualCharPos);
          
          if (currentProgress - lastProgress >= 10 && readingSessionId) {
            lastProgress = currentProgress;
            supabase
              .from('reading_sessions')
              .update({ 
                progress_percentage: currentProgress,
                last_position: actualCharPos.toString(),
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
        setSavedCharPosition(0);

        // Handle book completion and redirect
        await handleBookCompletion();
      };

      newUtterance.onerror = (event) => {
        // Only show error for actual failures, not interruptions
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          setIsReading(false);
          setIsPaused(false);
          toast({
            title: "Audio Error",
            description: "Could not play audio. Try selecting a different voice.",
            variant: "destructive",
          });
        }
      };

      setUtterance(newUtterance);
      window.speechSynthesis.speak(newUtterance);
      setIsReading(true);
      setIsPaused(false);
    };

    // Load voices and start speech
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Wait for voices to load
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        const voice = getVoice();
        startSpeech(voice);
      };
      // Also set a timeout in case onvoiceschanged doesn't fire
      setTimeout(() => {
        if (!isReading) {
          voices = window.speechSynthesis.getVoices();
          const voice = getVoice();
          startSpeech(voice);
        }
      }, 100);
    } else {
      const voice = getVoice();
      startSpeech(voice);
    }
  };

  const handlePause = async () => {
    if (isReading) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsReading(false);
      
      // Save current position to database
      if (readingSessionId) {
        await supabase
          .from('reading_sessions')
          .update({ 
            progress_percentage: progress,
            last_position: savedCharPosition.toString(),
            last_read_at: new Date().toISOString()
          })
          .eq('id', readingSessionId);
      }
    }
  };

  const handleStop = async () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    setUtterance(null);
    setSavedCharPosition(0);
    setProgress(0);
    
    // Reset position in database
    if (readingSessionId) {
      await supabase
        .from('reading_sessions')
        .update({ 
          progress_percentage: 0,
          last_position: '0',
          last_read_at: new Date().toISOString()
        })
        .eq('id', readingSessionId);
    }
  };

  // Handle book completion - mark as finished and redirect
  const handleBookCompletion = async () => {
    if (!readingSessionId || !bookId) return;

    const bookTitle = book?.title || "the book";

    // Mark session as completed
    await supabase
      .from('reading_sessions')
      .update({ 
        progress_percentage: 100,
        last_position: '0',
        completed_at: new Date().toISOString()
      })
      .eq('id', readingSessionId);

    // Check if this book is part of a reading plan
    const { data: planBook } = await supabase
      .from('reading_plan_books')
      .select('id, goal_id')
      .eq('book_id', bookId)
      .maybeSingle();

    if (planBook) {
      // Mark book as completed in the plan
      await supabase
        .from('reading_plan_books')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', planBook.id);

      // Check if all books in the plan are completed
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

    // Show completion toast with book title
    toast({
      title: "Congratulations! 🎉",
      description: `You successfully finished "${bookTitle}"`,
    });

    // Redirect to dashboard immediately
    navigate('/dashboard');
  };

  // Seek to a specific position in the audio
  const handleSeek = async (newProgress: number[]) => {
    if (!summary) return;
    
    const targetProgress = newProgress[0];
    const newCharPosition = Math.floor((targetProgress / 100) * summary.length);
    
    // Stop current speech
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    setUtterance(null);
    
    // Update state
    setProgress(targetProgress);
    setSavedCharPosition(newCharPosition);
    
    // If reached 100%, complete the book
    if (targetProgress >= 100) {
      await handleBookCompletion();
      return;
    }
    
    // Save position to database
    if (readingSessionId) {
      await supabase
        .from('reading_sessions')
        .update({ 
          progress_percentage: targetProgress,
          last_position: newCharPosition.toString(),
          last_read_at: new Date().toISOString()
        })
        .eq('id', readingSessionId);
    }
  };

  // Skip forward/backward by a percentage
  const handleSkip = (direction: 'forward' | 'backward') => {
    const skipAmount = 10; // 10% skip
    let newProgress = direction === 'forward' 
      ? Math.min(100, progress + skipAmount)
      : Math.max(0, progress - skipAmount);
    
    handleSeek([newProgress]);
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
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-4xl">
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="hover-lift shrink-0 h-9 w-9 sm:h-10 sm:w-10"
              aria-label="Go back to dashboard"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent break-words">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-sm sm:text-base text-muted-foreground mt-1 truncate">{book.author}</p>
              )}
            </div>
          </div>

          {/* Controls Card */}
          <Card className="glass-morphism p-4 sm:p-6 lg:p-8 border-primary/20 hover-lift glow-effect">
            <div className="space-y-4 sm:space-y-6">
              {/* Seekable Progress Slider - Always show when there's content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{Math.round(progress)}%</span>
                </div>
                
                {/* Skip Controls + Slider */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSkip('backward')}
                    className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                    aria-label="Skip backward 10%"
                    disabled={progress <= 0}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex-1 relative touch-pan-x">
                    <Slider
                      value={[progress]}
                      onValueChange={handleSeek}
                      max={100}
                      step={1}
                      className="w-full cursor-pointer"
                      aria-label="Seek through the audio"
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSkip('forward')}
                    className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                    aria-label="Skip forward 10%"
                    disabled={progress >= 100}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Main Controls - Stack on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                {/* Play/Pause Controls */}
                <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  {isPaused || !isReading ? (
                    <Button
                      size="lg"
                      onClick={handlePlay}
                      className="gap-2 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-opacity px-6 sm:px-8 h-12 sm:h-14 glow-effect min-w-[140px]"
                      aria-label={isPaused ? 'Resume reading' : 'Start reading'}
                    >
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-base sm:text-lg">{isPaused ? 'Resume' : 'Play'}</span>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={handlePause}
                      className="gap-2 px-6 sm:px-8 h-12 sm:h-14 min-w-[140px]"
                      aria-label="Pause reading"
                    >
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-base sm:text-lg">Pause</span>
                    </Button>
                  )}
                  
                  {(isReading || isPaused || progress > 0) && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleStop}
                      className="gap-2 hover-lift h-12 sm:h-14 px-4"
                      aria-label="Stop and reset"
                    >
                      <StopCircle className="w-5 h-5" />
                      <span className="hidden sm:inline">Reset</span>
                    </Button>
                  )}
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="hover-lift h-10 w-10 sm:h-11 sm:w-11" aria-label="Voice settings">
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
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
                    className={`hover-lift h-10 w-10 sm:h-11 sm:w-11 ${isBookmarked ? "bg-primary/20 text-primary border-primary/30" : ""}`}
                    aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                  >
                    <BookmarkPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    className="hover-lift h-10 w-10 sm:h-11 sm:w-11"
                    aria-label="Copy summary to clipboard"
                  >
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Summary Content */}
          <Card className="glass-morphism p-4 sm:p-6 lg:p-8 border-primary/20">
            <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 text-sm sm:text-base lg:text-lg break-words">
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
