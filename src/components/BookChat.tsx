import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BookChatProps {
  bookId: string;
  bookTitle: string;
  bookAuthor?: string;
  summary: string;
}

const BookChat = ({ bookId, bookTitle, bookAuthor, summary }: BookChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to chat");
      }

      const { data, error } = await supabase.functions.invoke('chat-with-book', {
        body: {
          message: userMessage,
          bookId,
          bookTitle,
          bookAuthor,
          summary,
          chatHistory: messages,
        },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response",
        variant: "destructive",
      });
      // Remove the user message if the request failed
      setMessages(prev => prev.slice(0, -1));
      setInput(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What are the main themes?",
    "Summarize the key takeaways",
    "How can I apply this?",
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 sm:bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen 
            ? 'bg-muted hover:bg-muted/80 rotate-90' 
            : 'bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 hover:scale-110'
        }`}
        size="icon"
        aria-label={isOpen ? "Close chat" : "Open chat about this book"}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </Button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-[7.5rem] sm:bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[400px] transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <Card className="glass-morphism border-primary/20 shadow-2xl overflow-hidden h-[500px] sm:h-[550px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">Ask about this book</h3>
                <p className="text-xs text-muted-foreground truncate">{bookTitle}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="font-medium text-foreground mb-2">Hi! I'm your reading assistant</h4>
                    <p className="text-sm text-muted-foreground">
                      Ask me anything about "{bookTitle}"
                    </p>
                  </div>
                  
                  {/* Suggested Questions */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Try asking:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestedQuestions.map((question, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 rounded-full hover:bg-primary/10 hover:border-primary/50 transition-all"
                          onClick={() => {
                            setInput(question);
                            inputRef.current?.focus();
                          }}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground'
                          : 'bg-muted/50 text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-secondary" />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted/50 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border/50 bg-background/50">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about this book..."
                className="min-h-[44px] max-h-32 resize-none rounded-xl bg-muted/30 border-border/50 focus:border-primary/50 text-sm"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shrink-0"
                size="icon"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default BookChat;
