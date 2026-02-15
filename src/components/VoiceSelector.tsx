import { useEffect, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  disabled?: boolean;
  language?: string; // e.g. 'en', 'fr', 'es', 'de', etc.
}

// Language-specific voice labels
const VOICE_LABELS: Record<string, { female: string; male: string }> = {
  en: { female: "Sara", male: "James" },
  fr: { female: "Marie", male: "Pierre" },
  es: { female: "Lucía", male: "Carlos" },
  de: { female: "Anna", male: "Hans" },
  pt: { female: "Ana", male: "Pedro" },
  it: { female: "Giulia", male: "Marco" },
  ar: { female: "Fatima", male: "Ahmed" },
  zh: { female: "Mei", male: "Wei" },
  ja: { female: "Sakura", male: "Kenji" },
  ko: { female: "Soo-Jin", male: "Min-Jun" },
  ru: { female: "Natasha", male: "Ivan" },
};

const PREVIEW_TEXTS: Record<string, string> = {
  en: "Hello! This is how I sound when reading your book.",
  fr: "Bonjour ! Voici comment je lis votre livre.",
  es: "¡Hola! Así es como sueno al leer tu libro.",
  de: "Hallo! So klinge ich beim Vorlesen Ihres Buches.",
  pt: "Olá! É assim que eu soo ao ler o seu livro.",
  it: "Ciao! Ecco come suono quando leggo il tuo libro.",
  ar: "مرحبًا! هذه هي الطريقة التي أبدو بها عند قراءة كتابك.",
  zh: "你好！这就是我朗读你的书时的声音。",
  ja: "こんにちは！これが本を読むときの私の声です。",
  ko: "안녕하세요! 이것이 제가 책을 읽을 때 나는 소리입니다.",
  ru: "Привет! Вот как я звучу, когда читаю вашу книгу.",
};

export const VoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  disabled = false,
  language = "en",
}: VoiceSelectorProps) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("female");

  const labels = VOICE_LABELS[language] || VOICE_LABELS.en;

  useEffect(() => {
    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      // Filter voices for detected language first, fallback to English
      let langVoices = availableVoices.filter(v => v.lang.startsWith(language));
      if (langVoices.length === 0) {
        langVoices = availableVoices.filter(v => v.lang.startsWith('en'));
      }
      if (langVoices.length === 0) {
        langVoices = availableVoices;
      }

      // Sort: Google voices first
      langVoices.sort((a, b) => {
        const aG = a.name.toLowerCase().includes('google');
        const bG = b.name.toLowerCase().includes('google');
        if (aG && !bG) return -1;
        if (!aG && bG) return 1;
        return a.name.localeCompare(b.name);
      });

      setVoices(langVoices);

      // Auto-select best voice
      const femaleVoice = findVoiceByGender("female", langVoices);
      if (femaleVoice && !selectedVoice) {
        onVoiceChange(femaleVoice.name);
        setSelectedType("female");
      }
    };

    loadVoices();
    
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [language, selectedVoice, onVoiceChange]);

  const findVoiceByGender = (gender: string, voiceList: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    const googleVoices = voiceList.filter(v => v.name.toLowerCase().includes('google'));
    
    if (gender === "female") {
      // Try Google female first
      const googleFemale = googleVoices.find(v => v.name.toLowerCase().includes('female'));
      if (googleFemale) return googleFemale;
      // First Google voice as fallback (often female)
      if (googleVoices.length > 0) return googleVoices[0];
      return voiceList[0];
    } else {
      // Try Google male
      const googleMale = googleVoices.find(v => v.name.toLowerCase().includes('male'));
      if (googleMale) return googleMale;
      // Second Google voice as fallback
      if (googleVoices.length > 1) return googleVoices[1];
      if (googleVoices.length > 0) return googleVoices[0];
      return voiceList[1] || voiceList[0];
    }
  };

  const handleTypeChange = (type: string) => {
    if (!type) return;
    setSelectedType(type);
    const voice = findVoiceByGender(type, voices);
    if (voice) {
      onVoiceChange(voice.name);
    }
  };

  const handlePreview = () => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    setIsPreviewing(true);

    const previewText = PREVIEW_TEXTS[language] || PREVIEW_TEXTS.en;
    const utterance = new SpeechSynthesisUtterance(previewText);
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;

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
        <ToggleGroupItem
          value="female"
          className="px-4 py-2 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground transition-all"
        >
          {labels.female}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="male"
          className="px-4 py-2 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground transition-all"
        >
          {labels.male}
        </ToggleGroupItem>
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
