import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowLeft, BookMarked, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BookmarkWithDetails {
  id: string;
  book_id: string;
  created_at: string;
  notes?: string;
  is_favorite: boolean;
  book: {
    title: string;
    author?: string;
  };
  summary: {
    content: string;
  };
}

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookmarks, setBookmarks] = useState<BookmarkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadBookmarks();
  }, [user, navigate]);

  const loadBookmarks = async () => {
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          id,
          book_id,
          created_at,
          notes,
          is_favorite,
          books!inner (
            title,
            author
          ),
          summaries!inner (
            content
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setBookmarks(data as any || []);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      toast({
        title: "Error",
        description: "Failed to load your library",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bookmarkId: string) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) throw error;

      setBookmarks(bookmarks.filter(b => b.id !== bookmarkId));
      toast({
        title: "Removed",
        description: "Book removed from your library",
      });
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to remove bookmark",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm bg-background/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-3">
            <BookMarked className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold">My Library</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
            Your Saved Books
          </h1>
          <p className="text-lg text-muted-foreground">
            {bookmarks.length} {bookmarks.length === 1 ? 'book' : 'books'} in your library
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : bookmarks.length === 0 ? (
          <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-2">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No saved books yet</h3>
            <p className="text-muted-foreground mb-6">
              Start searching for books and save their summaries to your library
            </p>
            <Button onClick={() => navigate("/dashboard")} className="bg-primary hover:bg-primary/90">
              Search Books
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {bookmarks.map((bookmark) => (
              <Card
                key={bookmark.id}
                className="p-6 bg-card/50 backdrop-blur-sm border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1 line-clamp-2">
                      {bookmark.book.title}
                    </h3>
                    {bookmark.book.author && (
                      <p className="text-sm text-muted-foreground">
                        by {bookmark.book.author}
                      </p>
                    )}
                  </div>
                  {bookmark.is_favorite && (
                    <BookMarked className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {bookmark.summary.content.substring(0, 150)}...
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigate('/dashboard', { 
                        state: { 
                          summary: bookmark.summary.content, 
                          bookTitle: bookmark.book.title 
                        } 
                      });
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(bookmark.id)}
                    className="hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Saved {new Date(bookmark.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
