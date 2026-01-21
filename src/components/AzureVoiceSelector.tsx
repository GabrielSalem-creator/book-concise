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

export const AzureVoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  onPreviewVoice,
  disabled = false,
}: AzureVoiceSelectorProps) => {
  const { toast } = useToast();
  const [voices, setVoices] = useState<AzureVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const loadVoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-tts', {
        body: { action: 'getVoices' }
      });

      if (error) throw error;

      if (data?.voices) {
        setVoices(data.voices);
        
        // If no voice selected, pick a good default
        if (!selectedVoice && data.voices.length > 0) {
          const ava = data.voices.find((v: AzureVoice) => v.name === 'en-US-AvaNeural');
          onVoiceChange(ava?.name || data.voices[0].name);
        }
      }
    } catch (error: any) {
      console.error('Failed to load voices:', error);
      toast({
        title: "Error",
        description: "Could not load voice options",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          text: "Hello! This is how I sound. I hope you enjoy listening to me read your books.",
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

  const selectedVoiceData = voices.find(v => v.name === selectedVoice);

  // Group voices by gender
  const femaleVoices = voices.filter(v => v.gender === 'Female');
  const maleVoices = voices.filter(v => v.gender === 'Male');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading voices...</span>
      </div>
    );
  }

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
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select a voice">
              {selectedVoiceData && (
                <div className="flex items-center gap-2">
                  <span>{selectedVoiceData.displayName}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedVoiceData.gender}
                  </Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {femaleVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  👩 Female Voices
                </div>
                {femaleVoices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{voice.displayName}</span>
                      <span className="text-xs text-muted-foreground">{voice.locale}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
            {maleVoices.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">
                  👨 Male Voices
                </div>
                {maleVoices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{voice.displayName}</span>
                      <span className="text-xs text-muted-foreground">{voice.locale}</span>
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
          onClick={() => {
            if (isPreviewing) {
              stopPreview();
            } else {
              handlePreview(selectedVoice);
            }
          }}
          disabled={disabled || !selectedVoice}
          title="Preview voice"
        >
          {isPreviewing === selectedVoice ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {selectedVoiceData && (
        <p className="text-xs text-muted-foreground">
          {selectedVoiceData.voiceType} voice • {selectedVoiceData.locale}
        </p>
      )}
    </div>
  );
};

export default AzureVoiceSelector;
