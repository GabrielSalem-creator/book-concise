import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, SkipBack, SkipForward, Volume2, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AzureVoiceSelector from '@/components/AzureVoiceSelector';

interface AudioPlayerCardProps {
  bookId: string | undefined;
  summary: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  readingSessionId?: string | null;
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
  bookId,
  summary,
  onProgress,
  onComplete,
  readingSessionId,
}: AudioPlayerCardProps) {
  const { toast } = useToast();

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState('1');
  const [selectedVoice, setSelectedVoice] = useState('en-US-AvaNeural');

  // Chunk-based state
  const [chunks, setChunks] = useState<{ chunk_index: number; audio_base64: string }[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunksLoaded, setChunksLoaded] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  // Load chunks for the selected voice
  const loadChunks = useCallback(async () => {
    if (!bookId) return false;

    console.log('[AudioPlayer] Loading chunks for', bookId, selectedVoice);

    try {
      const { data, error } = await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'getChunks', bookId, voiceName: selectedVoice }
      });

      if (error) {
        console.error('[AudioPlayer] Error loading chunks:', error);
        return false;
      }

      if (data?.chunks && data.chunks.length > 0) {
        setChunks(data.chunks);
        setTotalChunks(data.chunks.length);
        setChunksLoaded(true);
        console.log('[AudioPlayer] Loaded', data.chunks.length, 'chunks');
        return true;
      }

      // Trigger chunk generation in background
      console.log('[AudioPlayer] No chunks, triggering generation...');
      await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'generate', bookId, voiceName: selectedVoice }
      });

      return false;
    } catch (err) {
      console.error('[AudioPlayer] Load failed:', err);
      return false;
    }
  }, [bookId, selectedVoice]);

  // Reload chunks when voice changes
  useEffect(() => {
    if (bookId && !isPlaying) {
      setChunksLoaded(false);
      setChunks([]);
      loadChunks();
    }
  }, [selectedVoice, bookId]);

  // Play a specific chunk
  const playChunk = useCallback(async (chunkIndex: number): Promise<boolean> => {
    if (chunkIndex >= chunks.length) {
      console.log('[AudioPlayer] All chunks finished');
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      onComplete?.();
      return false;
    }

    const chunk = chunks[chunkIndex];
    if (!chunk?.audio_base64) {
      console.error('[AudioPlayer] Invalid chunk at', chunkIndex);
      // Try next
      return playChunk(chunkIndex + 1);
    }

    // Cleanup previous
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    try {
      const binaryString = atob(chunk.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audio.playbackRate = parseFloat(playbackRate);
      audioRef.current = audio;

      return new Promise((resolve) => {
        audio.oncanplaythrough = async () => {
          try {
            await audio.play();
            setCurrentChunkIndex(chunkIndex);
            setIsPlaying(true);
            setIsPaused(false);
            setIsLoading(false);
            resolve(true);
          } catch (e) {
            console.error('[AudioPlayer] Play failed:', e);
            resolve(false);
          }
        };

        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            const chunkProgress = audio.currentTime / audio.duration;
            const overallProgress = ((chunkIndex + chunkProgress) / chunks.length) * 100;
            setProgress(overallProgress);
            onProgress?.(overallProgress);

            // Save progress occasionally
            if (readingSessionId && Math.floor(overallProgress) % 10 === 0) {
              supabase
                .from('reading_sessions')
                .update({
                  progress_percentage: overallProgress,
                  last_read_at: new Date().toISOString()
                })
                .eq('id', readingSessionId)
                .then();
            }
          }
        };

        audio.onended = () => {
          // Play next chunk
          playChunk(chunkIndex + 1);
        };

        audio.onerror = () => {
          console.error('[AudioPlayer] Audio error on chunk', chunkIndex);
          playChunk(chunkIndex + 1);
        };

        audio.load();
      });
    } catch (err) {
      console.error('[AudioPlayer] Chunk error:', err);
      return false;
    }
  }, [chunks, playbackRate, onProgress, onComplete, readingSessionId]);

  // Fallback: Web Speech API
  const playWithWebSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: 'Audio Unavailable',
        description: 'Your browser does not support text-to-speech',
        variant: 'destructive',
      });
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = parseFloat(playbackRate);
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setProgress(100);
      onComplete?.();
    };

    // Approximate progress
    let startTime = Date.now();
    const estimatedDuration = (summary.length / 15) * 1000;
    const interval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(interval);
        return;
      }
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / estimatedDuration) * 100 / parseFloat(playbackRate), 99);
      setProgress(pct);
      onProgress?.(pct);
    }, 500);

    (window as any).__speechInterval = interval;
    (window as any).__utterance = utterance;

    window.speechSynthesis.speak(utterance);
  }, [summary, playbackRate, onProgress, onComplete, toast]);

  // Main play handler
  const handlePlay = async () => {
    if (!summary) {
      toast({ title: 'No content', description: 'No summary to read', variant: 'destructive' });
      return;
    }

    // Resume if paused
    if (isPaused && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      } catch {
        setIsPaused(false);
      }
    }

    // Resume Web Speech
    if (isPaused && (window as any).__utterance) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);

    // Try chunked audio first
    if (!chunksLoaded || chunks.length === 0) {
      const loaded = await loadChunks();
      if (!loaded) {
        toast({
          title: 'Generating Audio...',
          description: 'Using fallback voice while chunks generate',
        });
        playWithWebSpeech();
        return;
      }
      // Re-fetch chunks after potential generation
      const { data } = await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'getChunks', bookId, voiceName: selectedVoice }
      });
      if (data?.chunks?.length > 0) {
        setChunks(data.chunks);
        setTotalChunks(data.chunks.length);
        setChunksLoaded(true);
      } else {
        playWithWebSpeech();
        return;
      }
    }

    // Play from current chunk (or start)
    const success = await playChunk(currentChunkIndex);
    if (!success) {
      playWithWebSpeech();
    }
  };

  const handlePause = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    cleanup();
    if ((window as any).__speechInterval) {
      clearInterval((window as any).__speechInterval);
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentChunkIndex(0);
  };

  const handleSkip = (direction: 'forward' | 'backward') => {
    if (chunks.length === 0) return;
    
    const newIndex = direction === 'forward'
      ? Math.min(currentChunkIndex + 1, chunks.length - 1)
      : Math.max(currentChunkIndex - 1, 0);

    if (newIndex !== currentChunkIndex && isPlaying) {
      playChunk(newIndex);
    } else {
      setCurrentChunkIndex(newIndex);
      setProgress((newIndex / chunks.length) * 100);
    }
  };

  const handleSpeedChange = (speed: string) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = parseFloat(speed);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Volume2 className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-wider">Azure Neural TTS</span>
        </div>
        {totalChunks > 0 && (
          <span className="text-xs text-muted-foreground">
            Chunk {currentChunkIndex + 1} / {totalChunks}
          </span>
        )}
      </div>

      {/* Voice & Speed Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-muted-foreground">Voice:</span>
          <AzureVoiceSelector
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            disabled={isPlaying || isLoading}
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

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSkip('backward')}
            className="h-10 w-10 rounded-full hover:bg-primary/10 shrink-0"
            aria-label="Previous chunk"
            disabled={currentChunkIndex <= 0}
          >
            <SkipBack className="w-5 h-5" />
          </Button>

          <div className="flex-1 py-2">
            <Slider
              value={[progress]}
              max={100}
              step={1}
              className="w-full cursor-pointer"
              disabled
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSkip('forward')}
            className="h-10 w-10 rounded-full hover:bg-primary/10 shrink-0"
            aria-label="Next chunk"
            disabled={currentChunkIndex >= chunks.length - 1}
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-3">
        {isLoading ? (
          <Button
            size="lg"
            disabled
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary px-8 h-14 rounded-full shadow-lg min-w-[160px]"
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
            <span className="text-lg font-semibold">{isPaused ? 'Resume' : 'Play'}</span>
          </Button>
        )}

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
    </div>
  );
}
