import { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, RefreshCw, Sparkles, TrendingUp, 
  AlertTriangle, Lightbulb, BarChart3, CheckCircle2
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

// Clean markdown symbols from text
const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*/g, '')  // Remove bold
    .replace(/\*/g, '')    // Remove italic
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/`/g, '')     // Remove code ticks
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .trim();
};

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

      // Get all profiles for accurate user count
      const { data: profiles } = await supabase.from('profiles').select('user_id, created_at');
      const totalUsers = profiles?.length || 0;
      const existingUserIds = new Set(profiles?.map(p => p.user_id) || []);

      // Get active sessions for existing users only
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('user_id')
        .eq('is_active', true)
        .gte('last_seen_at', fiveMinutesAgo);
      
      const activeUsers = activeSessions?.filter(s => existingUserIds.has(s.user_id)).length || 0;

      const [
        { count: totalBooks },
        { count: totalSessions },
        { count: totalSummaries },
        { data: books },
        { data: readingSessions },
        { data: recentActivity }
      ] = await Promise.all([
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('summaries').select('*', { count: 'exact', head: true }),
        supabase.from('books').select('id, title'),
        supabase.from('reading_sessions').select('book_id'),
        supabase.from('user_activity').select('action_type').order('created_at', { ascending: false }).limit(100)
      ]);

      // New users calculations
      const newUsersToday = profiles?.filter(p => new Date(p.created_at) >= today).length || 0;
      const newUsersThisWeek = profiles?.filter(p => new Date(p.created_at) >= weekAgo).length || 0;

      // Most read books
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

      // Activity counts
      const activityCounts = new Map<string, number>();
      recentActivity?.forEach(a => {
        activityCounts.set(a.action_type, (activityCounts.get(a.action_type) || 0) + 1);
      });
      
      const recentActivitySummary = Array.from(activityCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

      // Avg sessions per user
      const avgSessions = totalUsers > 0 ? Math.round(((totalSessions || 0) / totalUsers) * 10) / 10 : 0;

      setStats({
        totalUsers,
        activeUsers,
        totalBooks: totalBooks || 0,
        totalSessions: totalSessions || 0,
        totalSummaries: totalSummaries || 0,
        newUsersToday,
        newUsersThisWeek,
        avgSessionsPerUser: avgSessions,
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`https://rldrcongresqaqbebceb.supabase.co/functions/v1/admin-ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: messageToSend }
          ],
          platformStats: stats
        })
      });

      if (!response.ok) throw new Error('Failed to get AI response');

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
                    content: cleanMarkdown(assistantContent)
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
        content: 'Error analyzing data. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runFullAudit = () => {
    sendMessage('Analyze the platform health. Give a brief score out of 10, top 3 strengths, top 3 concerns, and 3 priority actions. Be concise and direct.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats Panel */}
      <Card className="glass-morphism border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            Live Stats
          </CardTitle>
          <CardDescription className="text-xs">Real-time data for AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <div className="text-xs text-muted-foreground">Total Users</div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
                  <div className="text-xs text-muted-foreground">Active Now</div>
                </div>
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="text-2xl font-bold">{stats.newUsersThisWeek}</div>
                  <div className="text-xs text-muted-foreground">New This Week</div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                  <div className="text-2xl font-bold">{stats.totalSummaries}</div>
                  <div className="text-xs text-muted-foreground">Summaries</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Top Books</div>
                {stats.mostReadBooks.slice(0, 3).map((book, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                    <span className="truncate flex-1 mr-2">{book.title || 'Untitled'}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{book.count}</Badge>
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
                Refresh
              </Button>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-4 text-sm">
              Failed to load stats
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chat */}
      <Card className="glass-morphism border-primary/20 lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                Platform Analyst
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                AI-powered insights
              </CardDescription>
            </div>
            <Button 
              onClick={runFullAudit}
              size="sm"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              disabled={loading}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Run Audit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ScrollArea className="h-[380px] rounded-xl border bg-muted/20 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Ready to Analyze</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Run Audit" or ask a question
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10 text-xs py-1.5 px-3"
                    onClick={() => sendMessage('What are the key growth metrics?')}
                  >
                    <TrendingUp className="w-3 h-3 mr-1.5" />
                    Growth
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10 text-xs py-1.5 px-3"
                    onClick={() => sendMessage('What risks should I watch?')}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1.5" />
                    Risks
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10 text-xs py-1.5 px-3"
                    onClick={() => sendMessage('Give me 3 quick wins')}
                  >
                    <Lightbulb className="w-3 h-3 mr-1.5" />
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
                      className={`max-w-[85%] rounded-xl p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/80'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
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
              placeholder="Ask about users, engagement, risks..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="resize-none text-sm"
              rows={2}
            />
            <Button 
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-auto px-4"
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
