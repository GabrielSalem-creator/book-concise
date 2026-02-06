import { useEffect, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  disabled?: boolean;
}

export const VoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  disabled = false,
}: VoiceSelectorProps) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        // Filter to English voices
        const englishVoices = availableVoices
          .filter(v => v.lang.startsWith('en'))
          .sort((a, b) => {
            // Prioritize Google voices
            const aGoogle = a.name.toLowerCase().includes('google');
            const bGoogle = b.name.toLowerCase().includes('google');
            if (aGoogle && !bGoogle) return -1;
            if (!aGoogle && bGoogle) return 1;
            return a.name.localeCompare(b.name);
          });

        setVoices(englishVoices.length > 0 ? englishVoices : availableVoices);

        // Set default voice if none selected
        if (!selectedVoice && englishVoices.length > 0) {
          const googleVoice = englishVoices.find(v => 
            v.name.toLowerCase().includes('google') && v.lang === 'en-US'
          );
          onVoiceChange((googleVoice || englishVoices[0]).name);
        }
      }
    };

    loadVoices();
    
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice, onVoiceChange]);

  const handlePreview = () => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    setIsPreviewing(true);

    const utterance = new SpeechSynthesisUtterance("Hello! This is how I sound.");
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => setIsPreviewing(false);
    utterance.onerror = () => setIsPreviewing(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopPreview = () => {
    window.speechSynthesis.cancel();
    setIsPreviewing(false);
  };

  const selectedVoiceData = voices.find(v => v.name === selectedVoice);

  // Group voices by type
  const googleVoices = voices.filter(v => v.name.toLowerCase().includes('google'));
  const otherVoices = voices.filter(v => !v.name.toLowerCase().includes('google'));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedVoice}
          onValueChange={onVoiceChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[200px] sm:w-[240px] h-10 rounded-xl border-primary/20 bg-background/50 backdrop-blur-sm">
            <SelectValue placeholder="Select a voice">
              {selectedVoiceData && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {selectedVoiceData.name.replace('Google ', '').replace(' (Natural)', '')}
                  </span>
                  {selectedVoiceData.name.toLowerCase().includes('google') && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30">
                      HD
                    </Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[350px] rounded-xl border-primary/20 bg-background/95 backdrop-blur-xl">
            {googleVoices.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-primary/80 uppercase tracking-wider border-b border-primary/10">
                  🎙️ Google HD Voices
                </div>
                {googleVoices.map((voice) => (
                  <SelectItem 
                    key={voice.name} 
                    value={voice.name}
                    className="py-2.5 px-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 rounded-lg mx-1 my-0.5"
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-medium truncate">
                        {voice.name.replace('Google ', '').replace(' (Natural)', '')}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {voice.lang}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
            {otherVoices.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-primary/80 uppercase tracking-wider border-b border-primary/10 mt-1">
                  📢 System Voices
                </div>
                {otherVoices.slice(0, 20).map((voice) => (
                  <SelectItem 
                    key={voice.name} 
                    value={voice.name}
                    className="py-2.5 px-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 rounded-lg mx-1 my-0.5"
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-medium truncate">{voice.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {voice.lang}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={isPreviewing ? stopPreview : handlePreview}
          disabled={disabled || !selectedVoice}
          className="h-10 w-10 rounded-xl border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all"
          aria-label="Preview voice"
        >
          {isPreviewing ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {selectedVoiceData && (
        <p className="text-xs text-muted-foreground pl-1">
          {selectedVoiceData.lang} • {selectedVoiceData.localService ? 'Local' : 'Online'}
        </p>
      )}
    </div>
  );
};

export default VoiceSelector;
