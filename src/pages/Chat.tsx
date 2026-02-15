import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Target, BookOpen, Home, Library as LibraryIcon, Compass, Sparkles, Book, Brain, Zap, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasActiveGoal, setHasActiveGoal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadChatHistory();
    checkActiveGoal();
  }, [user, navigate]);

  const checkActiveGoal = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    
    setHasActiveGoal(!!data);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      if (data) {
        setMessages(data.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: { 
          message: userMessage,
          chatHistory: messages
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      
      // Check if goal was created or if user has active goal
      if (data.goalCreated) {
        setHasActiveGoal(true);
        toast({
          title: "Reading Plan Created! 🎉",
          description: "Check your Dashboard to start reading.",
        });
      } else if (data.hasActiveGoal) {
        setHasActiveGoal(true);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedGoals = [
    { label: "Leadership Skills", icon: Brain, message: "I want to become a better leader" },
    { label: "Start a Business", icon: Zap, message: "I want to start my own business" },
    { label: "Boost Productivity", icon: Sparkles, message: "I want to improve my productivity" },
    { label: "Personal Finance", icon: Book, message: "I want to master personal finance" },
  ];

  if (loadingHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center" role="status" aria-label="Loading chat">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <Target className="absolute inset-0 m-auto w-5 h-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Skip to content link for screen readers */}
      <a 
        href="#chat-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to chat
      </a>

      {/* Top spacing */}
      <div className="h-10 bg-background" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20" role="banner">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  AI Goal Coach
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Create your perfect reading plan</p>
              </div>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} aria-label="Go to Dashboard" className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm">
                <Home className="w-4 h-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/library')} aria-label="Go to Library" className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm">
                <LibraryIcon className="w-4 h-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Library</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/explore')} aria-label="Go to Explore" className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm">
                <Compass className="w-4 h-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Explore</span>
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main id="chat-content" className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-4xl" role="main">
        <Card className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] lg:h-[calc(100vh-200px)] shadow-2xl border-border/50 glass-morphism overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-3 sm:p-4 lg:p-6" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 lg:p-8">
                {/* Welcome Illustration */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center backdrop-blur-sm border border-primary/20">
                    <Target className="w-10 h-10 sm:w-12 sm:h-12 text-primary" aria-hidden="true" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center animate-bounce">
                    <Sparkles className="w-4 h-4 text-accent" />
                  </div>
                </div>
                
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  What's your goal?
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-6 sm:mb-8 leading-relaxed">
                  Tell me what you want to achieve. I'll ask a few questions to understand your needs, then craft the perfect reading plan from the world's best books.
                </p>
                
                {/* Suggested Goals Grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
                  {suggestedGoals.map((goal) => (
                    <button
                      key={goal.label}
                      onClick={() => setInput(goal.message)}
                      className="group p-3 sm:p-4 rounded-xl bg-card/50 hover:bg-primary/10 border border-border/50 hover:border-primary/30 transition-all duration-200 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <goal.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">{goal.label}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{goal.message}</p>
                    </button>
                  ))}
                </div>

                {/* Conversational Info */}
                <div className="mt-6 sm:mt-8 p-3 sm:p-4 rounded-xl bg-muted/30 border border-border/30 max-w-md">
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <span className="text-xs sm:text-sm font-medium text-foreground">Conversational & Personalized</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    I'll ask thoughtful questions to understand exactly what you need before recommending books from my knowledge of thousands of titles worldwide.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5" role="log" aria-label="Chat messages" aria-live="polite">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg'
                          : 'bg-card/80 backdrop-blur border border-border/50 shadow-sm'
                      }`}
                      role="article"
                      aria-label={msg.role === 'user' ? 'Your message' : 'AI response'}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
                          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <span className="text-xs font-semibold text-primary">AI Goal Coach</span>
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-sm sm:text-base [&>p]:mb-2 [&>p:last-child]:mb-0">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start" role="status" aria-label="AI is thinking">
                    <div className="bg-card/80 backdrop-blur border border-border/50 rounded-2xl px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 sm:p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
            {hasActiveGoal && messages.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20" role="status">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">You have an active reading goal</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Complete your current plan to set a new goal</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="shrink-0 text-xs"
                  >
                    View Plan
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <label htmlFor="chat-input" className="sr-only">Type your message</label>
              <Input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={hasActiveGoal ? "Complete your current goal first..." : "Tell me what you want to achieve..."}
                className="flex-1 h-11 sm:h-12 text-sm sm:text-base bg-card/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={isLoading || hasActiveGoal}
                aria-describedby={hasActiveGoal ? "active-goal-notice" : undefined}
              />
              {hasActiveGoal && <span id="active-goal-notice" className="sr-only">You must complete your current reading plan before setting a new goal</span>}
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || hasActiveGoal}
                size="icon"
                className="shrink-0 h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                aria-label={isLoading ? "Sending message" : "Send message"}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-5 h-5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </main>
      <MobileBottomNav />
      {isMobile && <div className="h-16" />}
    </div>
  );
};

export default Chat;
