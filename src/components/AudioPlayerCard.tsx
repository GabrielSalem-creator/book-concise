import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, Volume2, Loader2, Download, RefreshCw, AlertCircle, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface AudioPlayerCardProps {
  bookId: string | undefined;
  summary: string;
  audioUrl?: string | null;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  readingSessionId?: string | null;
}

// Audio context for iOS unlock
let audioContextUnlocked = false;

async function unlockAudioContext(): Promise<void> {
  if (audioContextUnlocked) return;
  
  try {
    // Create AudioContext to unlock audio on iOS
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    // Create a short silent buffer and play it
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    audioContextUnlocked = true;
    console.log('Audio context unlocked for iOS');
    
    // Clean up after a short delay
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 100);
  } catch (e) {
    console.warn('Failed to unlock audio context:', e);
  }
}

export default function AudioPlayerCard({
  audioUrl,
  onProgress,
  onComplete,
}: AudioPlayerCardProps) {
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);
  const hasAttemptedPlayRef = useRef(false);

  // Initialize audio element when URL changes
  useEffect(() => {
    isMountedRef.current = true;
    setAudioError(null);
    setIsLoading(false);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    hasAttemptedPlayRef.current = false;
    
    if (!audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      return;
    }

    console.log('[AudioPlayer] Initializing with URL:', audioUrl);
    
    // Create audio element
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.playbackRate = playbackRate;
    
    audioRef.current = audio;

    const handleLoadStart = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] loadstart');
        setIsLoading(true);
        setAudioError(null);
      }
    };

    const handleCanPlay = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] canplay');
        setIsLoading(false);
      }
    };

    const handleLoadedMetadata = () => {
      if (isMountedRef.current && audio.duration && !isNaN(audio.duration)) {
        console.log('[AudioPlayer] loadedmetadata, duration:', audio.duration);
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };

    const handleDurationChange = () => {
      if (isMountedRef.current && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        console.log('[AudioPlayer] durationchange:', audio.duration);
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (isMountedRef.current && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        const currentProgress = (audio.currentTime / audio.duration) * 100;
        setProgress(currentProgress);
        setCurrentTime(audio.currentTime);
        onProgress?.(currentProgress);
      }
    };

    const handleEnded = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] ended');
        setIsPlaying(false);
        setProgress(100);
        onComplete?.();
      }
    };

    const handleError = () => {
      const error = audio.error;
      let errorMessage = 'Failed to load audio';
      
      if (error) {
        console.error('[AudioPlayer] Error:', { 
          code: error.code, 
          message: error.message,
          url: audioUrl?.substring(0, 100) + '...',
          networkState: audio.networkState,
          readyState: audio.readyState
        });
        
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was cancelled';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - please check your connection';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio file could not be decoded';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported';
            break;
        }
      }

      if (isMountedRef.current) {
        setIsLoading(false);
        setIsPlaying(false);
        setAudioError(errorMessage);
      }
    };

    const handleWaiting = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] waiting (buffering)');
        setIsLoading(true);
      }
    };

    const handlePlaying = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] playing');
        setIsLoading(false);
        setIsPlaying(true);
      }
    };

    const handlePause = () => {
      if (isMountedRef.current) {
        console.log('[AudioPlayer] paused');
        setIsPlaying(false);
      }
    };

    const handleStalled = () => {
      console.log('[AudioPlayer] stalled - network issue');
    };

    // Add all event listeners
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('stalled', handleStalled);

    // Set source - add cache buster for retries
    audio.src = audioUrl;
    audio.load();
    
    return () => {
      isMountedRef.current = false;
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('stalled', handleStalled);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl, onProgress, onComplete]);

  // Update playback rate when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleRetry = useCallback(() => {
    if (!audioUrl) return;
    
    setAudioError(null);
    setIsLoading(true);
    
    // Force reload with cache buster
    const audio = audioRef.current;
    if (audio) {
      const newUrl = audioUrl.includes('?') 
        ? `${audioUrl}&_t=${Date.now()}` 
        : `${audioUrl}?_t=${Date.now()}`;
      audio.src = newUrl;
      audio.load();
    }
    
    toast({
      title: 'Retrying',
      description: 'Reloading audio...',
    });
  }, [audioUrl, toast]);

  const handlePlay = async () => {
    const audio = audioRef.current;
    
    if (!audio || !audioUrl) {
      toast({
        title: 'No Audio',
        description: 'Audio is still being generated...',
        variant: 'destructive',
      });
      return;
    }

    if (audioError) {
      handleRetry();
      return;
    }

    // Unlock audio context on first interaction (iOS requirement)
    if (!hasAttemptedPlayRef.current) {
      hasAttemptedPlayRef.current = true;
      await unlockAudioContext();
    }

    if (isPlaying) {
      audio.pause();
    } else {
      try {
        setIsLoading(true);
        
        // If audio needs to be reloaded
        if (audio.readyState < 2) {
          audio.load();
          await new Promise<void>((resolve, reject) => {
            const onCanPlay = () => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              reject(new Error('Failed to load audio'));
            };
            audio.addEventListener('canplay', onCanPlay);
            audio.addEventListener('error', onError);
            
            // Timeout after 15 seconds
            setTimeout(() => {
              audio.removeEventListener('canplay', onCanPlay);
              audio.removeEventListener('error', onError);
              reject(new Error('Audio load timeout'));
            }, 15000);
          });
        }
        
        await audio.play();
      } catch (err: any) {
        console.error('[AudioPlayer] Play error:', err);
        setIsLoading(false);
        
        if (err.name === 'NotAllowedError') {
          toast({
            title: 'Tap Required',
            description: 'Please tap play again to start audio',
          });
        } else if (err.name === 'NotSupportedError') {
          setAudioError('Audio format not supported on this device');
        } else {
          setAudioError(err.message || 'Failed to play audio');
        }
      }
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (audio && duration && !isNaN(duration)) {
      const newTime = (value[0] / 100) * duration;
      audio.currentTime = newTime;
      setProgress(value[0]);
      setCurrentTime(newTime);
    }
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (audio && duration) {
      const newTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100);
    }
  };

  const togglePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // No audio URL - show loading state
  if (!audioUrl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider">Audio Player</span>
          </div>
        </div>
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-foreground font-medium">Generating audio...</p>
          <p className="text-xs text-muted-foreground mt-2">
            This may take a moment. Please wait.
          </p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (audioError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Volume2 className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium uppercase tracking-wider">Audio Player</span>
          </div>
        </div>
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium mb-1">{audioError}</p>
          <p className="text-xs text-muted-foreground mb-4">
            There was a problem loading the audio
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <a 
              href={audioUrl} 
              download 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary px-3 py-1.5 border rounded-md"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Volume2 className={`w-4 h-4 ${isPlaying ? 'text-primary animate-pulse' : 'text-primary'}`} />
          <span className="text-xs font-medium uppercase tracking-wider">Audio Player</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlaybackRate}
            className="text-xs font-medium text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border hover:border-primary transition-colors"
          >
            {playbackRate}x
          </button>
          <a 
            href={audioUrl} 
            download 
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Download
          </a>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="font-bold text-primary text-lg">{Math.round(progress)}%</span>
          <span className="text-muted-foreground font-medium tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        <div className="py-2">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            className="w-full cursor-pointer"
            onValueChange={handleSeek}
            disabled={!duration || audioError !== null}
          />
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-2">
        {/* Skip backward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(-15)}
          disabled={!duration}
          className="h-10 w-10 rounded-full"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        {/* Play/Pause Button */}
        {isLoading && !isPlaying ? (
          <Button
            size="lg"
            disabled
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary px-8 h-14 rounded-full shadow-lg min-w-[160px]"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg font-semibold">Loading...</span>
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handlePlay}
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 px-8 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 min-w-[160px] transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="w-6 h-6" />
                <span className="text-lg font-semibold">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                <span className="text-lg font-semibold">Play</span>
              </>
            )}
          </Button>
        )}

        {/* Skip forward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSkip(15)}
          disabled={!duration}
          className="h-10 w-10 rounded-full"
        >
          <SkipForward className="w-4 h-4" />
        </Button>

        {/* Stop Button */}
        {(isPlaying || progress > 0) && progress < 100 && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleStop}
            className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive ml-2"
          >
            <StopCircle className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
