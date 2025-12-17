import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Target, BookOpen, Home, Library as LibraryIcon, Compass, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat = () => {
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
          title: "Reading Plan Created!",
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

  if (loadingHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center" role="status" aria-label="Loading chat">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading chat history...</span>
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

      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-primary/20" role="banner">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary" aria-hidden="true" />
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Goal Coach
              </h1>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} aria-label="Go to Dashboard" className="h-9 px-2 sm:px-3">
                <Home className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/library')} aria-label="Go to Library" className="h-9 px-2 sm:px-3">
                <LibraryIcon className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Library</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/explore')} aria-label="Go to Explore" className="h-9 px-2 sm:px-3">
                <Compass className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Explore</span>
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main id="chat-content" className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-4xl" role="main">
        <Card className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] lg:h-[calc(100vh-200px)] shadow-2xl border-border/50 glass-morphism">
          {/* Messages */}
          <ScrollArea className="flex-1 p-3 sm:p-4 lg:p-6" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 lg:p-8">
                <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 sm:mb-6">
                  <Target className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 sm:mb-4">Set Your Reading Goals</h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-4 sm:mb-6">
                  Tell me what you want to achieve, and I'll recommend the perfect books and create a personalized reading plan for you.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("I want to become a better leader")}
                    aria-label="Set goal: Leadership Skills"
                    className="text-xs sm:text-sm"
                  >
                    Leadership Skills
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("I want to start my own business")}
                    aria-label="Set goal: Entrepreneurship"
                    className="text-xs sm:text-sm"
                  >
                    Entrepreneurship
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("I want to improve my productivity")}
                    aria-label="Set goal: Productivity"
                    className="text-xs sm:text-sm"
                  >
                    Productivity
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6" role="log" aria-label="Chat messages" aria-live="polite">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 lg:px-5 lg:py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted/50 backdrop-blur'
                      }`}
                      role="article"
                      aria-label={msg.role === 'user' ? 'Your message' : 'AI response'}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-primary" aria-hidden="true" />
                          <span className="text-[10px] sm:text-xs font-semibold text-primary">AI Coach</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start" role="status" aria-label="AI is typing">
                    <div className="bg-muted/50 backdrop-blur rounded-2xl px-4 py-3">
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-primary" aria-hidden="true" />
                      <span className="sr-only">AI is typing...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 sm:p-4 border-t border-border/50 bg-background/50 backdrop-blur">
            {hasActiveGoal && messages.length > 0 && (
              <div className="mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg bg-primary/10 border border-primary/20 text-center" role="status">
                <p className="font-medium text-xs sm:text-sm">You have an active reading goal</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Complete your current plan to set a new goal</p>
              </div>
            )}
            <div className="flex gap-2">
              <label htmlFor="chat-input" className="sr-only">Type your message</label>
              <Input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={hasActiveGoal ? "Complete your current goal first..." : "Describe your goals..."}
                className="flex-1 h-10 sm:h-11 text-sm sm:text-base bg-background/80 border-border/50"
                disabled={isLoading || hasActiveGoal}
                aria-describedby={hasActiveGoal ? "active-goal-notice" : undefined}
              />
              {hasActiveGoal && <span id="active-goal-notice" className="sr-only">You must complete your current reading plan before setting a new goal</span>}
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || hasActiveGoal}
                size="icon"
                className="shrink-0 h-10 w-10 sm:h-11 sm:w-11"
                aria-label={isLoading ? "Sending message" : "Send message"}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Chat;