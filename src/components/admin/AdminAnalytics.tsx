import { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Book, Activity, Download, 
  TrendingUp, Calendar, RefreshCw, ArrowUp, ArrowDown,
  Clock, Zap, Eye, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

type TimeFrame = '7d' | '30d' | '90d' | '1y';
type Metric = 'signups' | 'sessions' | 'books_read' | 'summaries';
type Granularity = 'daily' | 'weekly' | 'monthly';

interface ChartData {
  date: string;
  value: number;
  label: string;
}

interface Stats {
  totalUsers: number;
  totalBooks: number;
  totalSessions: number;
  totalSummaries: number;
  activeNow: number;
  userGrowth: number;
  avgSessionDuration: string;
  totalReadingTime: number;
  booksCompletedThisWeek: number;
}

export const AdminAnalytics = () => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [xMetric, setXMetric] = useState<Metric>('signups');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBooks: 0,
    totalSessions: 0,
    totalSummaries: 0,
    activeNow: 0,
    userGrowth: 0,
    avgSessionDuration: '0m',
    totalReadingTime: 0,
    booksCompletedThisWeek: 0,
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
      // Get all profile user_ids first for accurate counting
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, created_at');
      
      const totalUsers = profiles?.length || 0;
      const existingUserIds = new Set(profiles?.map(p => p.user_id) || []);

      // Total books
      const { count: totalBooks } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true });

      // Total sessions (only for existing users)
      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('user_id, started_at, ended_at, is_active, last_seen_at');
      
      const validSessions = allSessions?.filter(s => existingUserIds.has(s.user_id)) || [];
      const totalSessions = validSessions.length;

      // Total summaries
      const { count: totalSummaries } = await supabase
        .from('summaries')
        .select('*', { count: 'exact', head: true });

      // Active now - users active in last 5 minutes with existing profiles
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const activeNow = validSessions.filter(s => 
        s.is_active && new Date(s.last_seen_at) >= new Date(fiveMinutesAgo)
      ).length;

      // User growth (last 7 days vs previous 7 days)
      const sevenDaysAgo = subDays(new Date(), 7);
      const fourteenDaysAgo = subDays(new Date(), 14);
      
      const recentUsers = profiles?.filter(p => new Date(p.created_at) >= sevenDaysAgo).length || 0;
      const previousUsers = profiles?.filter(p => 
        new Date(p.created_at) >= fourteenDaysAgo && new Date(p.created_at) < sevenDaysAgo
      ).length || 0;

      const growth = previousUsers ? Math.round(((recentUsers - previousUsers) / previousUsers) * 100) : 0;

      // Books completed this week
      const { count: booksCompletedThisWeek } = await supabase
        .from('reading_sessions')
        .select('*', { count: 'exact', head: true })
        .not('completed_at', 'is', null)
        .gte('completed_at', sevenDaysAgo.toISOString());

      setStats({
        totalUsers,
        totalBooks: totalBooks || 0,
        totalSessions,
        totalSummaries: totalSummaries || 0,
        activeNow,
        userGrowth: growth,
        avgSessionDuration: '12m',
        totalReadingTime: totalSessions * 12,
        booksCompletedThisWeek: booksCompletedThisWeek || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadChartData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
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
    const metricName = metricLabels[xMetric];
    const headers = ['Date', metricName, 'Period'];
    const rows = chartData.map(d => [
      d.label,
      d.value.toString(),
      granularity
    ]);

    // Add summary row
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    rows.push(['---', '---', '---']);
    rows.push(['TOTAL', total.toString(), `${timeFrame} period`]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocturn-${xMetric}-${timeFrame}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricLabels: Record<Metric, string> = {
    signups: 'New Users',
    sessions: 'Login Sessions',
    books_read: 'Books Started',
    summaries: 'Summaries Generated',
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Users */}
        <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-all group">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Users className="w-5 h-5 text-primary" />
              </div>
              {stats.userGrowth !== 0 && (
                <Badge 
                  variant={stats.userGrowth > 0 ? 'default' : 'destructive'} 
                  className="gap-1 text-xs font-medium"
                >
                  {stats.userGrowth > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(stats.userGrowth)}%
                </Badge>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-2xl font-bold tracking-tight">{stats.totalUsers}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Users</div>
            </div>
          </CardContent>
        </Card>

        {/* Active Now */}
        <Card className="glass-morphism border-green-500/20 hover:border-green-500/40 transition-all group">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <Eye className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-600 font-medium">LIVE</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-2xl font-bold tracking-tight text-green-600">{stats.activeNow}</div>
              <div className="text-xs text-muted-foreground font-medium">Active Now</div>
            </div>
          </CardContent>
        </Card>

        {/* Total Books */}
        <Card className="glass-morphism border-accent/20 hover:border-accent/40 transition-all group">
          <CardContent className="p-4">
            <div className="p-2 rounded-xl bg-accent/10 w-fit group-hover:bg-accent/20 transition-colors">
              <Book className="w-5 h-5 text-accent" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-2xl font-bold tracking-tight">{stats.totalBooks}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Books</div>
            </div>
          </CardContent>
        </Card>

        {/* Total Sessions */}
        <Card className="glass-morphism border-secondary/20 hover:border-secondary/40 transition-all group">
          <CardContent className="p-4">
            <div className="p-2 rounded-xl bg-secondary/10 w-fit group-hover:bg-secondary/20 transition-colors">
              <Activity className="w-5 h-5 text-secondary" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-2xl font-bold tracking-tight">{stats.totalSessions}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Sessions</div>
            </div>
          </CardContent>
        </Card>

        {/* Summaries Generated */}
        <Card className="glass-morphism border-primary/20 hover:border-primary/40 transition-all group">
          <CardContent className="p-4">
            <div className="p-2 rounded-xl bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-2xl font-bold tracking-tight">{stats.totalSummaries}</div>
              <div className="text-xs text-muted-foreground font-medium">Summaries</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="glass-morphism border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                Analytics Overview
              </CardTitle>
              <CardDescription className="mt-1">
                Track key metrics over time
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={xMetric} onValueChange={(v) => setXMetric(v as Metric)}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signups">New Users</SelectItem>
                  <SelectItem value="sessions">Sessions</SelectItem>
                  <SelectItem value="books_read">Books Started</SelectItem>
                  <SelectItem value="summaries">Summaries</SelectItem>
                </SelectContent>
              </Select>

              <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                <SelectTrigger className="w-[110px] h-9 text-sm">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={exportChartData} className="h-9 gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[350px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading analytics...</span>
              </div>
            </div>
          ) : (
            <div className="h-[350px]">
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
                    fontSize={11}
                    tickMargin={8}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickMargin={8}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '13px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: '4px' }}
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
          <div className="text-center text-sm text-muted-foreground mt-4 font-medium">
            {metricLabels[xMetric]} • {granularity} • Last {timeFrame === '1y' ? 'year' : timeFrame}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
