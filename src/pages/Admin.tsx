import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Users, Book, Activity, ArrowLeft, 
  RefreshCw, CreditCard, BarChart3, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useAuth } from '@/components/AuthProvider';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';
import { AdminBooksTable } from '@/components/admin/AdminBooksTable';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminActivityFeed } from '@/components/admin/AdminActivityFeed';
import { AdminCommands } from '@/components/admin/AdminCommands';
import { AdminAIChat } from '@/components/admin/AdminAIChat';

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading } = useAdminCheck();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-lg">Verifying admin access...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Logged in as <span className="text-primary font-medium">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="books" className="gap-2">
              <Book className="w-4 h-4" />
              <span className="hidden sm:inline">Books</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="commands" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Commands</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">AI Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <AdminUsersTable />
          </TabsContent>

          <TabsContent value="books" className="space-y-6">
            <AdminBooksTable />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <AdminActivityFeed />
          </TabsContent>

          <TabsContent value="commands" className="space-y-6">
            <AdminCommands />
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <AdminAIChat />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
