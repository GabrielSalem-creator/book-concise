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
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            Activity Feed
            <Badge variant="secondary" className="text-xs">{activities.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] sm:w-[150px] h-9 text-xs sm:text-sm">
                <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
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
            <Button variant="outline" size="sm" onClick={loadActivities} className="h-9">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] sm:h-[500px] lg:h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                <span className="text-xs sm:text-sm text-muted-foreground">Loading...</span>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all"
                >
                  <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-medium text-sm sm:text-base">{activity.user_name}</span>
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        {activity.action_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    {activity.action_details && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                        {JSON.stringify(activity.action_details)}
                      </p>
                    )}
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
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
