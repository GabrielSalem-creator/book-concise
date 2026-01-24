import { useState, useEffect } from "react";
import { Search, Loader2, BookOpen, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { NoCreditsPopup } from "./NoCreditsPopup";

interface BookSearchProps {
  onSummaryGenerated: (summary: string, bookTitle: string) => void;
  initialBookName?: string;
  compact?: boolean;
}

// Progress steps for visual feedback
const PROGRESS_STEPS = [
  { status: "Checking for existing summaries...", progress: 10 },
  { status: "Searching for book PDFs...", progress: 30 },
  { status: "Validating PDF...", progress: 50 },
  { status: "Generating AI summary...", progress: 70 },
  { status: "Finalizing...", progress: 90 },
];

export const BookSearch = ({ onSummaryGenerated, initialBookName = "", compact = false }: BookSearchProps) => {
  const [bookName, setBookName] = useState(initialBookName);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showNoCreditsPopup, setShowNoCreditsPopup] = useState(false);
  const [daysUntilReset, setDaysUntilReset] = useState(7);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch user credits and premium status
  const fetchCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('daily_credits, last_credit_reset, is_premium, premium_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (preferences) {
      // Check premium status
      if (preferences.is_premium) {
        const expiresAt = preferences.premium_expires_at ? new Date(preferences.premium_expires_at) : null;
        if (!expiresAt || expiresAt > new Date()) {
          setIsPremium(true);
          setCredits(null); // Premium users don't need credits display
          return;
        }
      }

      const today = new Date();
      const lastReset = new Date(preferences.last_credit_reset);
      const daysSinceReset = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

      // Reset credits if it's been 7 days (weekly reset)
      if (daysSinceReset >= 7) {
        await supabase
          .from('user_preferences')
          .update({
            daily_credits: 3,
            last_credit_reset: today.toISOString().split('T')[0]
          })
          .eq('user_id', user.id);
        setCredits(3);
      } else {
        setCredits(preferences.daily_credits);
      }
    }
  };

  useEffect(() => {
    if (initialBookName) {
      setBookName(initialBookName);
    }
  }, [initialBookName]);

  useEffect(() => {
    fetchCredits();
  }, []);

  // Helper to update status and progress
  const updateProgress = (statusText: string) => {
    setStatus(statusText);
    const step = PROGRESS_STEPS.find(s => s.status === statusText);
    if (step) {
      setProgressValue(step.progress);
    }
  };

  const handleSearch = async () => {
    if (!bookName.trim()) {
      toast({
        title: "Book name required",
        description: "Please enter a book name to search",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgressValue(0);
    updateProgress("Checking for existing summaries...");

    try {
      // Step 1: Check if summary already exists
      const { data: existingBook } = await supabase
        .from('books')
        .select(`
          id,
          title,
          author,
          summaries (
            id,
            content,
            created_at
          )
        `)
        .ilike('title', `%${bookName}%`)
        .limit(1)
        .maybeSingle();

      // If we found an existing summary, navigate to read page
      if (existingBook && existingBook.summaries && existingBook.summaries.length > 0) {
        toast({
          title: "Found existing summary!",
          description: "Opening book...",
        });

        setProgressValue(100);
        navigate(`/read/${existingBook.id}`);
        setBookName("");
        setStatus("");
        setProgressValue(0);
        setIsLoading(false);
        return;
      }

      // Step 2: No existing summary found, search for PDF URLs
      updateProgress("Searching for book PDFs...");
      
      const { data: searchData, error: searchError } = await supabase.functions.invoke(
        'search-book-pdf',
        {
          body: { bookName }
        }
      );

      if (searchError) throw searchError;
      if (!searchData.success || !searchData.pdfUrls?.length) {
        throw new Error('No PDF URLs found for this book');
      }

      console.log(`Found ${searchData.pdfUrls.length} PDF URLs`);
      updateProgress("Validating PDF...");

      // Step 3: Validate first PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
        'extract-pdf-text',
        {
          body: { pdfUrl: searchData.pdfUrls[0] }
        }
      );

      if (pdfError) throw pdfError;
      if (!pdfData.success) {
        throw new Error('Failed to validate PDF');
      }

      updateProgress("Generating AI summary...");

      // Step 4: Generate summary with PDF text for language/theme detection
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        'generate-summary',
        {
          body: {
            bookTitle: bookName,
            pdfUrl: searchData.pdfUrls[0],
            pdfText: pdfData.extractedText // Pass extracted text for language detection
          }
        }
      );

      // Handle specific error cases from the edge function
      if (summaryError) {
        // Check if the error response contains credit-related info
        if (summaryError.message?.includes('credits') || summaryError.message?.includes('No credits')) {
          throw new Error('No credits remaining');
        }
        throw summaryError;
      }
      
      // Check the response for credit errors
      if (!summaryData.success) {
        if (summaryData.error?.includes('credits') || summaryData.creditsRemaining === 0) {
          throw new Error('No credits remaining');
        }
        throw new Error(summaryData.error || 'Failed to generate summary');
      }

      // Update credits
      if (summaryData.creditsRemaining !== undefined) {
        setCredits(summaryData.creditsRemaining);
      } else {
        await fetchCredits();
      }

      const creditsMessage = summaryData.existingSummary 
        ? "Using existing summary - no credits used" 
        : `Summary generated! ${summaryData.creditsRemaining ?? credits ?? 0} credits remaining`;

      updateProgress("Finalizing...");

      // Find the book ID and navigate to read page
      const { data: newBook } = await supabase
        .from('books')
        .select('id')
        .ilike('title', `%${bookName}%`)
        .limit(1)
        .maybeSingle();

      if (newBook) {
        navigate(`/read/${newBook.id}`);
      }
      
      setProgressValue(100);
      
      toast({
        title: "Success!",
        description: creditsMessage,
      });

      setBookName("");
      setStatus("");
      setProgressValue(0);

    } catch (error: unknown) {
      console.error('Error:', error);
      
      // Check if it's a credits error (from the edge function)
      let errorMessage = "Failed to process book";
      let errorTitle = "Error";
      let showPopup = false;
      
      const errorObj = error as { message?: string; daysUntilReset?: number };
      
      if (errorObj?.message?.includes('NO_CREDITS') || errorObj?.message?.includes('No credits remaining') || errorObj?.message?.includes('credits')) {
        errorTitle = "No Credits Remaining";
        errorMessage = "You've used all your weekly credits.";
        setCredits(0);
        showPopup = true;
        // Try to get days until reset from the error
        if (errorObj?.daysUntilReset) {
          setDaysUntilReset(errorObj.daysUntilReset);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (showPopup) {
        setShowNoCreditsPopup(true);
      } else {
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      }
      setStatus("");
      setProgressValue(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Compact version for sticky header
  if (compact) {
    return (
      <div className="flex items-center gap-2" role="search">
        <label htmlFor="book-search-compact" className="sr-only">Enter book name to search</label>
        <Input
          id="book-search-compact"
          placeholder="Enter book name..."
          value={bookName}
          onChange={(e) => setBookName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
          disabled={isLoading}
          className="flex-1 h-10 text-sm border-primary/20 bg-background/50"
          aria-describedby={status ? "search-status-compact" : undefined}
        />
        {isPremium ? (
          <Badge className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-amber-500 text-white" role="status">
            <Crown className="w-3 h-3" aria-hidden="true" />
            <span className="font-semibold text-xs">Premium</span>
          </Badge>
        ) : credits !== null ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-xs" role="status" aria-label={`${credits} credits remaining`}>
            <Sparkles className="w-3 h-3 text-primary" aria-hidden="true" />
            <span className="font-semibold text-primary">{credits}</span>
          </div>
        ) : null}
        <Button
          onClick={handleSearch}
          disabled={isLoading}
          size="sm"
          className="h-10 px-4 bg-gradient-to-r from-primary to-primary/90"
          aria-label={isLoading ? "Searching for book" : "Search for book"}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <Search className="w-4 h-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
            </>
          )}
        </Button>
        {/* Compact progress bar */}
        {isLoading && status && (
          <div id="search-status-compact" className="flex items-center gap-2 flex-1 max-w-[200px]" role="status" aria-live="polite">
            <Progress value={progressValue} className="h-1.5 flex-1" />
            <span className="text-xs text-primary font-medium whitespace-nowrap">{progressValue}%</span>
          </div>
        )}
      </div>
    );
  }

  // Full version
  return (
    <Card className="p-4 sm:p-5 bg-card/50 backdrop-blur-sm border hover:shadow-lg transition-all duration-300" role="search">
      <div className="flex flex-col space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Search for a Book
            </h2>
          </div>
          {isPremium ? (
            <Badge className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1" role="status">
              <Crown className="w-4 h-4" aria-hidden="true" />
              <span className="font-semibold">Premium - Unlimited</span>
            </Badge>
          ) : credits !== null ? (
            <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-full" role="status" aria-label={`${credits} credits remaining`}>
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" aria-hidden="true" />
              <span className="text-xs sm:text-sm font-semibold text-primary">{credits} credits</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="book-search-input" className="sr-only">Enter book name to search</label>
          <Input
            id="book-search-input"
            placeholder="Enter book name..."
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
            disabled={isLoading}
            className="flex-1 h-10 sm:h-11 text-sm sm:text-base border focus:border-primary transition-colors"
            aria-describedby={status ? "search-status" : undefined}
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className="h-10 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300"
            aria-label={isLoading ? "Searching for book" : "Search for book"}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                <span className="text-sm">Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="text-sm">Search</span>
              </>
            )}
          </Button>
        </div>

        {/* Progress indicator during search */}
        {isLoading && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" aria-hidden="true" />
                <span>{status || "Processing..."}</span>
              </div>
              <span className="font-semibold text-primary">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2 sm:h-2.5" />
            <p className="text-xs text-muted-foreground/70 text-center">
              This may take up to a minute for new books
            </p>
          </div>
        )}
      </div>

      {/* No Credits Popup */}
      <NoCreditsPopup 
        open={showNoCreditsPopup} 
        onClose={() => setShowNoCreditsPopup(false)}
        daysUntilReset={daysUntilReset}
      />
    </Card>
  );
};