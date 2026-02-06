import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, SkipBack, SkipForward, Volume2, Loader2, Settings2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AzureVoiceSelector from '@/components/AzureVoiceSelector';

// Longer timeout: poll for up to 30 seconds before showing error
const MAX_POLL_TIME_MS = 30000;
const CHUNK_POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState('1');
  const [selectedVoice, setSelectedVoice] = useState('en-US-AvaNeural');
  const [error, setError] = useState<string | null>(null);

  // Chunk-based state
  const [chunks, setChunks] = useState<{ chunk_index: number; audio_base64: string }[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunksLoaded, setChunksLoaded] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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
  }, []);

  // Trigger generation on the backend
  const triggerGeneration = useCallback(async () => {
    if (!bookId) return;
    console.log('[AudioPlayer] Triggering generation for', bookId, selectedVoice);
    try {
      await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'generate', bookId, voiceName: selectedVoice }
      });
    } catch (err) {
      console.error('[AudioPlayer] Trigger generation error:', err);
    }
  }, [bookId, selectedVoice]);

  // Load chunks for the selected voice (single attempt)
  const fetchChunks = useCallback(async (): Promise<{ chunk_index: number; audio_base64: string }[] | null> => {
    if (!bookId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('generate-audio-chunks', {
        body: { action: 'getChunks', bookId, voiceName: selectedVoice }
      });

      if (error) {
        console.error('[AudioPlayer] Error fetching chunks:', error);
        return null;
      }

      if (data?.chunks && data.chunks.length > 0) {
        console.log('[AudioPlayer] Fetched', data.chunks.length, 'chunks');
        return data.chunks;
      }

      return null;
    } catch (err) {
      console.error('[AudioPlayer] Fetch failed:', err);
      return null;
    }
  }, [bookId, selectedVoice]);

  // Poll until chunks are ready (with progress updates)
  const pollChunksUntilReady = useCallback(async (): Promise<{ chunk_index: number; audio_base64: string }[] | null> => {
    if (!bookId) return null;

    // First trigger generation
    await triggerGeneration();

    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
      if (!isMountedRef.current) return null;

      attempt++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setLoadingMessage(`Generating audio... (${elapsed}s)`);

      const fetchedChunks = await fetchChunks();
      if (fetchedChunks && fetchedChunks.length > 0) {
        return fetchedChunks;
      }

      console.log(`[AudioPlayer] Poll attempt ${attempt}, waiting...`);
      await sleep(CHUNK_POLL_INTERVAL_MS);
    }

    return null;
  }, [bookId, triggerGeneration, fetchChunks]);

  // Reload chunks when voice changes (passive load, no polling)
  useEffect(() => {
    if (bookId && !isPlaying && !isLoading) {
      setChunksLoaded(false);
      setChunks([]);
      setError(null);
      
      // Quick check if chunks exist
      fetchChunks().then(c => {
        if (c && c.length > 0 && isMountedRef.current) {
          setChunks(c);
          setTotalChunks(c.length);
          setChunksLoaded(true);
        }
      });
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
            if (isMountedRef.current) {
              setCurrentChunkIndex(chunkIndex);
              setIsPlaying(true);
              setIsPaused(false);
              setIsLoading(false);
            }
            resolve(true);
          } catch (e) {
            console.error('[AudioPlayer] Play failed:', e);
            resolve(false);
          }
        };

        audio.ontimeupdate = () => {
          if (audio.duration > 0 && isMountedRef.current) {
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

        // Timeout in case oncanplaythrough never fires
        setTimeout(() => {
          if (audioRef.current === audio && !audio.paused) return;
          resolve(false);
        }, 10000);
      });
    } catch (err) {
      console.error('[AudioPlayer] Chunk error:', err);
      return false;
    }
  }, [chunks, playbackRate, onProgress, onComplete, readingSessionId]);

  // Main play handler
  const handlePlay = async () => {
    if (!summary) {
      toast({ title: 'No content', description: 'No summary to read', variant: 'destructive' });
      return;
    }

    setError(null);

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

    setIsLoading(true);
    setLoadingMessage('Checking for audio...');

    // First check if chunks already exist
    let availableChunks = chunks.length > 0 ? chunks : await fetchChunks();

    if (!availableChunks || availableChunks.length === 0) {
      // Poll for chunks with generation
      availableChunks = await pollChunksUntilReady();
    }

    if (!isMountedRef.current) return;

    if (!availableChunks || availableChunks.length === 0) {
      setIsLoading(false);
      setError('Audio generation failed. Please try again.');
      toast({
        title: 'Audio generation failed',
        description: 'Could not generate audio chunks. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // We have chunks - update state
    setChunks(availableChunks);
    setTotalChunks(availableChunks.length);
    setChunksLoaded(true);

    // Start playback
    const success = await playChunk(currentChunkIndex);
    if (!success && isMountedRef.current) {
      setIsLoading(false);
      setError('Failed to play audio. Please try again.');
      toast({
        title: 'Playback error',
        description: 'Could not start audio playback.',
        variant: 'destructive',
      });
    }
  };

  const handleRetry = () => {
    setError(null);
    setChunks([]);
    setChunksLoaded(false);
    setCurrentChunkIndex(0);
    handlePlay();
  };

  const handlePause = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    cleanup();
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

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-sm text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      )}

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
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary px-8 h-14 rounded-full shadow-lg min-w-[180px]"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg font-semibold">{loadingMessage}</span>
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
