import { useState } from "react";
import { Volume2, VolumeX, BookmarkPlus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface SummaryDisplayProps {
  summary: string;
  bookTitle: string;
}

export const SummaryDisplay = ({ summary, bookTitle }: SummaryDisplayProps) => {
  const [isReading, setIsReading] = useState(false);
  const { toast } = useToast();
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  const handleTextToSpeech = () => {
    if (isReading && utterance) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    const newUtterance = new SpeechSynthesisUtterance(summary);
    newUtterance.rate = 0.9;
    newUtterance.pitch = 1;
    newUtterance.volume = 1;

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

  const handleBookmark = () => {
    toast({
      title: "Bookmark added",
      description: "Summary saved to your bookmarks",
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(summary);
    toast({
      title: "Copied!",
      description: "Summary copied to clipboard",
    });
  };

  return (
    <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {bookTitle}
          </h2>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTextToSpeech}
              className="hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {isReading ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleBookmark}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <BookmarkPlus className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="hover:bg-secondary hover:text-secondary-foreground transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="prose prose-lg max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {summary}
          </div>
        </div>
      </div>
    </Card>
  );
};
