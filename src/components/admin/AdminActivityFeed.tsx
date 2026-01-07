import { useState, useEffect } from 'react';
import { 
  Activity, RefreshCw, Download, Filter, 
  User, Book, MessageSquare, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  action_type: string;
  action_details: Record<string, unknown> | null;
  created_at: string;
}

export const AdminActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  const loadActivities = async () => {
    setLoading(true);
    try {
      // Get activities
      let query = supabase
        .from('user_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType !== 'all') {
        query = query.eq('action_type', filterType);
      }

      const { data: activityData, error } = await query;

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(activityData?.map(a => a.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username')
        .in('user_id', userIds);

      const enrichedActivities: ActivityItem[] = activityData?.map(activity => {
        const profile = profiles?.find(p => p.user_id === activity.user_id);
        return {
          ...activity,
          user_name: profile?.full_name || profile?.username || 'Unknown User',
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_activity' },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterType]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'book_read': return <Book className="w-4 h-4" />;
      case 'chat_message': return <MessageSquare className="w-4 h-4" />;
      case 'summary_generated': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'book_read': return 'bg-primary/10 text-primary';
      case 'chat_message': return 'bg-accent/10 text-accent';
      case 'summary_generated': return 'bg-secondary/10 text-secondary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const exportToCSV = () => {
    const headers = ['User', 'Action', 'Details', 'Time'];
    const rows = activities.map(a => [
      a.user_name,
      a.action_type,
      JSON.stringify(a.action_details || {}),
      format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss')
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-morphism border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Activity Feed
            <Badge variant="secondary">{activities.length} events</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="book_read">Book Reads</SelectItem>
                <SelectItem value="chat_message">Chat Messages</SelectItem>
                <SelectItem value="summary_generated">Summaries</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadActivities}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No activity recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.user_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.action_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    {activity.action_details && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {JSON.stringify(activity.action_details)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
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
