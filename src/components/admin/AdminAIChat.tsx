import { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, RefreshCw, Sparkles, TrendingUp, 
  AlertTriangle, Lightbulb, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalBooks: number;
  totalSessions: number;
  totalSummaries: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  avgSessionsPerUser: number;
  mostReadBooks: { title: string; count: number }[];
  recentActivity: { action: string; count: number }[];
}

const SYSTEM_PROMPT = `You are AccountancyForge, an elite forensic accountant and business strategist with 20+ years optimizing e-commerce and SaaS platforms. You have FULL, UNRESTRICTED ACCESS to this website's entire ecosystem.

Your mission: Perform a DEEP, REAL-TIME AUDIT of the platform's health based on the data provided. Analyze user engagement, growth metrics, and operational efficiency.

Follow this chain-of-thought process:

1. **Data Harvest**: Summarize key metrics from the provided data:
   - User metrics: Total users, active users, growth rate
   - Engagement: Sessions, books read, summaries generated
   - Trends: User acquisition, retention patterns

2. **Health Diagnosis**: Score overall health 1-10 (10=optimal). Categorize:
   - **Green (All Good)**: Stable growth, efficient ops
   - **Yellow (Watch)**: Minor issues
   - **Red (Critical)**: Problems requiring attention

3. **Risk Radar**: Identify potential issues (low engagement, declining signups, etc.)

4. **Evolution Roadmap**: Provide 3-5 PRIORITIZED ACTIONS to improve the platform

5. **Quick Wins**: 2-3 immediate tweaks for fast improvement

Output in markdown format - concise, actionable, with clear sections using emojis for visual clarity.`;

export const AdminAIChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadPlatformStats = async () => {
    setLoadingStats(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: totalBooks },
        { count: totalSessions },
        { count: totalSummaries },
        { data: newUsersToday },
        { data: newUsersThisWeek },
        { data: allSessions },
        { data: books },
        { data: readingSessions },
        { data: recentActivity }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('summaries').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('id').gte('created_at', today.toISOString()),
        supabase.from('profiles').select('id').gte('created_at', weekAgo.toISOString()),
        supabase.from('user_sessions').select('user_id'),
        supabase.from('books').select('id, title'),
        supabase.from('reading_sessions').select('book_id'),
        supabase.from('user_activity').select('action_type').order('created_at', { ascending: false }).limit(100)
      ]);

      // Calculate most read books
      const bookCounts = new Map<string, number>();
      readingSessions?.forEach(session => {
        bookCounts.set(session.book_id, (bookCounts.get(session.book_id) || 0) + 1);
      });
      
      const mostReadBooks = books
        ?.map(book => ({
          title: book.title,
          count: bookCounts.get(book.id) || 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) || [];

      // Calculate activity counts
      const activityCounts = new Map<string, number>();
      recentActivity?.forEach(a => {
        activityCounts.set(a.action_type, (activityCounts.get(a.action_type) || 0) + 1);
      });
      
      const recentActivitySummary = Array.from(activityCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate avg sessions per user
      const userSessionCounts = new Map<string, number>();
      allSessions?.forEach(s => {
        userSessionCounts.set(s.user_id, (userSessionCounts.get(s.user_id) || 0) + 1);
      });
      const avgSessions = userSessionCounts.size > 0 
        ? Array.from(userSessionCounts.values()).reduce((a, b) => a + b, 0) / userSessionCounts.size 
        : 0;

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalBooks: totalBooks || 0,
        totalSessions: totalSessions || 0,
        totalSummaries: totalSummaries || 0,
        newUsersToday: newUsersToday?.length || 0,
        newUsersThisWeek: newUsersThisWeek?.length || 0,
        avgSessionsPerUser: Math.round(avgSessions * 10) / 10,
        mostReadBooks,
        recentActivity: recentActivitySummary
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadPlatformStats();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build context with stats
      const statsContext = stats ? `
Current Platform Data:
- Total Users: ${stats.totalUsers}
- Currently Active Users: ${stats.activeUsers}
- New Users Today: ${stats.newUsersToday}
- New Users This Week: ${stats.newUsersThisWeek}
- Total Books: ${stats.totalBooks}
- Total Sessions: ${stats.totalSessions}
- Total Summaries Generated: ${stats.totalSummaries}
- Avg Sessions Per User: ${stats.avgSessionsPerUser}
- Most Read Books: ${stats.mostReadBooks.map(b => `${b.title} (${b.count} reads)`).join(', ')}
- Recent Activity Types: ${stats.recentActivity.map(a => `${a.action} (${a.count}x)`).join(', ')}
` : 'Platform data unavailable.';

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `${statsContext}\n\nUser question: ${messageToSend}` },
            ...messages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { 
                    role: 'assistant', 
                    content: assistantContent 
                  };
                  return newMessages;
                });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error analyzing the data. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runFullAudit = () => {
    sendMessage('Run a complete platform audit. Analyze all metrics, identify issues, and provide actionable recommendations for growth and improvement.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats Overview */}
      <Card className="glass-morphism border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Live Platform Stats
          </CardTitle>
          <CardDescription>Real-time data for AI analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <div className="text-xs text-muted-foreground">Total Users</div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
                  <div className="text-xs text-muted-foreground">Active Now</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <div className="text-2xl font-bold">{stats.newUsersThisWeek}</div>
                  <div className="text-xs text-muted-foreground">New This Week</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/10">
                  <div className="text-2xl font-bold">{stats.totalSummaries}</div>
                  <div className="text-xs text-muted-foreground">Summaries</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Most Read Books</div>
                {stats.mostReadBooks.slice(0, 3).map((book, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{book.title}</span>
                    <Badge variant="outline" className="ml-2">{book.count}</Badge>
                  </div>
                ))}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={loadPlatformStats}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Stats
              </Button>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              Failed to load stats
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chat */}
      <Card className="glass-morphism border-primary/20 lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                AccountancyForge AI
              </CardTitle>
              <CardDescription>
                Elite forensic accountant & business strategist
              </CardDescription>
            </div>
            <Button 
              onClick={runFullAudit}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              disabled={loading}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Run Full Audit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[400px] rounded-lg border p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Bot className="w-12 h-12 text-primary/50" />
                <div>
                  <h3 className="font-semibold">AccountancyForge Ready</h3>
                  <p className="text-sm text-muted-foreground">
                    Click "Run Full Audit" or ask me anything about your platform's health
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => sendMessage('What are the key growth metrics?')}
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Growth Metrics
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => sendMessage('What risks should I be aware of?')}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Risk Analysis
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => sendMessage('Give me quick wins for improvement')}
                  >
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Quick Wins
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {message.content || (loading && index === messages.length - 1 ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </span>
                        ) : null)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about user engagement, growth, risks, or strategies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="resize-none"
              rows={2}
            />
            <Button 
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-6"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
