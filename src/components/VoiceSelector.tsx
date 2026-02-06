import { useEffect, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  disabled?: boolean;
}

// Define our 2 preferred voice options
const PREFERRED_VOICES = [
  { id: "female", label: "Sara", keywords: ["female", "samantha", "karen", "google us english", "zira", "sara"] },
  { id: "male", label: "James", keywords: ["male", "daniel", "alex", "google uk english male", "david", "james"] },
];

export const VoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  disabled = false,
}: VoiceSelectorProps) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("female");

  useEffect(() => {
    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        // Filter to English voices
        const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
        setVoices(englishVoices.length > 0 ? englishVoices : availableVoices);

        // Auto-select female voice on first load
        if (!selectedVoice) {
          const femaleVoice = findVoiceByType("female", englishVoices.length > 0 ? englishVoices : availableVoices);
          if (femaleVoice) {
            onVoiceChange(femaleVoice.name);
            setSelectedType("female");
          }
        } else {
          // Determine which type the current voice is
          const currentType = detectVoiceType(selectedVoice);
          setSelectedType(currentType);
        }
      }
    };

    loadVoices();
    
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice, onVoiceChange]);

  const findVoiceByType = (type: string, voiceList: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    const pref = PREFERRED_VOICES.find(v => v.id === type);
    if (!pref) return voiceList[0];

    // Try to find a Google voice first (highest quality)
    const googleVoice = voiceList.find(v => {
      const name = v.name.toLowerCase();
      return name.includes('google') && pref.keywords.some(k => name.includes(k));
    });
    if (googleVoice) return googleVoice;

    // Fall back to any matching voice
    const anyMatch = voiceList.find(v => {
      const name = v.name.toLowerCase();
      return pref.keywords.some(k => name.includes(k));
    });
    if (anyMatch) return anyMatch;

    // Ultimate fallback: first or second voice based on type
    return type === "female" ? voiceList[0] : voiceList[1] || voiceList[0];
  };

  const detectVoiceType = (voiceName: string): string => {
    const name = voiceName.toLowerCase();
    const maleKeywords = PREFERRED_VOICES.find(v => v.id === "male")?.keywords || [];
    if (maleKeywords.some(k => name.includes(k))) return "male";
    return "female";
  };

  const handleTypeChange = (type: string) => {
    if (!type) return;
    setSelectedType(type);
    const voice = findVoiceByType(type, voices);
    if (voice) {
      onVoiceChange(voice.name);
    }
  };

  const handlePreview = () => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    setIsPreviewing(true);

    const utterance = new SpeechSynthesisUtterance("Hello! This is how I sound when reading your book summaries.");
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

  return (
    <div className="flex items-center gap-3">
      <ToggleGroup 
        type="single" 
        value={selectedType} 
        onValueChange={handleTypeChange}
        disabled={disabled}
        className="bg-muted/50 p-1 rounded-xl"
      >
        {PREFERRED_VOICES.map((voice) => (
          <ToggleGroupItem
            key={voice.id}
            value={voice.id}
            className="px-4 py-2 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground transition-all"
          >
            {voice.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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
  );
};

export default VoiceSelector;
