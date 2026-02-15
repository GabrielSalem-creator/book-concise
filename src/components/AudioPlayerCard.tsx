import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, Volume2, Loader2, Settings2, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import VoiceSelector from '@/components/VoiceSelector';

interface AudioPlayerCardProps {
  bookId: string | undefined;
  summary: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  readingSessionId?: string | null;
  initialProgress?: number;
}

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
];

export default function AudioPlayerCard({
  summary,
  onProgress,
  onComplete,
  initialProgress = 0,
}: AudioPlayerCardProps) {
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(initialProgress);
  const [playbackRate, setPlaybackRate] = useState('1');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState('en');

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const seekTargetRef = useRef<number | null>(null);

  // Detect language from summary text
  const detectLanguage = useCallback((text: string): string => {
    if (!text) return 'en';
    const sample = text.substring(0, 500).toLowerCase();
    
    // French indicators
    const frenchWords = ['le', 'la', 'les', 'de', 'des', 'un', 'une', 'du', 'et', 'est', 'que', 'qui', 'dans', 'pour', 'avec', 'sur', 'pas', 'ce', 'cette', 'sont', 'ont', 'mais', 'aussi', 'comme', 'nous', 'vous', 'leur', 'très', 'être', 'avoir', 'fait', 'peut', 'tout', 'plus'];
    const spanishWords = ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'que', 'es', 'por', 'con', 'para', 'como', 'más', 'pero', 'sus', 'este', 'esta', 'son', 'tiene', 'también', 'fue', 'sobre', 'todo', 'entre', 'desde', 'puede', 'hay'];
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'den', 'dem', 'nicht', 'sich', 'mit', 'auf', 'für', 'von', 'werden', 'haben', 'sind', 'auch', 'nach', 'wird', 'bei', 'einer', 'über', 'noch', 'kann', 'aus', 'aber', 'wie', 'wenn'];
    const portugueseWords = ['de', 'que', 'não', 'uma', 'para', 'com', 'por', 'mais', 'como', 'mas', 'dos', 'das', 'foi', 'são', 'este', 'esta', 'tem', 'também', 'seu', 'sua', 'quando', 'muito', 'nos', 'já', 'pode', 'depois', 'isso', 'ela', 'entre', 'era'];
    const italianWords = ['di', 'che', 'il', 'la', 'per', 'con', 'una', 'non', 'del', 'nel', 'sono', 'gli', 'anche', 'come', 'più', 'questo', 'questa', 'alla', 'della', 'delle', 'degli', 'alle', 'stato', 'essere', 'hanno', 'fatto', 'dopo', 'tutto', 'aveva', 'molto'];
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4E00-\u9FFF]/;
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
    const koreanPattern = /[\uAC00-\uD7AF]/;
    const russianPattern = /[\u0400-\u04FF]/;

    if (arabicPattern.test(sample)) return 'ar';
    if (chinesePattern.test(sample)) return 'zh';
    if (japanesePattern.test(sample)) return 'ja';
    if (koreanPattern.test(sample)) return 'ko';
    if (russianPattern.test(sample)) return 'ru';

    const words = sample.split(/\s+/);
    const countMatches = (langWords: string[]) => words.filter(w => langWords.includes(w.replace(/[.,!?;:'"]/g, ''))).length;

    const scores = [
      { lang: 'fr', score: countMatches(frenchWords) },
      { lang: 'es', score: countMatches(spanishWords) },
      { lang: 'de', score: countMatches(germanWords) },
      { lang: 'pt', score: countMatches(portugueseWords) },
      { lang: 'it', score: countMatches(italianWords) },
    ];

    const best = scores.sort((a, b) => b.score - a.score)[0];
    // Need a reasonable threshold to avoid false positives
    if (best.score >= 5) return best.lang;
    
    return 'en';
  }, []);

  // Load voices on mount
  useEffect(() => {
    isMountedRef.current = true;

    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      const detectedLang = detectLanguage(summary);
      setDetectedLanguage(detectedLang);
      console.log('[AudioPlayer] Detected language:', detectedLang);

      // Filter voices for the detected language
      const langVoices = availableVoices
        .filter(v => v.lang.startsWith(detectedLang))
        .sort((a, b) => {
          const aGoogle = a.name.toLowerCase().includes('google');
          const bGoogle = b.name.toLowerCase().includes('google');
          if (aGoogle && !bGoogle) return -1;
          if (!aGoogle && bGoogle) return 1;
          return a.name.localeCompare(b.name);
        });

      // Fallback to English if no voices found for detected language
      const englishVoices = availableVoices
        .filter(v => v.lang.startsWith('en'))
        .sort((a, b) => {
          const aGoogle = a.name.toLowerCase().includes('google');
          const bGoogle = b.name.toLowerCase().includes('google');
          if (aGoogle && !bGoogle) return -1;
          if (!aGoogle && bGoogle) return 1;
          return a.name.localeCompare(b.name);
        });

      const voicePool = langVoices.length > 0 ? langVoices : (englishVoices.length > 0 ? englishVoices : availableVoices);
      setVoices(voicePool);

      if (!selectedVoice) {
        // Pick the best Google voice for the language, or fallback
        const googleVoice = voicePool.find(v => v.name.toLowerCase().includes('google'));
        const bestVoice = googleVoice || voicePool[0];
        
        if (bestVoice) {
          console.log('[AudioPlayer] Selected voice:', bestVoice.name, 'lang:', bestVoice.lang);
          setSelectedVoice(bestVoice.name);
        }
      }
    };

    loadVoices();
    
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [summary]);

  const cleanup = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    utteranceRef.current = null;
  }, []);

  const estimateDuration = (text: string, rate: number): number => {
    const words = text.split(/\s+/).length;
    return (words / 150 / rate) * 60 * 1000;
  };

  // Play from a specific progress percentage
  const playFromPosition = useCallback((fromProgress: number) => {
    if (!('speechSynthesis' in window) || !summary) return;

    cleanup();
    setIsLoading(true);

    // Calculate character offset from progress
    const charOffset = Math.floor((fromProgress / 100) * summary.length);
    const textToSpeak = summary.substring(charOffset);

    if (textToSpeak.trim().length === 0) {
      setProgress(100);
      onComplete?.();
      setIsLoading(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;

    utterance.rate = parseFloat(playbackRate);
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const rate = parseFloat(playbackRate);
    const fullDuration = estimateDuration(summary, rate);
    const remainingDuration = fullDuration * ((100 - fromProgress) / 100);

    utterance.onstart = () => {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setIsPlaying(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      progressIntervalRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        const currentProgress = Math.min(fromProgress + ((elapsed / remainingDuration) * (100 - fromProgress)), 99);
        setProgress(currentProgress);
        onProgress?.(currentProgress);
      }, 500);
    };

    utterance.onend = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      onComplete?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (!isMountedRef.current) return;
      setIsLoading(false);
      setIsPlaying(false);
      
      if (event.error !== 'interrupted') {
        toast({
          title: 'Speech Error',
          description: 'Failed to play audio',
          variant: 'destructive',
        });
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [summary, selectedVoice, voices, playbackRate, onProgress, onComplete, toast, cleanup]);

  const handlePlay = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      toast({ title: 'Not Supported', description: 'Text-to-speech is not supported in this browser', variant: 'destructive' });
      return;
    }
    if (!summary) {
      toast({ title: 'No Content', description: 'No summary to read', variant: 'destructive' });
      return;
    }

    // Resume if paused
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      
      const rate = parseFloat(playbackRate);
      const estimatedDuration = estimateDuration(summary, rate);
      startTimeRef.current = Date.now() - (progress / 100) * estimatedDuration;
      
      progressIntervalRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        const currentProgress = Math.min((elapsed / estimatedDuration) * 100, 99);
        setProgress(currentProgress);
        onProgress?.(currentProgress);
      }, 500);
      return;
    }

    // Start from current progress position (supports resume from saved position)
    playFromPosition(progress > 0 && progress < 100 ? progress : 0);
  }, [summary, selectedVoice, voices, playbackRate, isPaused, progress, onProgress, onComplete, toast, cleanup, playFromPosition]);

  const handlePause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, []);

  const handleStop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    onProgress?.(0);
  }, [cleanup, onProgress]);

  const handleSeek = useCallback((value: number[]) => {
    const seekTo = value[0];
    setProgress(seekTo);
    onProgress?.(seekTo);

    // If currently playing, restart from new position
    if (isPlaying || isPaused) {
      playFromPosition(seekTo);
    }
  }, [isPlaying, isPaused, playFromPosition, onProgress]);

  const handleSkip = useCallback((seconds: number) => {
    const rate = parseFloat(playbackRate);
    const fullDuration = estimateDuration(summary, rate);
    const skipPercent = (seconds * 1000 / fullDuration) * 100;
    const newProgress = Math.max(0, Math.min(99, progress + skipPercent));
    
    setProgress(newProgress);
    onProgress?.(newProgress);

    if (isPlaying || isPaused) {
      playFromPosition(newProgress);
    }
  }, [progress, playbackRate, summary, isPlaying, isPaused, playFromPosition, onProgress]);

  const handleSpeedChange = useCallback((speed: string) => {
    setPlaybackRate(speed);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Volume2 className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-wider">Text to Speech</span>
        </div>
      </div>

      {/* Voice & Speed Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-muted-foreground">Voice:</span>
          <VoiceSelector
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            disabled={isPlaying || isLoading}
            language={detectedLanguage}
          />
        </div>
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <Select value={playbackRate} onValueChange={handleSpeedChange} disabled={isLoading}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Progress</span>
          <span className="font-bold text-primary text-lg">{Math.round(progress)}%</span>
        </div>

        <div className="py-2">
          <Slider
            value={[progress]}
            max={100}
            step={0.5}
            className="w-full cursor-pointer"
            onValueCommit={handleSeek}
          />
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Skip Back */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(-10)}
          disabled={isLoading || progress <= 0}
          className="h-10 w-10 rounded-full hover:bg-primary/10"
          aria-label="Skip back 10 seconds"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        {isLoading ? (
          <Button
            size="lg"
            disabled
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary px-8 h-14 rounded-full shadow-lg min-w-[180px]"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg font-semibold">Loading...</span>
          </Button>
        ) : isPlaying ? (
          <Button
            size="lg"
            variant="secondary"
            onClick={handlePause}
            className="gap-3 px-8 h-14 rounded-full shadow-md min-w-[160px] bg-secondary/20 hover:bg-secondary/30 border border-secondary/30"
          >
            <Pause className="w-6 h-6" />
            <span className="text-lg font-semibold">Pause</span>
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handlePlay}
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 px-8 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 min-w-[160px]"
          >
            <Play className="w-6 h-6 fill-current" />
            <span className="text-lg font-semibold">{isPaused || progress > 0 ? 'Resume' : 'Play'}</span>
          </Button>
        )}

        {/* Skip Forward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(10)}
          disabled={isLoading || progress >= 99}
          className="h-10 w-10 rounded-full hover:bg-primary/10"
          aria-label="Skip forward 10 seconds"
        >
          <SkipForward className="w-5 h-5" />
        </Button>

        {(isPlaying || isPaused || progress > 0) && progress < 100 && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleStop}
            className="h-12 w-12 rounded-full hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive"
          >
            <StopCircle className="w-5 h-5" />
          </Button>
        )}
      </div>

      {!('speechSynthesis' in window) && (
        <p className="text-xs text-center text-destructive">
          Text-to-speech is not supported in this browser
        </p>
      )}
    </div>
  );
}
