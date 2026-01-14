import { useState, useEffect } from "react";
import { Volume2, VolumeX, BookmarkPlus, Share2, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SummaryDisplayProps {
  summary: string;
  bookTitle: string;
  bookAuthor?: string;
  detectedLanguage?: string;
  ttsLanguage?: string;
  onLanguageChange?: (newSummary: string, newLanguage: string, newTtsLanguage: string) => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English', ttsSupported: true },
  { code: 'es', name: 'Español', ttsSupported: true },
  { code: 'fr', name: 'Français', ttsSupported: true },
  { code: 'de', name: 'Deutsch', ttsSupported: true },
  { code: 'it', name: 'Italiano', ttsSupported: true },
  { code: 'pt', name: 'Português', ttsSupported: true },
  { code: 'ru', name: 'Русский', ttsSupported: true },
  { code: 'ja', name: '日本語', ttsSupported: true },
  { code: 'ko', name: '한국어', ttsSupported: true },
  { code: 'zh', name: '中文', ttsSupported: true },
  { code: 'ar', name: 'العربية', ttsSupported: true },
  { code: 'hi', name: 'हिन्दी', ttsSupported: true },
  { code: 'nl', name: 'Nederlands', ttsSupported: true },
  { code: 'pl', name: 'Polski', ttsSupported: true },
  { code: 'tr', name: 'Türkçe', ttsSupported: true },
  { code: 'vi', name: 'Tiếng Việt', ttsSupported: true },
  { code: 'th', name: 'ไทย', ttsSupported: true },
  { code: 'id', name: 'Bahasa Indonesia', ttsSupported: true },
  { code: 'sv', name: 'Svenska', ttsSupported: true },
  { code: 'da', name: 'Dansk', ttsSupported: true },
  { code: 'no', name: 'Norsk', ttsSupported: true },
  { code: 'fi', name: 'Suomi', ttsSupported: true },
  { code: 'el', name: 'Ελληνικά', ttsSupported: true },
  { code: 'he', name: 'עברית', ttsSupported: true },
  { code: 'ro', name: 'Română', ttsSupported: true },
  { code: 'hu', name: 'Magyar', ttsSupported: true },
  { code: 'uk', name: 'Українська', ttsSupported: true },
];

export const SummaryDisplay = ({ 
  summary, 
  bookTitle, 
  bookAuthor,
  detectedLanguage = 'en',
  ttsLanguage: initialTtsLanguage = 'en',
  onLanguageChange 
}: SummaryDisplayProps) => {
  const [isReading, setIsReading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(detectedLanguage);
  const [ttsLanguage, setTtsLanguage] = useState(initialTtsLanguage);
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

  useEffect(() => {
    setCurrentLanguage(detectedLanguage);
    setTtsLanguage(initialTtsLanguage);
  }, [detectedLanguage, initialTtsLanguage]);

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === currentLanguage) return;
    
    setIsTranslating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          bookTitle,
          bookAuthor,
          targetLanguage: newLanguage
        }),
      });

      const data = await response.json();
      
      if (data.success && data.summary) {
        setCurrentLanguage(newLanguage);
        setTtsLanguage(data.ttsLanguage || 'en');
        
        if (onLanguageChange) {
          onLanguageChange(data.summary, newLanguage, data.ttsLanguage || 'en');
        }
        
        toast({
          title: "Translation Complete",
          description: `Summary translated to ${LANGUAGES.find(l => l.code === newLanguage)?.name || newLanguage}`,
        });
      } else {
        throw new Error(data.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation Failed",
        description: "Could not translate the summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

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

    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    
    // Find voices matching the TTS language
    const languageVoices = voices.filter(voice => 
      voice.lang.toLowerCase().startsWith(ttsLanguage.toLowerCase())
    );

    if (languageVoices.length > 0) {
      // Select a random voice from available language voices
      const randomVoice = languageVoices[Math.floor(Math.random() * languageVoices.length)];
      newUtterance.voice = randomVoice;
      newUtterance.lang = randomVoice.lang;
      console.log(`Selected voice: ${randomVoice.name} (${randomVoice.lang})`);
    } else {
      // Fallback to English if no matching voice found
      const englishVoices = voices.filter(voice => 
        voice.lang.toLowerCase().startsWith('en')
      );
      if (englishVoices.length > 0) {
        const randomVoice = englishVoices[Math.floor(Math.random() * englishVoices.length)];
        newUtterance.voice = randomVoice;
        newUtterance.lang = randomVoice.lang;
        console.log(`Fallback to English voice: ${randomVoice.name}`);
        
        if (ttsLanguage !== 'en') {
          toast({
            title: "Voice Not Available",
            description: "Using English voice as fallback for text-to-speech.",
          });
        }
      }
    }

    newUtterance.onend = () => {
      setIsReading(false);
    };

    newUtterance.onerror = (e) => {
      console.error('TTS Error:', e);
      setIsReading(false);
      toast({
        title: "Error",
        description: "Failed to read summary. Try a different language.",
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

  const currentLanguageData = LANGUAGES.find(l => l.code === currentLanguage);

  return (
    <Card className="p-4 md:p-8 bg-card/50 backdrop-blur-sm border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent line-clamp-2">
              {bookTitle}
            </h2>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleTextToSpeech}
                disabled={isTranslating}
                className="hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
                title={`Listen in ${currentLanguageData?.name || 'English'}`}
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

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Select
              value={currentLanguage}
              onValueChange={handleLanguageChange}
              disabled={isTranslating}
            >
              <SelectTrigger className="w-[180px] h-9">
                {isTranslating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Translating...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Select language" />
                )}
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      {lang.name}
                      {!lang.ttsSupported && (
                        <span className="text-xs text-muted-foreground">(no TTS)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ttsLanguage !== currentLanguage && (
              <span className="text-xs text-muted-foreground">
                (TTS in {LANGUAGES.find(l => l.code === ttsLanguage)?.name || 'English'})
              </span>
            )}
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
