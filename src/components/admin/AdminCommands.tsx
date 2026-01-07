import { useState } from 'react';
import { 
  Terminal, UserPlus, Trash2, CreditCard, 
  RefreshCw, Mail, Lock, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';

export const AdminCommands = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  // Create user form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');

  // Delete user form  
  const [deleteUserEmail, setDeleteUserEmail] = useState('');

  // Credits form
  const [creditsUserEmail, setCreditsUserEmail] = useState('');
  const [creditsAmount, setCreditsAmount] = useState('');

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        title: 'Missing fields',
        description: 'Email and password are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading('create');
    try {
      // Note: Creating users requires admin API or invite flow
      // For now, we'll just show how it would work
      toast({
        title: 'User creation',
        description: 'User creation requires Supabase Admin API. Use invite flow instead.',
        variant: 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create user.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserEmail) {
      toast({
        title: 'Missing email',
        description: 'Please enter the user email to delete.',
        variant: 'destructive',
      });
      return;
    }

    setLoading('delete');
    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('username', deleteUserEmail)
        .maybeSingle();

      if (!profile) {
        toast({
          title: 'User not found',
          description: 'No user found with that email.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Delete all user data
      await Promise.all([
        supabase.from('user_preferences').delete().eq('user_id', profile.user_id),
        supabase.from('user_sessions').delete().eq('user_id', profile.user_id),
        supabase.from('user_activity').delete().eq('user_id', profile.user_id),
        supabase.from('reading_sessions').delete().eq('user_id', profile.user_id),
        supabase.from('bookmarks').delete().eq('user_id', profile.user_id),
        supabase.from('chat_messages').delete().eq('user_id', profile.user_id),
      ]);

      // Delete goals and reading plan books
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', profile.user_id);

      if (goals?.length) {
        await supabase
          .from('reading_plan_books')
          .delete()
          .in('goal_id', goals.map(g => g.id));
        
        await supabase
          .from('goals')
          .delete()
          .eq('user_id', profile.user_id);
      }

      // Delete profile
      await supabase.from('profiles').delete().eq('user_id', profile.user_id);

      toast({
        title: 'User data deleted',
        description: `All data for ${profile.full_name || deleteUserEmail} has been removed. Note: Auth account requires Admin API.`,
      });

      setDeleteUserEmail('');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateCredits = async () => {
    if (!creditsUserEmail || !creditsAmount) {
      toast({
        title: 'Missing fields',
        description: 'Email and credit amount are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading('credits');
    try {
      // Find user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('username', creditsUserEmail)
        .maybeSingle();

      if (!profile) {
        toast({
          title: 'User not found',
          description: 'No user found with that email.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Update credits
      const { error } = await supabase
        .from('user_preferences')
        .update({ daily_credits: parseInt(creditsAmount) })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast({
        title: 'Credits updated',
        description: `${profile.full_name || creditsUserEmail} now has ${creditsAmount} credits.`,
      });

      setCreditsUserEmail('');
      setCreditsAmount('');
    } catch (error) {
      console.error('Error updating credits:', error);
      toast({
        title: 'Error',
        description: 'Failed to update credits. Check if credit modification is allowed.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Create User */}
      <Card className="glass-morphism border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Create User
          </CardTitle>
          <CardDescription>
            Invite a new user to the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="user@example.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name">Full Name</Label>
            <Input
              id="new-name"
              placeholder="John Doe"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Temporary Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
            />
          </div>
          <Button 
            className="w-full" 
            onClick={handleCreateUser}
            disabled={loading === 'create'}
          >
            {loading === 'create' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <Mail className="w-4 h-4 mr-2" />
            Send Invite
          </Button>
        </CardContent>
      </Card>

      {/* Delete User */}
      <Card className="glass-morphism border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete User
          </CardTitle>
          <CardDescription>
            Permanently remove a user and all their data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-email">User Email</Label>
            <Input
              id="delete-email"
              type="email"
              placeholder="user@example.com"
              value={deleteUserEmail}
              onChange={(e) => setDeleteUserEmail(e.target.value)}
            />
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              This action cannot be undone
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full"
                disabled={!deleteUserEmail || loading === 'delete'}
              >
                {loading === 'delete' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all data for <strong>{deleteUserEmail}</strong> including:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Profile information</li>
                    <li>Reading sessions and progress</li>
                    <li>Goals and reading plans</li>
                    <li>Bookmarks and preferences</li>
                    <li>Chat messages</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteUser}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Manage Credits */}
      <Card className="glass-morphism border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent" />
            Manage Credits
          </CardTitle>
          <CardDescription>
            Adjust daily credits for a user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credits-email">User Email</Label>
            <Input
              id="credits-email"
              type="email"
              placeholder="user@example.com"
              value={creditsUserEmail}
              onChange={(e) => setCreditsUserEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credits-amount">Credit Amount</Label>
            <Input
              id="credits-amount"
              type="number"
              min="0"
              placeholder="10"
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
            />
          </div>
          <Button 
            variant="outline"
            className="w-full border-accent/20 hover:bg-accent/10" 
            onClick={handleUpdateCredits}
            disabled={loading === 'credits'}
          >
            {loading === 'credits' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <CreditCard className="w-4 h-4 mr-2" />
            Update Credits
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-morphism border-secondary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-secondary" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All Daily Credits
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Lock className="w-4 h-4 mr-2" />
            Clear Inactive Sessions
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Purge Old Activity Logs
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
