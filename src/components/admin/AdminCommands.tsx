import { useState } from 'react';
import { 
  Terminal, UserPlus, Trash2, CreditCard, 
  RefreshCw, Mail, Lock, AlertTriangle, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  // Admin form
  const [adminEmail, setAdminEmail] = useState('');

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
      // Search by username (email) OR full_name
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .or(`username.ilike.%${deleteUserEmail}%,full_name.ilike.%${deleteUserEmail}%`);

      if (profileError) throw profileError;

      const profile = profiles?.find(p => 
        p.username?.toLowerCase() === deleteUserEmail.toLowerCase() ||
        p.full_name?.toLowerCase() === deleteUserEmail.toLowerCase()
      ) || profiles?.[0];

      if (!profile) {
        toast({
          title: 'User not found',
          description: 'No user found with that email/username. Try searching with partial match.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Delete goals and reading plan books first (FK constraint)
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', profile.user_id);

      if (goals?.length) {
        const goalIds = goals.map(g => g.id);
        await supabase.from('reading_plan_books').delete().in('goal_id', goalIds);
        await supabase.from('goals').delete().eq('user_id', profile.user_id);
      }

      // Delete other user data
      await Promise.allSettled([
        supabase.from('user_preferences').delete().eq('user_id', profile.user_id),
        supabase.from('user_sessions').delete().eq('user_id', profile.user_id),
        supabase.from('user_activity').delete().eq('user_id', profile.user_id),
        supabase.from('reading_sessions').delete().eq('user_id', profile.user_id),
        supabase.from('bookmarks').delete().eq('user_id', profile.user_id),
        supabase.from('chat_messages').delete().eq('user_id', profile.user_id),
        supabase.from('user_roles').delete().eq('user_id', profile.user_id),
        supabase.from('categories').delete().eq('user_id', profile.user_id),
      ]);

      // Delete profile last
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', profile.user_id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      toast({
        title: 'User data deleted',
        description: `All data for ${profile.full_name || deleteUserEmail} has been removed.`,
      });

      setDeleteUserEmail('');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user data. Check console for details.',
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
      // Search by username (email) OR full_name
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .or(`username.ilike.%${creditsUserEmail}%,full_name.ilike.%${creditsUserEmail}%`);

      const profile = profiles?.find(p => 
        p.username?.toLowerCase() === creditsUserEmail.toLowerCase() ||
        p.full_name?.toLowerCase() === creditsUserEmail.toLowerCase()
      ) || profiles?.[0];

      if (!profile) {
        toast({
          title: 'User not found',
          description: 'No user found with that email/name.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Check if user_preferences exists
      const { data: existingPrefs } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (existingPrefs) {
        // Update existing preferences
        const { error } = await supabase
          .from('user_preferences')
          .update({ daily_credits: parseInt(creditsAmount) })
          .eq('user_id', profile.user_id);

        if (error) throw error;
      } else {
        // Create new preferences with credits
        const { error } = await supabase
          .from('user_preferences')
          .insert({
            user_id: profile.user_id,
            daily_credits: parseInt(creditsAmount),
            completed_onboarding: false,
            themes: [],
            last_credit_reset: new Date().toISOString().split('T')[0]
          });

        if (error) throw error;
      }

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
        description: 'Failed to update credits.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminEmail) {
      toast({
        title: 'Missing email',
        description: 'Please enter the admin email.',
        variant: 'destructive',
      });
      return;
    }

    setLoading('admin');
    try {
      // Search by username (email) OR full_name
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .or(`username.ilike.%${adminEmail}%,full_name.ilike.%${adminEmail}%`);

      const profile = profiles?.find(p => 
        p.username?.toLowerCase() === adminEmail.toLowerCase() ||
        p.full_name?.toLowerCase() === adminEmail.toLowerCase()
      ) || profiles?.[0];

      if (!profile) {
        toast({
          title: 'User not found',
          description: 'No user found with that email/name. They must sign up first.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Check if already admin
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'admin')
        .maybeSingle();

      if (existingRole) {
        toast({
          title: 'Already admin',
          description: 'This user is already an admin.',
          variant: 'destructive',
        });
        setLoading(null);
        return;
      }

      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.user_id, role: 'admin' });

      if (error) throw error;

      toast({
        title: 'Admin added',
        description: `${profile.full_name || adminEmail} is now an admin.`,
      });

      setAdminEmail('');
    } catch (error) {
      console.error('Error adding admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to add admin role.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleResetAllCredits = async () => {
    setLoading('resetCredits');
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ daily_credits: 2 });

      if (error) throw error;

      toast({
        title: 'Credits reset',
        description: 'All users now have 2 daily credits.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset credits.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleClearInactiveSessions = async () => {
    setLoading('clearSessions');
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('is_active', true)
        .lt('last_seen_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (error) throw error;

      toast({
        title: 'Sessions cleared',
        description: 'Inactive sessions have been ended.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear sessions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {/* Create User */}
      <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-colors">
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
      <Card className="glass-morphism border-destructive/20 hover:border-destructive/40 transition-colors">
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
                  This will permanently delete all data for <strong>{deleteUserEmail}</strong>.
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
      <Card className="glass-morphism border-accent/20 hover:border-accent/40 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent" />
            Manage Credits
          </CardTitle>
          <CardDescription>
            Adjust daily credits for a user (default: 2/day)
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

      {/* Add Admin */}
      <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-colors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Add Admin
          </CardTitle>
          <CardDescription>
            Grant admin access to a user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">User Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90" 
            onClick={handleAddAdmin}
            disabled={loading === 'admin'}
          >
            {loading === 'admin' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <Shield className="w-4 h-4 mr-2" />
            Grant Admin Access
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-morphism border-secondary/20 hover:border-secondary/40 transition-colors md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-secondary" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={handleResetAllCredits}
            disabled={loading === 'resetCredits'}
          >
            {loading === 'resetCredits' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All Credits to 2
          </Button>
          <Button 
            variant="outline"
            onClick={handleClearInactiveSessions}
            disabled={loading === 'clearSessions'}
          >
            {loading === 'clearSessions' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <Lock className="w-4 h-4 mr-2" />
            Clear Inactive Sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
