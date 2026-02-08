import { Volume2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  disabled?: boolean;
}

// Azure Neural TTS voices - high quality
const AZURE_VOICES = [
  { id: 'en-US-AvaNeural', label: 'Sara', description: 'Female' },
  { id: 'en-US-GuyNeural', label: 'James', description: 'Male' },
];

export const VoiceSelector = ({
  selectedVoice,
  onVoiceChange,
  disabled = false,
}: VoiceSelectorProps) => {
  // Default to Sara if no voice selected
  const currentVoice = selectedVoice || 'en-US-AvaNeural';

  return (
    <div className="flex items-center gap-3">
      <ToggleGroup
        type="single"
        value={currentVoice}
        onValueChange={(value) => {
          if (value) onVoiceChange(value);
        }}
        disabled={disabled}
        className="bg-muted/50 p-1 rounded-xl"
      >
        {AZURE_VOICES.map((voice) => (
          <ToggleGroupItem
            key={voice.id}
            value={voice.id}
            className="px-4 py-2 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground transition-all"
          >
            <Volume2 className="w-3 h-3 mr-1.5" />
            {voice.label}
            <span className="text-xs opacity-70 ml-1">({voice.description})</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default VoiceSelector;
