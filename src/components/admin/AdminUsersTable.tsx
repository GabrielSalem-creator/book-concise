import { useState, useEffect } from 'react';
import { 
  Users, Download, RefreshCw, Search, Circle, 
  Clock, Calendar, Mail, User, Trash2
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
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface UserData {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string;
  created_at: string;
  is_online: boolean;
  last_seen: string | null;
  total_sessions: number;
  books_read: number;
  credits: number;
}

export const AdminUsersTable = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get user preferences for credits
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('user_id, daily_credits');

      // Get active sessions
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('user_id, last_seen_at, is_active')
        .eq('is_active', true);

      // Get reading sessions count per user
      const { data: readingSessions } = await supabase
        .from('reading_sessions')
        .select('user_id')
        .not('completed_at', 'is', null);

      // Get total session count per user
      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('user_id');

      // Combine data
      const userData: UserData[] = profiles?.map(profile => {
        const userPrefs = preferences?.find(p => p.user_id === profile.user_id);
        const activeSession = sessions?.find(s => s.user_id === profile.user_id);
        const userReadingSessions = readingSessions?.filter(r => r.user_id === profile.user_id);
        const userAllSessions = allSessions?.filter(s => s.user_id === profile.user_id);

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          username: profile.username,
          email: profile.username || profile.full_name || 'Unknown',
          created_at: profile.created_at,
          is_online: activeSession?.is_active || false,
          last_seen: activeSession?.last_seen_at || null,
          total_sessions: userAllSessions?.length || 0,
          books_read: userReadingSessions?.length || 0,
          credits: userPrefs?.daily_credits ?? 2,
        };
      }) || [];

      setUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const deleteUser = async (user: UserData) => {
    try {
      // Delete all user data in order to avoid FK constraint issues
      // First get goals to delete reading_plan_books
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', user.user_id);

      if (goals?.length) {
        const goalIds = goals.map(g => g.id);
        const { error: rpbError } = await supabase
          .from('reading_plan_books')
          .delete()
          .in('goal_id', goalIds);
        if (rpbError) console.error('Error deleting reading_plan_books:', rpbError);
        
        const { error: goalsError } = await supabase
          .from('goals')
          .delete()
          .eq('user_id', user.user_id);
        if (goalsError) console.error('Error deleting goals:', goalsError);
      }

      // Delete other user data
      const deleteResults = await Promise.allSettled([
        supabase.from('user_preferences').delete().eq('user_id', user.user_id),
        supabase.from('user_sessions').delete().eq('user_id', user.user_id),
        supabase.from('user_activity').delete().eq('user_id', user.user_id),
        supabase.from('reading_sessions').delete().eq('user_id', user.user_id),
        supabase.from('bookmarks').delete().eq('user_id', user.user_id),
        supabase.from('chat_messages').delete().eq('user_id', user.user_id),
        supabase.from('user_roles').delete().eq('user_id', user.user_id),
        supabase.from('categories').delete().eq('user_id', user.user_id),
      ]);

      // Log any errors
      deleteResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Delete operation ${index} failed:`, result.reason);
        }
      });

      // Delete profile last
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.user_id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw profileError;
      }

      toast({
        title: 'User deleted',
        description: `All data for ${user.full_name || user.email} has been removed.`,
      });

      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user. Check console for details.',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Created At', 'Online', 'Last Seen', 'Sessions', 'Books Read', 'Credits'];
    const rows = filteredUsers.map(u => [
      u.full_name || '',
      u.email,
      format(new Date(u.created_at), 'yyyy-MM-dd HH:mm'),
      u.is_online ? 'Yes' : 'No',
      u.last_seen ? format(new Date(u.last_seen), 'yyyy-MM-dd HH:mm') : 'Never',
      u.total_sessions,
      u.books_read,
      u.credits
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-morphism border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User Management
            <Badge variant="secondary">{users.length} users</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers}>
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
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Books</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <User className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div className="font-medium">{user.full_name || 'No name'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_online ? 'default' : 'secondary'} className="gap-1">
                        <Circle className={`w-2 h-2 ${user.is_online ? 'fill-green-500 text-green-500' : 'fill-muted-foreground'}`} />
                        {user.is_online ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.last_seen ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.total_sessions}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary/10">{user.books_read}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-accent/10">{user.credits}</Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all data for <strong>{user.full_name || user.email}</strong>. 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteUser(user)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
