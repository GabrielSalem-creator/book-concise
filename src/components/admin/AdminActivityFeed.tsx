import { useState, useEffect } from 'react';
import { 
  Activity, RefreshCw, Download, Filter, 
  User, Book, MessageSquare, Zap, LogIn, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action_type: string;
  action_details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  book_read: 'Started reading',
  chat_message: 'Sent message',
  summary_generated: 'Generated summary',
  login: 'Logged in',
  signup: 'Signed up',
  feedback_submitted: 'Gave feedback',
  book_completed: 'Finished book',
  streak_milestone: 'Streak milestone',
};

export const AdminActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  const loadActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterType !== 'all') {
        query = query.eq('action_type', filterType);
      }

      const { data: activityData, error } = await query;
      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(activityData?.map(a => a.user_id) || [])];
      
      // Also get user emails from auth if available via profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .in('user_id', userIds);

      const enrichedActivities: ActivityItem[] = activityData?.map(activity => {
        const profile = profiles?.find(p => p.user_id === activity.user_id);
        return {
          ...activity,
          user_name: profile?.full_name || profile?.username || 'User',
          user_email: activity.user_id.substring(0, 8) + '...',
          action_details: activity.action_details as Record<string, unknown> | null,
        };
      }) || [];

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();

    const channel = supabase
      .channel('admin-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_activity' },
        () => loadActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterType]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'book_read': return <Book className="w-4 h-4" />;
      case 'book_completed': return <Book className="w-4 h-4" />;
      case 'chat_message': return <MessageSquare className="w-4 h-4" />;
      case 'summary_generated': return <Zap className="w-4 h-4" />;
      case 'login': return <LogIn className="w-4 h-4" />;
      case 'signup': return <User className="w-4 h-4" />;
      case 'feedback_submitted': return <Star className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'book_read': return 'bg-primary/10 text-primary border-primary/20';
      case 'book_completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'chat_message': return 'bg-accent/10 text-accent border-accent/20';
      case 'summary_generated': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'login': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'signup': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'feedback_submitted': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatActionDetails = (details: Record<string, unknown> | null): string => {
    if (!details) return '';
    
    // Format details as human-readable text
    const parts: string[] = [];
    if (details.book_title) parts.push(`Book: "${details.book_title}"`);
    if (details.rating) parts.push(`Rating: ${details.rating}/5`);
    if (details.streak) parts.push(`Streak: ${details.streak} days`);
    if (details.page) parts.push(`Page: ${details.page}`);
    
    return parts.join(' • ');
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User Name', 'User ID', 'Action', 'Description', 'Details'];
    const rows = activities.map(a => [
      format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss'),
      a.user_name,
      a.user_id,
      ACTION_LABELS[a.action_type] || a.action_type.replace(/_/g, ' '),
      a.action_type,
      formatActionDetails(a.action_details) || 'No additional details'
    ]);

    // Add summary
    rows.push(['---', '---', '---', '---', '---', '---']);
    rows.push([`Export Date: ${format(new Date(), 'PPpp')}`, `Total Activities: ${activities.length}`, '', '', '', '']);

    const csvContent = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocturn-activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-morphism border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              Activity Feed
            </CardTitle>
            <CardDescription className="mt-1">
              Real-time user activity monitoring • {activities.length} events
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="book_read">Reading</SelectItem>
                <SelectItem value="book_completed">Completed</SelectItem>
                <SelectItem value="chat_message">Messages</SelectItem>
                <SelectItem value="summary_generated">Summaries</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
                <SelectItem value="signup">Signups</SelectItem>
                <SelectItem value="feedback_submitted">Feedback</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadActivities} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9 gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading activities...</span>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No activity recorded</p>
              <p className="text-sm mt-1">User actions will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/20 transition-all"
                >
                  <div className={`p-2 rounded-lg shrink-0 border ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{activity.user_name}</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {ACTION_LABELS[activity.action_type] || activity.action_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {activity.action_details && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatActionDetails(activity.action_details)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
