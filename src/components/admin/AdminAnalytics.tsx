import { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Book, Activity, Download, 
  TrendingUp, Calendar, RefreshCw, ArrowUp, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from 'recharts';

type TimeFrame = '7d' | '30d' | '90d' | '1y';
type Metric = 'signups' | 'sessions' | 'books_read' | 'summaries';
type Granularity = 'daily' | 'weekly' | 'monthly';

interface ChartData {
  date: string;
  value: number;
  label: string;
}

export const AdminAnalytics = () => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [xMetric, setXMetric] = useState<Metric>('signups');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBooks: 0,
    totalSessions: 0,
    totalSummaries: 0,
    activeNow: 0,
    userGrowth: 0,
  });

  const getDateRange = () => {
    const end = new Date();
    let start: Date;
    switch (timeFrame) {
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '90d': start = subDays(end, 90); break;
      case '1y': start = subDays(end, 365); break;
      default: start = subDays(end, 30);
    }
    return { start, end };
  };

  const loadStats = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total books
      const { count: totalBooks } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true });

      // Total sessions
      const { count: totalSessions } = await supabase
        .from('user_sessions')
        .select('*', { count: 'exact', head: true });

      // Total summaries
      const { count: totalSummaries } = await supabase
        .from('summaries')
        .select('*', { count: 'exact', head: true });

      // Active now - only count sessions where the user still exists
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Get all existing user_ids from profiles
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('user_id');
      
      const existingUserIds = new Set(existingProfiles?.map(p => p.user_id) || []);
      
      // Get active sessions
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('user_id')
        .eq('is_active', true)
        .gte('last_seen_at', fiveMinutesAgo);
      
      // Count only sessions for existing users
      const activeNow = activeSessions?.filter(s => existingUserIds.has(s.user_id)).length || 0;

      // User growth (last 7 days vs previous 7 days)
      const sevenDaysAgo = subDays(new Date(), 7);
      const fourteenDaysAgo = subDays(new Date(), 14);
      
      const { count: recentUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      const { count: previousUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      const growth = previousUsers ? ((recentUsers || 0) - previousUsers) / previousUsers * 100 : 0;

      setStats({
        totalUsers: totalUsers || 0,
        totalBooks: totalBooks || 0,
        totalSessions: totalSessions || 0,
        totalSummaries: totalSummaries || 0,
        activeNow: activeNow || 0,
        userGrowth: Math.round(growth),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadChartData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Get intervals based on granularity
      let intervals: Date[];
      switch (granularity) {
        case 'weekly':
          intervals = eachWeekOfInterval({ start, end });
          break;
        case 'monthly':
          intervals = eachMonthOfInterval({ start, end });
          break;
        default:
          intervals = eachDayOfInterval({ start, end });
      }

      // Fetch data based on selected metric
      let data: any[] = [];
      switch (xMetric) {
        case 'signups':
          const { data: profiles } = await supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
          data = profiles || [];
          break;
        case 'sessions':
          const { data: sessions } = await supabase
            .from('user_sessions')
            .select('started_at')
            .gte('started_at', start.toISOString())
            .lte('started_at', end.toISOString());
          data = sessions?.map(s => ({ created_at: s.started_at })) || [];
          break;
        case 'books_read':
          const { data: readings } = await supabase
            .from('reading_sessions')
            .select('started_at')
            .gte('started_at', start.toISOString())
            .lte('started_at', end.toISOString());
          data = readings?.map(r => ({ created_at: r.started_at })) || [];
          break;
        case 'summaries':
          const { data: summaries } = await supabase
            .from('summaries')
            .select('created_at')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
          data = summaries || [];
          break;
      }

      // Group data by interval
      const chartData: ChartData[] = intervals.map(intervalStart => {
        let intervalEnd: Date;
        let dateFormat: string;
        
        switch (granularity) {
          case 'weekly':
            intervalEnd = new Date(intervalStart);
            intervalEnd.setDate(intervalEnd.getDate() + 7);
            dateFormat = 'MMM d';
            break;
          case 'monthly':
            intervalEnd = new Date(intervalStart);
            intervalEnd.setMonth(intervalEnd.getMonth() + 1);
            dateFormat = 'MMM yyyy';
            break;
          default:
            intervalEnd = endOfDay(intervalStart);
            dateFormat = 'MMM d';
        }

        const count = data.filter(item => {
          const itemDate = new Date(item.created_at);
          return itemDate >= intervalStart && itemDate < intervalEnd;
        }).length;

        return {
          date: intervalStart.toISOString(),
          value: count,
          label: format(intervalStart, dateFormat),
        };
      });

      setChartData(chartData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadChartData();
  }, [timeFrame, xMetric, granularity]);

  const exportChartData = () => {
    const headers = ['Date', 'Value'];
    const rows = chartData.map(d => [d.label, d.value]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${xMetric}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricLabels: Record<Metric, string> = {
    signups: 'User Signups',
    sessions: 'Login Sessions',
    books_read: 'Books Started',
    summaries: 'Summaries Generated',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              {stats.userGrowth !== 0 && (
                <Badge variant={stats.userGrowth > 0 ? 'default' : 'destructive'} className="gap-1 text-xs">
                  {stats.userGrowth > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(stats.userGrowth)}%
                </Badge>
              )}
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalUsers}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total Users</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-green-500/20 hover:border-green-500/40 transition-all hover:shadow-lg hover:shadow-green-500/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.activeNow}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Active Now</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-accent/20 hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/10">
          <CardContent className="p-3 sm:p-4">
            <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10 w-fit">
              <Book className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalBooks}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total Books</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-secondary/20 hover:border-secondary/40 transition-all hover:shadow-lg hover:shadow-secondary/10">
          <CardContent className="p-3 sm:p-4">
            <div className="p-1.5 sm:p-2 rounded-lg bg-secondary/10 w-fit">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalSessions}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total Sessions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10 col-span-2">
          <CardContent className="p-3 sm:p-4">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 w-fit">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalSummaries}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Summaries Generated</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Controls */}
      <Card className="glass-morphism border-primary/20 overflow-hidden">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Analytics Chart
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={xMetric} onValueChange={(v) => setXMetric(v as Metric)}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signups">User Signups</SelectItem>
                  <SelectItem value="sessions">Login Sessions</SelectItem>
                  <SelectItem value="books_read">Books Started</SelectItem>
                  <SelectItem value="summaries">Summaries</SelectItem>
                </SelectContent>
              </Select>

              <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Time frame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={exportChartData} className="h-9 text-xs sm:text-sm">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="h-[250px] sm:h-[350px] lg:h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                <span className="text-xs sm:text-sm text-muted-foreground">Loading data...</span>
              </div>
            </div>
          ) : (
            <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="label" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={8}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickMargin={8}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    name={metricLabels[xMetric]}
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="text-center text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
            {metricLabels[xMetric]} over time ({granularity})
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
