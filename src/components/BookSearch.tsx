import { useState } from "react";
import { Search, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BookSearchProps {
  onSummaryGenerated: (summary: string, bookTitle: string) => void;
}

export const BookSearch = ({ onSummaryGenerated }: BookSearchProps) => {
  const [bookName, setBookName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const { toast } = useToast();

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
    setStatus("Searching for book PDFs...");

    try {
      // Step 1: Search for PDF URLs
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

      // Step 2: Validate first PDF
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

      // Step 3: Generate summary
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

      toast({
        title: "Success!",
        description: "Book summary generated successfully",
      });

      onSummaryGenerated(summaryData.summary, bookName);
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
    <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col items-center space-y-6">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Search for a Book
          </h2>
        </div>

        <div className="w-full max-w-xl space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter book name..."
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
              disabled={isLoading}
              className="flex-1 h-12 text-lg border-2 focus:border-primary transition-colors"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              size="lg"
              className="h-12 px-8 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search
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
