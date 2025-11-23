import { useState, useEffect } from "react";
import { Volume2, VolumeX, BookmarkPlus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

interface SummaryDisplayProps {
  summary: string;
  bookTitle: string;
}

export const SummaryDisplay = ({ summary, bookTitle }: SummaryDisplayProps) => {
  const [isReading, setIsReading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [cleanSummary, setCleanSummary] = useState("");

  useEffect(() => {
    // Clean the summary text by removing markdown symbols
    const cleaned = summary
      .replace(/#+\s/g, '') // Remove # headers
      .replace(/[-*_]{2,}/g, '') // Remove --- or *** dividers
      .replace(/^\s*[-*]\s/gm, '') // Remove bullet points
      .replace(/\*\*/g, '') // Remove bold **
      .replace(/__/g, '') // Remove underline __
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links but keep text
      .trim();
    setCleanSummary(cleaned);
  }, [summary]);

  const handleTextToSpeech = () => {
    if (isReading && utterance) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    const newUtterance = new SpeechSynthesisUtterance(cleanSummary);
    newUtterance.rate = 0.9;
    newUtterance.pitch = 1;
    newUtterance.volume = 1;

    // Get available voices and randomly select male or female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoices = voices.filter(voice => 
      voice.name.toLowerCase().includes('female') || 
      voice.name.toLowerCase().includes('woman') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Victoria') ||
      voice.name.includes('Karen') ||
      voice.name.includes('Zira')
    );
    const maleVoices = voices.filter(voice => 
      voice.name.toLowerCase().includes('male') || 
      voice.name.toLowerCase().includes('man') ||
      voice.name.includes('Daniel') ||
      voice.name.includes('Alex') ||
      voice.name.includes('Fred') ||
      voice.name.includes('David')
    );

    // Randomly choose between male and female
    const useFemale = Math.random() > 0.5;
    const selectedVoices = useFemale ? femaleVoices : maleVoices;
    
    if (selectedVoices.length > 0) {
      const randomVoice = selectedVoices[Math.floor(Math.random() * selectedVoices.length)];
      newUtterance.voice = randomVoice;
      console.log(`Selected voice: ${randomVoice.name} (${useFemale ? 'Female' : 'Male'})`);
    }

    newUtterance.onend = () => {
      setIsReading(false);
    };

    newUtterance.onerror = () => {
      setIsReading(false);
      toast({
        title: "Error",
        description: "Failed to read summary",
        variant: "destructive",
      });
    };

    setUtterance(newUtterance);
    window.speechSynthesis.speak(newUtterance);
    setIsReading(true);
  };

  const handleBookmark = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save bookmarks",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the book first
      const { data: book } = await supabase
        .from('books')
        .select('id')
        .ilike('title', `%${bookTitle}%`)
        .limit(1)
        .maybeSingle();

      if (!book) {
        toast({
          title: "Error",
          description: "Book not found in database",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          book_id: book.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already saved",
            description: "This book is already in your library",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Saved!",
        description: "Book added to your library",
      });
    } catch (error) {
      console.error('Error saving bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to save bookmark",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(cleanSummary);
    toast({
      title: "Copied!",
      description: "Summary copied to clipboard",
    });
  };

  return (
    <Card className="p-4 md:p-8 bg-card/50 backdrop-blur-sm border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent line-clamp-2">
            {bookTitle}
          </h2>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTextToSpeech}
              className="hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
            >
              {isReading ? (
                <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleBookmark}
              className="hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <BookmarkPlus className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="hover:bg-secondary hover:text-secondary-foreground transition-colors shrink-0"
            >
              <Share2 className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>

        <div className="prose prose-sm md:prose-lg max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 text-sm md:text-base">
            {cleanSummary}
          </div>
        </div>
      </div>
    </Card>
  );
};
