import { useState, useEffect } from "react";
import { Search, Loader2, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface BookSearchProps {
  onSummaryGenerated: (summary: string, bookTitle: string) => void;
  initialBookName?: string;
}

export const BookSearch = ({ onSummaryGenerated, initialBookName = "" }: BookSearchProps) => {
  const [bookName, setBookName] = useState(initialBookName);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch user credits
  const fetchCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('daily_credits, last_credit_reset')
      .eq('user_id', user.id)
      .maybeSingle();

    if (preferences) {
      const today = new Date().toISOString().split('T')[0];
      const lastReset = preferences.last_credit_reset;

      // Reset credits if it's a new day
      if (lastReset !== today) {
        await supabase
          .from('user_preferences')
          .update({
            daily_credits: 2,
            last_credit_reset: today
          })
          .eq('user_id', user.id);
        setCredits(2);
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
    setStatus("Checking for existing summaries...");

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

        navigate(`/read/${existingBook.id}`);
        setBookName("");
        setStatus("");
        setIsLoading(false);
        return;
      }

      // Step 2: No existing summary found, search for PDF URLs
      setStatus("Searching for book PDFs...");
      
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
      setStatus("Validating PDF...");

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

      setStatus("Generating AI summary...");

      // Step 4: Generate summary
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        'generate-summary',
        {
          body: {
            bookTitle: bookName,
            pdfUrl: searchData.pdfUrls[0]
          }
        }
      );

      if (summaryError) throw summaryError;
      if (!summaryData.success) {
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

      toast({
        title: "Success!",
        description: creditsMessage,
      });

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
      
      setBookName("");
      setStatus("");

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process book",
        variant: "destructive",
      });
      setStatus("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 md:p-8 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col items-center space-y-4 md:space-y-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 md:space-x-3">
            <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Search for a Book
            </h2>
          </div>
          {credits !== null && (
            <div className="flex items-center space-x-2 bg-primary/10 px-3 py-1 rounded-full">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{credits} credits</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Enter book name..."
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
              disabled={isLoading}
              className="flex-1 h-11 md:h-12 text-base md:text-lg border-2 focus:border-primary transition-colors"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              size="lg"
              className="h-11 md:h-12 px-6 md:px-8 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 sm:mr-2" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </Button>
          </div>

          {status && (
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{status}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
