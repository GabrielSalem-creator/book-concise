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
      {/* Top spacing */}
      <div className="h-5 bg-background" />
      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="px-2 sm:px-3">
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Admin
                </h1>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              <span className="text-primary font-medium">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* Scrollable tabs for mobile */}
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
            <TabsList className="inline-flex w-max sm:w-full sm:grid sm:grid-cols-6 gap-1 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger 
                value="overview" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Users</span>
              </TabsTrigger>
              <TabsTrigger 
                value="books" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Book className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Books</span>
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Activity</span>
              </TabsTrigger>
              <TabsTrigger 
                value="commands" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Commands</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">AI Chat</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
