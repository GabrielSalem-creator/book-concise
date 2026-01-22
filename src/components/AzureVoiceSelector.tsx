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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  gender: 'Male' | 'Female';
  locale: string;
  voiceType: string;
  styleList: string[];
}

interface AzureVoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onPreviewVoice?: (voice: string) => void;
  disabled?: boolean;
}

// Essential voices only - one female and one male per major language
const ESSENTIAL_VOICES: { name: string; displayName: string; gender: 'Male' | 'Female'; locale: string }[] = [
  // English (US)
  { name: "en-US-AvaNeural", displayName: "Ava", gender: "Female", locale: "English (US)" },
  { name: "en-US-AndrewNeural", displayName: "Andrew", gender: "Male", locale: "English (US)" },
  // English (UK)
  { name: "en-GB-SoniaNeural", displayName: "Sonia", gender: "Female", locale: "English (UK)" },
  { name: "en-GB-RyanNeural", displayName: "Ryan", gender: "Male", locale: "English (UK)" },
  // French
  { name: "fr-FR-DeniseNeural", displayName: "Denise", gender: "Female", locale: "French" },
  { name: "fr-FR-HenriNeural", displayName: "Henri", gender: "Male", locale: "French" },
  // Spanish
  { name: "es-ES-ElviraNeural", displayName: "Elvira", gender: "Female", locale: "Spanish" },
  { name: "es-ES-AlvaroNeural", displayName: "Alvaro", gender: "Male", locale: "Spanish" },
  // German
  { name: "de-DE-KatjaNeural", displayName: "Katja", gender: "Female", locale: "German" },
  { name: "de-DE-ConradNeural", displayName: "Conrad", gender: "Male", locale: "German" },
  // Italian
  { name: "it-IT-ElsaNeural", displayName: "Elsa", gender: "Female", locale: "Italian" },
  { name: "it-IT-DiegoNeural", displayName: "Diego", gender: "Male", locale: "Italian" },
  // Portuguese
  { name: "pt-BR-FranciscaNeural", displayName: "Francisca", gender: "Female", locale: "Portuguese" },
  { name: "pt-BR-AntonioNeural", displayName: "Antonio", gender: "Male", locale: "Portuguese" },
  // Japanese
  { name: "ja-JP-NanamiNeural", displayName: "Nanami", gender: "Female", locale: "Japanese" },
  { name: "ja-JP-KeitaNeural", displayName: "Keita", gender: "Male", locale: "Japanese" },
  // Chinese
  { name: "zh-CN-XiaoxiaoNeural", displayName: "Xiaoxiao", gender: "Female", locale: "Chinese" },
  { name: "zh-CN-YunyangNeural", displayName: "Yunyang", gender: "Male", locale: "Chinese" },
  // Arabic
  { name: "ar-SA-ZariyahNeural", displayName: "Zariyah", gender: "Female", locale: "Arabic" },
  { name: "ar-SA-HamedNeural", displayName: "Hamed", gender: "Male", locale: "Arabic" },
  // Hindi
  { name: "hi-IN-SwaraNeural", displayName: "Swara", gender: "Female", locale: "Hindi" },
  { name: "hi-IN-MadhurNeural", displayName: "Madhur", gender: "Male", locale: "Hindi" },
];

export const AzureVoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  onPreviewVoice,
  disabled = false,
}: AzureVoiceSelectorProps) => {
  const { toast } = useToast();
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Set default voice if none selected
  useEffect(() => {
    if (!selectedVoice) {
      onVoiceChange("en-US-AvaNeural");
    }
  }, [selectedVoice, onVoiceChange]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const handlePreview = async (voiceName: string) => {
    // Stop any existing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
    }

    setIsPreviewing(voiceName);

    try {
      const { data, error } = await supabase.functions.invoke('azure-tts', {
        body: {
          action: 'speak',
          text: "Hello! This is how I sound.",
          voiceName: voiceName,
        }
      });

      if (error) throw error;

      if (data?.audio) {
        // Convert base64 to audio
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        setPreviewAudio(audio);
        
        audio.onended = () => {
          setIsPreviewing(null);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setIsPreviewing(null);
          toast({
            title: "Preview Failed",
            description: "Could not play voice preview",
            variant: "destructive",
          });
        };

        await audio.play();
      }
    } catch (error: any) {
      console.error('Preview failed:', error);
      setIsPreviewing(null);
      toast({
        title: "Preview Failed",
        description: error.message || "Could not preview voice",
        variant: "destructive",
      });
    }
  };

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      setPreviewAudio(null);
    }
    setIsPreviewing(null);
  };

  const selectedVoiceData = ESSENTIAL_VOICES.find(v => v.name === selectedVoice);

  // Group voices by gender
  const femaleVoices = ESSENTIAL_VOICES.filter(v => v.gender === 'Female');
  const maleVoices = ESSENTIAL_VOICES.filter(v => v.gender === 'Male');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedVoice}
          onValueChange={(value) => {
            onVoiceChange(value);
            if (onPreviewVoice) {
              onPreviewVoice(value);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-[200px] sm:w-[240px] h-10 rounded-xl border-primary/20 bg-background/50 backdrop-blur-sm">
            <SelectValue placeholder="Select a voice">
              {selectedVoiceData && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{selectedVoiceData.displayName}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30">
                    {selectedVoiceData.gender === 'Female' ? '♀' : '♂'}
                  </Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[350px] rounded-xl border-primary/20 bg-background/95 backdrop-blur-xl">
            <div className="px-3 py-2 text-xs font-semibold text-primary/80 uppercase tracking-wider border-b border-primary/10">
              👩 Female Voices
            </div>
            {femaleVoices.map((voice) => (
              <SelectItem 
                key={voice.name} 
                value={voice.name}
                className="py-2.5 px-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 rounded-lg mx-1 my-0.5"
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="font-medium">{voice.displayName}</span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {voice.locale}
                  </span>
                </div>
              </SelectItem>
            ))}
            <div className="px-3 py-2 text-xs font-semibold text-primary/80 uppercase tracking-wider border-b border-primary/10 mt-1">
              👨 Male Voices
            </div>
            {maleVoices.map((voice) => (
              <SelectItem 
                key={voice.name} 
                value={voice.name}
                className="py-2.5 px-3 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 rounded-lg mx-1 my-0.5"
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="font-medium">{voice.displayName}</span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {voice.locale}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (isPreviewing) {
              stopPreview();
            } else {
              handlePreview(selectedVoice);
            }
          }}
          disabled={disabled || !selectedVoice}
          className="h-10 w-10 rounded-xl border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all"
          aria-label="Preview voice"
        >
          {isPreviewing === selectedVoice ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {selectedVoiceData && (
        <p className="text-xs text-muted-foreground pl-1">
          {selectedVoiceData.locale} • Neural HD
        </p>
      )}
    </div>
  );
};

export default AzureVoiceSelector;