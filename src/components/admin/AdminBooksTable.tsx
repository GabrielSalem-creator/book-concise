import { useState, useEffect } from 'react';
import { 
  Book, Download, RefreshCw, Search, Trash2, 
  Eye, FileText, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface BookData {
  id: string;
  title: string;
  author: string | null;
  created_at: string;
  total_reads: number;
  active_readers: number;
  summaries_count: number;
  pdf_url: string | null;
}

interface Summary {
  id: string;
  book_id: string;
  content: string;
  created_at: string;
}

export const AdminBooksTable = () => {
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadBooks = async () => {
    setLoading(true);
    try {
      // Get all books
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;

      // Get reading sessions per book
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('book_id, completed_at');

      // Get active reading sessions
      const { data: activeSessions } = await supabase
        .from('reading_sessions')
        .select('book_id')
        .is('completed_at', null);

      // Get summaries per book
      const { data: summaries } = await supabase
        .from('summaries')
        .select('book_id');

      const bookData: BookData[] = booksData?.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        created_at: book.created_at,
        total_reads: sessions?.filter(s => s.book_id === book.id && s.completed_at).length || 0,
        active_readers: activeSessions?.filter(s => s.book_id === book.id).length || 0,
        summaries_count: summaries?.filter(s => s.book_id === book.id).length || 0,
        pdf_url: book.pdf_url,
      })) || [];

      // Sort by total reads (most popular first)
      bookData.sort((a, b) => b.total_reads - a.total_reads);

      setBooks(bookData);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const deleteSummaries = async (bookId: string, bookTitle: string) => {
    try {
      const { error } = await supabase
        .from('summaries')
        .delete()
        .eq('book_id', bookId);

      if (error) throw error;

      toast({
        title: 'Summaries deleted',
        description: `All summaries for "${bookTitle}" have been removed.`,
      });

      loadBooks();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete summaries.',
        variant: 'destructive',
      });
    }
  };

  const downloadSummary = async (bookId: string, bookTitle: string) => {
    try {
      const { data: summaries, error } = await supabase
        .from('summaries')
        .select('*')
        .eq('book_id', bookId);

      if (error) throw error;

      if (!summaries || summaries.length === 0) {
        toast({
          title: 'No summaries',
          description: 'No summaries available for this book.',
          variant: 'destructive',
        });
        return;
      }

      const content = summaries.map((s: Summary) => 
        `Summary (${format(new Date(s.created_at), 'MMM d, yyyy')}):\n\n${s.content}\n\n---\n`
      ).join('\n');

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle.replace(/[^a-z0-9]/gi, '_')}-summaries.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Downloaded',
        description: `Summaries for "${bookTitle}" downloaded.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download summaries.',
        variant: 'destructive',
      });
    }
  };

  const downloadBook = (book: BookData) => {
    if (book.pdf_url) {
      window.open(book.pdf_url, '_blank');
    } else {
      toast({
        title: 'No PDF',
        description: 'No PDF available for this book.',
        variant: 'destructive',
      });
    }
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Title', 'Author', 'Created At', 'Total Reads', 'Active Readers', 'Summaries'];
    const rows = filteredBooks.map(b => [
      b.title,
      b.author || '',
      format(new Date(b.created_at), 'yyyy-MM-dd HH:mm'),
      b.total_reads,
      b.active_readers,
      b.summaries_count
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `books-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-morphism border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5 text-primary" />
            Book Analytics
            <Badge variant="secondary">{books.length} books</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadBooks}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Book</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Total Reads</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Summaries</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No books found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBooks.map((book, index) => (
                  <TableRow key={book.id}>
                    <TableCell>
                      {index < 3 ? (
                        <Badge className="bg-gradient-to-r from-primary to-accent">
                          {index + 1}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{book.title}</div>
                        <div className="text-sm text-muted-foreground">{book.author || 'Unknown'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(book.created_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {book.total_reads}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={book.active_readers > 0 ? 'default' : 'secondary'} className="gap-1">
                        <Eye className="w-3 h-3" />
                        {book.active_readers}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 bg-accent/10">
                        <FileText className="w-3 h-3" />
                        {book.summaries_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => downloadBook(book)}
                          disabled={!book.pdf_url}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => downloadSummary(book.id, book.title)}
                          disabled={book.summaries_count === 0}
                          title="Download Summary"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              disabled={book.summaries_count === 0}
                              title="Delete Summaries"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Summaries</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete all {book.summaries_count} summaries for "{book.title}". 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteSummaries(book.id, book.title)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
