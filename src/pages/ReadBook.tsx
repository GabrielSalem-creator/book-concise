import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookmarkPlus, Share2, ArrowLeft, CheckCircle, Download, FileText, Headphones, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import BookChat from "@/components/BookChat";
import PdfViewerDialog from "@/components/PdfViewerDialog";
import AudioPlayerCard from "@/components/AudioPlayerCard";

const ReadBook = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [book, setBook] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const hasCompletedRef = useRef(false);
  const [isSearchingPdf, setIsSearchingPdf] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  // Cleanup Web Speech API on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if ((window as any).__progressInterval) clearInterval((window as any).__progressInterval);
      if ((window as any).__speechInterval) clearInterval((window as any).__speechInterval);
    };
  }, []);

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
      createInitialSession();
    }
  }, [bookId, user]);

  // Auto-search for PDF when book loads without one
  useEffect(() => {
    if (book && !book.pdf_url && !isSearchingPdf && !isLoading) {
      searchForPdf();
    }
  }, [book?.id, book?.pdf_url, isLoading]);

  // No longer need to trigger audio chunk generation - using Web Speech API now

  // Auto-complete when progress reaches 100%
  useEffect(() => {
    if (progress >= 100 && !hasCompletedRef.current && !isCompleting && readingSessionId) {
      handleBookCompletion();
    }
  }, [progress, readingSessionId, isCompleting]);

  const createInitialSession = async () => {
    if (!user || !bookId) return;

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

    await supabase
      .from('reading_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('completed_at', null)
      .neq('book_id', bookId);

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
    
    const { data: existingBook } = await supabase
      .from('books')
      .select(`*, summaries (content)`)
      .eq('id', bookId)
      .single();

    if (existingBook && existingBook.summaries && existingBook.summaries.length > 0) {
      setBook(existingBook);
      const cleanSummary = cleanMarkdown(existingBook.summaries[0].content);
      setSummary(cleanSummary);
      setIsLoading(false);
      return;
    }

    if (existingBook) {
      toast({
        title: "Generating summary",
        description: "Please wait while we generate the book summary...",
      });

      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
        body: { bookTitle: existingBook.title, bookId: existingBook.id }
      });

      if (summaryError || !summaryData?.summary) {
        handleSummaryError(summaryData, summaryError);
        return;
      }

      setBook(existingBook);
      setSummary(cleanMarkdown(summaryData.summary));
      setIsLoading(false);
      return;
    }

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

    await supabase
      .from('books')
      .update({ pdf_url: pdfData.pdfUrl })
      .eq('id', bookId);

    toast({
      title: "Generating summary",
      description: "Please wait while we generate the book summary...",
    });

    const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
      body: { bookTitle, bookId }
    });

    if (summaryError || !summaryData?.summary) {
      handleSummaryError(summaryData, summaryError);
      return;
    }

    const { data: finalBook } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    setBook(finalBook);
    setSummary(cleanMarkdown(summaryData.summary));
    setIsLoading(false);
  };

  const loadBook = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select(`*, summaries (content)`)
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
      setSummary(cleanMarkdown(data.summaries[0].content));
      setIsLoading(false);
      return;
    }

    toast({
      title: "Generating summary",
      description: "Please wait while we generate the book summary...",
    });

    const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
      body: { bookTitle: data.title, bookAuthor: data.author, bookId: data.id }
    });

    if (summaryError || !summaryData?.summary) {
      handleSummaryError(summaryData, summaryError);
      return;
    }

    setSummary(cleanMarkdown(summaryData.summary));
    setIsLoading(false);
  };

  const cleanMarkdown = (text: string) => {
    return text
      .replace(/#+\s/g, '')
      .replace(/[-*_]{2,}/g, '')
      .replace(/^\s*[-*]\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  };

  const handleSummaryError = (data: any, error: any) => {
    const errorMessage = data?.error || error?.message || '';
    const isCreditsError = errorMessage.includes('No credits remaining') || data?.creditsRemaining === 0;
    
    if (isCreditsError) {
      toast({
        title: "No more credits",
        description: "Wait one week for your credits to reset!",
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

  const handleBookCompletion = async () => {
    if (hasCompletedRef.current) return;
    
    hasCompletedRef.current = true;
    setIsCompleting(true);

    // Stop Web Speech if running
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const bookTitle = book?.title || "the book";

    if (readingSessionId) {
      await supabase
        .from('reading_sessions')
        .update({ 
          progress_percentage: 100,
          completed_at: new Date().toISOString()
        })
        .eq('id', readingSessionId);
    }

    if (user && bookId) {
      const { data: planBooks } = await supabase
        .from('reading_plan_books')
        .select('id, goal_id, goals!inner(user_id)')
        .eq('book_id', bookId);

      const userPlanBook = planBooks?.find((pb: any) => pb.goals?.user_id === user.id);

      if (userPlanBook) {
        await supabase
          .from('reading_plan_books')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', userPlanBook.id);

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

    toast({
      title: "Congratulations! 🎉",
      description: `You successfully finished "${bookTitle}"`,
    });

    navigate('/dashboard');
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

  const handleShare = async () => {
    // Share the PDF link if available
    const pdfUrl = book?.pdf_url;
    
    if (!pdfUrl) {
      toast({
        title: "No PDF available",
        description: "This book doesn't have a PDF to share",
        variant: "destructive",
      });
      return;
    }

    // Use Web Share API if available (mobile/iOS)
    if (navigator.share) {
      try {
        await navigator.share({
          title: book?.title || 'Book PDF',
          text: `Check out "${book?.title}" by ${book?.author || 'Unknown'}`,
          url: pdfUrl,
        });
        toast({
          title: "Shared!",
          description: "PDF link shared successfully",
        });
      } catch (err: any) {
        // User cancelled or share failed
        if (err.name !== 'AbortError') {
          // Fallback to clipboard
          await navigator.clipboard.writeText(pdfUrl);
          toast({
            title: "Copied!",
            description: "PDF link copied to clipboard",
          });
        }
      }
    } else {
      // Fallback for desktop - copy PDF link to clipboard
      await navigator.clipboard.writeText(pdfUrl);
      toast({
        title: "Copied!",
        description: "PDF link copied to clipboard",
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!book?.pdf_url) {
      toast({
        title: "No PDF available",
        description: "This book doesn't have a downloadable PDF",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Preparing download...",
      description: "Getting the PDF ready",
    });

    try {
      // Try using fetch with no-cors mode and blob
      const response = await fetch(book.pdf_url, {
        mode: 'cors',
        credentials: 'omit',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const fileName = `${book.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
        
        // Check if Web Share API supports files (iOS/mobile)
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
          const file = new File([blob], fileName, { type: 'application/pdf' });
          try {
            await navigator.share({
              files: [file],
              title: book.title,
            });
            toast({
              title: "Success!",
              description: "PDF shared/saved",
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') return;
            // Fall through to anchor download
          }
        }
        
        // Fallback: Create blob URL and trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        toast({
          title: "Download started",
          description: "Check your downloads folder",
        });
      } else {
        throw new Error('Fetch failed');
      }
    } catch (error) {
      console.error('Download failed:', error);
      
      // Final fallback: Direct link with download attribute
      const link = document.createElement('a');
      link.href = book.pdf_url;
      link.download = `${book.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Opening PDF",
        description: "Save it from your browser",
      });
    }
  };

  const searchForPdf = async () => {
    if (!book?.title) return;
    
    setIsSearchingPdf(true);
    
    try {
      const searchQuery = book.author 
        ? `${book.title} ${book.author}` 
        : book.title;
      
      const { data, error } = await supabase.functions.invoke('search-book-pdf', {
        body: { bookName: searchQuery }
      });
      
      if (error) throw error;
      
      if (data.success && data.pdfUrls?.length > 0) {
        await supabase
          .from('books')
          .update({ pdf_url: data.pdfUrls[0] })
          .eq('id', book.id);
        
        setBook({ ...book, pdf_url: data.pdfUrls[0] });
        
        toast({
          title: "PDF Found!",
          description: `Found ${data.pdfUrls.length} PDF source(s)`,
        });
      }
    } catch (error) {
      console.error('Error searching for PDF:', error);
    } finally {
      setIsSearchingPdf(false);
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
      {/* Top spacing */}
      <div className="h-5 bg-background" />
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
              {book.pdf_url ? (
                <button
                  onClick={() => setIsPdfViewerOpen(true)}
                  className="text-left group cursor-pointer"
                >
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words leading-tight relative">
                    <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent group-hover:from-accent group-hover:via-primary group-hover:to-accent transition-all duration-300">
                      {book.title}
                    </span>
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 group-hover:text-primary/70 transition-colors">
                    <Eye className="w-3 h-3" />
                    <span>Click to preview PDF</span>
                  </p>
                </button>
              ) : (
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent break-words leading-tight">
                    {book.title}
                  </h1>
                  {isSearchingPdf && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Finding PDF...</span>
                    </p>
                  )}
                </div>
              )}
              {book.author && (
                <p className="text-sm sm:text-base text-muted-foreground mt-1">{book.author}</p>
              )}
            </div>

            {book.pdf_url && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsPdfViewerOpen(true)}
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-9 sm:h-10 px-3 rounded-full border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
                  aria-label="Preview PDF"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Preview</span>
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  size="icon"
                  className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-secondary via-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  aria-label="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Audio Player Card */}
          <Card className="glass-morphism p-4 sm:p-6 border-primary/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            
            <div className="relative">
              <AudioPlayerCard
                bookId={bookId}
                summary={summary}
                onProgress={async (prog) => {
                  setProgress(prog);
                  if (readingSessionId && Math.floor(prog) % 10 === 0) {
                    await supabase
                      .from('reading_sessions')
                      .update({ 
                        progress_percentage: prog,
                        last_read_at: new Date().toISOString()
                      })
                      .eq('id', readingSessionId);
                  }
                }}
                onComplete={handleBookCompletion}
                readingSessionId={readingSessionId}
              />
              
              {/* Complete & Secondary Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5 pt-5 border-t border-border/30">
                <div className="flex items-center justify-center sm:justify-start">
                  {progress >= 100 && !isCompleting && (
                    <Button
                      size="lg"
                      onClick={handleBookCompletion}
                      className="gap-3 h-14 px-8 rounded-full bg-gradient-to-r from-secondary to-accent hover:opacity-90 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                      aria-label="Complete book"
                    >
                      <CheckCircle className="w-6 h-6" />
                      <span className="text-lg font-semibold">Complete</span>
                    </Button>
                  )}
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center sm:justify-end gap-2">
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

      {/* PDF Viewer Dialog */}
      {book.pdf_url && (
        <PdfViewerDialog
          isOpen={isPdfViewerOpen}
          onClose={() => setIsPdfViewerOpen(false)}
          pdfUrl={book.pdf_url}
          title={book.title}
          author={book.author}
        />
      )}
    </div>
  );
};

export default ReadBook;
