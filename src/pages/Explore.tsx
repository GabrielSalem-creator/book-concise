import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, ArrowLeft, BookOpen, Users, Eye, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface PublicSummary {
  id: string;
  content: string;
  created_at: string;
  book: {
    id: string;
    title: string;
    author?: string;
  };
}

const Explore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<PublicSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<PublicSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadPublicSummaries();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSummaries(summaries);
    } else {
      const filtered = summaries.filter(s =>
        s.book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.book.author?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSummaries(filtered);
    }
  }, [searchQuery, summaries]);

  const loadPublicSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('summaries')
        .select(`
          id,
          content,
          created_at,
          books!inner (
            id,
            title,
            author
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setSummaries(data as any || []);
      setFilteredSummaries(data as any || []);
    } catch (error) {
      console.error('Error loading summaries:', error);
      toast({
        title: "Error",
        description: "Failed to load public summaries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToLibrary = async (bookId: string, bookTitle: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save books to your library",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    try {
      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          book_id: bookId,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already saved",
            description: "This book is already in your library",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Saved!",
        description: `"${bookTitle}" added to your library`,
      });
    } catch (error) {
      console.error('Error saving bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to save to library",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm bg-background/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(user ? "/dashboard" : "/landing")}
            className="hover:bg-accent/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center space-x-3">
            <Compass className="w-6 h-6 text-accent" />
            <span className="text-xl font-bold">Explore</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent mb-4">
            Discover Book Summaries
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Browse summaries created by our community of readers
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto mb-8">
            <Input
              placeholder="Search by book title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 text-lg border-2 focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{filteredSummaries.length} summaries available</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-2">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "No results found" : "No summaries yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try a different search term"
                : "Be the first to create a summary!"}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredSummaries.map((summary) => (
              <Card
                key={summary.id}
                className="p-6 bg-card/50 backdrop-blur-sm border-2 hover:border-accent/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-1 line-clamp-2">
                    {summary.book.title}
                  </h3>
                  {summary.book.author && (
                    <p className="text-sm text-muted-foreground">
                      by {summary.book.author}
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-4">
                  {summary.content.substring(0, 200)}...
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigate(user ? '/dashboard' : '/landing', {
                        state: {
                          summary: summary.content,
                          bookTitle: summary.book.title
                        }
                      });
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Read
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveToLibrary(summary.book.id, summary.book.title)}
                    className="hover:bg-primary hover:text-primary-foreground"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Added {new Date(summary.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
