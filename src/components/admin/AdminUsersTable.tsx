import { useState, useEffect } from 'react';
import { 
  Users, Download, RefreshCw, Search, Circle, 
  Clock, Calendar, Mail, User, Trash2, Pencil, Check, X, Crown
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
  is_admin: boolean;
}

export const AdminUsersTable = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditValue, setCreditValue] = useState<string>('');
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Use the edge function to get users with emails
      const { data, error } = await supabase.functions.invoke('get-admin-users');
      
      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      if (data?.success && data?.users) {
        setUsers(data.users);
      } else {
        throw new Error(data?.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error loading users',
        description: 'Failed to load user data. Make sure you have admin permissions.',
        variant: 'destructive',
      });
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

  const startEditingCredits = (user: UserData) => {
    setEditingCredits(user.user_id);
    setCreditValue(user.credits.toString());
  };

  const cancelEditingCredits = () => {
    setEditingCredits(null);
    setCreditValue('');
  };

  const saveCredits = async (user: UserData) => {
    const newCredits = parseInt(creditValue, 10);
    if (isNaN(newCredits) || newCredits < 0) {
      toast({
        title: 'Invalid value',
        description: 'Please enter a valid number of credits (0 or more)',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use the edge function to update credits
      const { data, error } = await supabase.functions.invoke('update-user-credits', {
        body: { userId: user.user_id, credits: newCredits }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update credits');

      toast({
        title: 'Credits updated',
        description: `${user.full_name || user.email} now has ${newCredits} credits`,
      });

      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === user.user_id ? { ...u, credits: newCredits } : u
      ));
      
      setEditingCredits(null);
      setCreditValue('');
    } catch (error) {
      console.error('Error updating credits:', error);
      toast({
        title: 'Error',
        description: 'Failed to update credits. Please try again.',
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
    const headers = ['Name', 'Email', 'Created At', 'Online', 'Last Seen', 'Sessions', 'Books Read', 'Credits', 'Admin'];
    const rows = filteredUsers.map(u => [
      u.full_name || '',
      u.email,
      format(new Date(u.created_at), 'yyyy-MM-dd HH:mm'),
      u.is_online ? 'Yes' : 'No',
      u.last_seen ? format(new Date(u.last_seen), 'yyyy-MM-dd HH:mm') : 'Never',
      u.total_sessions,
      u.books_read,
      u.is_admin ? '∞' : u.credits,
      u.is_admin ? 'Yes' : 'No'
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
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
            User Management
            <Badge variant="secondary" className="text-xs">{users.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 w-[140px] sm:w-[200px] h-9 text-xs sm:text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers} className="h-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9">
              <Download className="w-4 h-4" />
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center relative">
                          <User className="w-4 h-4 text-primary-foreground" />
                          {user.is_admin && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                              <Crown className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{user.full_name || 'No name'}</div>
                          {user.is_admin && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono text-xs">{user.email}</span>
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
                      {user.is_admin ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                          ∞
                        </Badge>
                      ) : editingCredits === user.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={creditValue}
                            onChange={(e) => setCreditValue(e.target.value)}
                            className="w-16 h-8 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveCredits(user);
                              if (e.key === 'Escape') cancelEditingCredits();
                            }}
                            autoFocus
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                            onClick={() => saveCredits(user)}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={cancelEditingCredits}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="bg-accent/10">{user.credits}</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => startEditingCredits(user)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
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
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete User
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
