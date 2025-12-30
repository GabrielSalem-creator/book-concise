import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookmarkPlus, Share2, ArrowLeft, Settings, Play, Pause, StopCircle, SkipBack, SkipForward, CheckCircle, Download, ExternalLink, FileText, Headphones, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import BookChat from "@/components/BookChat";
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
  const [isCompleting, setIsCompleting] = useState(false);
  const hasCompletedRef = useRef(false);
  
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

  // Auto-complete when progress reaches 100%
  useEffect(() => {
    if (progress >= 100 && !hasCompletedRef.current && !isCompleting && readingSessionId) {
      handleBookCompletion();
    }
  }, [progress, readingSessionId, isCompleting]);

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
    // Only check hasCompletedRef to prevent multiple triggers
    if (hasCompletedRef.current) return;
    
    hasCompletedRef.current = true;
    setIsCompleting(true);
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);

    const bookTitle = book?.title || "the book";

    // Mark session as completed if we have a session
    if (readingSessionId) {
      await supabase
        .from('reading_sessions')
        .update({ 
          progress_percentage: 100,
          last_position: '0',
          completed_at: new Date().toISOString()
        })
        .eq('id', readingSessionId);
    }

    // Check if this book is part of a reading plan for the current user
    if (user && bookId) {
      const { data: planBooks } = await supabase
        .from('reading_plan_books')
        .select('id, goal_id, goals!inner(user_id)')
        .eq('book_id', bookId);

      // Find the plan book that belongs to the current user
      const userPlanBook = planBooks?.find((pb: any) => pb.goals?.user_id === user.id);

      if (userPlanBook) {
        // Mark book as completed in the plan
        await supabase
          .from('reading_plan_books')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', userPlanBook.id);

        // Check if all books in the plan are completed
        const { data: allPlanBooks } = await supabase
          .from('reading_plan_books')
          .select('status')
          .eq('goal_id', userPlanBook.goal_id);

        const allCompleted = allPlanBooks?.every(b => b.status === 'completed');
        if (allCompleted) {
          await supabase
            .from('goals')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', userPlanBook.goal_id);
        }
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

  const handleDownloadPDF = () => {
    if (!book?.pdf_url) {
      toast({
        title: "No PDF available",
        description: "This book doesn't have a downloadable PDF",
        variant: "destructive",
      });
      return;
    }
    
    // Open PDF in new tab for download
    window.open(book.pdf_url, '_blank');
    toast({
      title: "Opening PDF",
      description: "The PDF will open in a new tab",
    });
  };

  const getSourceDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown source';
    }
  };

  if (isLoading || !book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
            <Headphones className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium">Loading your book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-4xl">
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="hover-lift shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-card/50 backdrop-blur-sm border border-border/50"
              aria-label="Go back to dashboard"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent break-words leading-tight">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-sm sm:text-base text-muted-foreground mt-1">{book.author}</p>
              )}
            </div>
          </div>

          {/* PDF Source & Download Card - Always Visible */}
          <Card className="glass-morphism p-4 sm:p-5 border-secondary/30 bg-gradient-to-r from-secondary/10 via-primary/5 to-accent/10 shadow-lg">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20">
                  <FileText className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Original Book PDF</h3>
                  <p className="text-xs text-muted-foreground">
                    {book.pdf_url ? `Source: ${getSourceDomain(book.pdf_url)}` : 'No PDF source available'}
                  </p>
                </div>
              </div>

              {book.pdf_url ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => window.open(book.pdf_url, '_blank')}
                    className="flex-1 gap-2 h-11 hover:bg-secondary/10 hover:border-secondary/50 transition-all group"
                  >
                    <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Visit Source URL</span>
                  </Button>
                  <Button
                    onClick={handleDownloadPDF}
                    className="flex-1 gap-2 h-11 bg-gradient-to-r from-secondary via-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg group"
                  >
                    <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Download Full PDF</span>
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    This book doesn't have a linked PDF source yet.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Audio Player Card */}
          <Card className="glass-morphism p-4 sm:p-6 border-primary/20 overflow-hidden relative">
            {/* Decorative Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            
            <div className="relative space-y-5">
              {/* Now Playing Header */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-xs font-medium uppercase tracking-wider">Audio Summary</span>
              </div>

              {/* Progress Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Progress</span>
                  <span className="font-bold text-primary text-lg">{Math.round(progress)}%</span>
                </div>
                
                {/* Skip Controls + Slider */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSkip('backward')}
                    className="h-10 w-10 rounded-full hover:bg-primary/10 transition-colors shrink-0"
                    aria-label="Skip backward 10%"
                    disabled={progress <= 0}
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>
                  
                  <div className="flex-1 relative touch-pan-x py-2">
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
                    className="h-10 w-10 rounded-full hover:bg-primary/10 transition-colors shrink-0"
                    aria-label="Skip forward 10%"
                    disabled={progress >= 100}
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Play/Pause Controls */}
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  {isPaused || !isReading ? (
                    <Button
                      size="lg"
                      onClick={handlePlay}
                      className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 transition-all px-8 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 min-w-[160px]"
                      aria-label={isPaused ? 'Resume reading' : 'Start reading'}
                    >
                      <Play className="w-6 h-6 fill-current" />
                      <span className="text-lg font-semibold">{isPaused ? 'Resume' : 'Play'}</span>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={handlePause}
                      className="gap-3 px-8 h-14 rounded-full shadow-md hover:shadow-lg hover:scale-105 active:scale-95 min-w-[160px] bg-secondary/20 hover:bg-secondary/30 border border-secondary/30"
                      aria-label="Pause reading"
                    >
                      <Pause className="w-6 h-6" />
                      <span className="text-lg font-semibold">Pause</span>
                    </Button>
                  )}
                  
                  {(isReading || isPaused || progress > 0) && progress < 100 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleStop}
                      className="h-12 w-12 rounded-full hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all"
                      aria-label="Stop and reset"
                    >
                      <StopCircle className="w-5 h-5" />
                    </Button>
                  )}
                  
                  {progress >= 100 && !isCompleting && (
                    <Button
                      size="lg"
                      onClick={handleBookCompletion}
                      className="gap-3 h-14 px-8 rounded-full bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                      aria-label="Complete book"
                    >
                      <CheckCircle className="w-6 h-6" />
                      <span className="text-lg font-semibold">Complete</span>
                    </Button>
                  )}
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-11 w-11 rounded-full hover:bg-primary/10 hover:border-primary/50 transition-all" 
                        aria-label="Voice settings"
                      >
                        <Settings className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="glass-morphism rounded-xl p-1">
                      <DropdownMenuItem 
                        onClick={() => setSelectedVoice("random")}
                        className="rounded-lg cursor-pointer"
                      >
                        🎲 Random Voice {selectedVoice === "random" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSelectedVoice("male")}
                        className="rounded-lg cursor-pointer"
                      >
                        👨 Male Voice {selectedVoice === "male" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSelectedVoice("female")}
                        className="rounded-lg cursor-pointer"
                      >
                        👩 Female Voice {selectedVoice === "female" && "✓"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBookmark}
                    className={`h-11 w-11 rounded-full transition-all ${
                      isBookmarked 
                        ? "bg-primary/20 text-primary border-primary/50 hover:bg-primary/30" 
                        : "hover:bg-primary/10 hover:border-primary/50"
                    }`}
                    aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                  >
                    <BookmarkPlus className="w-5 h-5" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    className="h-11 w-11 rounded-full hover:bg-accent/10 hover:border-accent/50 transition-all"
                    aria-label="Copy summary to clipboard"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Summary Content */}
          <Card className="glass-morphism p-5 sm:p-6 lg:p-8 border-primary/20">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/50">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Book Summary</h2>
            </div>
            <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap leading-relaxed text-foreground/85 text-sm sm:text-base lg:text-lg">
                {summary || "No summary available for this book."}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Book Chat */}
      {summary && (
        <BookChat
          bookId={bookId || ''}
          bookTitle={book.title}
          bookAuthor={book.author}
          summary={summary}
        />
      )}
    </div>
  );
};

export default ReadBook;
