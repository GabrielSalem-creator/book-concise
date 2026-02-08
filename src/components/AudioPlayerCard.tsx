import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, Volume2, Loader2, Download, RefreshCw, AlertCircle } from 'lucide-react';
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
  const [retryCount, setRetryCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  // Create and configure audio element
  const initAudio = useCallback(() => {
    if (!audioUrl) return null;
    
    const audio = new Audio();
    // Don't use crossOrigin as it can cause CORS issues with public buckets
    audio.preload = 'auto';
    
    return audio;
  }, [audioUrl]);

  // Initialize audio element
  useEffect(() => {
    isMountedRef.current = true;
    setAudioError(null);
    setIsLoading(false);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }

    console.log('AudioPlayerCard: Initializing with URL:', audioUrl);
    
    const audio = initAudio();
    if (!audio) return;
    
    audioRef.current = audio;

    const handleLoadStart = () => {
      if (isMountedRef.current) {
        console.log('Audio: loadstart');
        setIsLoading(true);
        setAudioError(null);
      }
    };

    const handleCanPlay = () => {
      if (isMountedRef.current) {
        console.log('Audio: canplay');
        setIsLoading(false);
      }
    };

    const handleCanPlayThrough = () => {
      if (isMountedRef.current) {
        console.log('Audio: canplaythrough');
        setIsLoading(false);
      }
    };

    const handleLoadedMetadata = () => {
      if (isMountedRef.current && audio.duration && !isNaN(audio.duration)) {
        console.log('Audio: loadedmetadata, duration:', audio.duration);
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };

    const handleDurationChange = () => {
      if (isMountedRef.current && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        console.log('Audio: durationchange:', audio.duration);
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
        console.log('Audio: ended');
        setIsPlaying(false);
        setProgress(100);
        onComplete?.();
      }
    };

    const handleError = () => {
      const error = audio.error;
      let errorMessage = 'Failed to load audio';
      
      if (error) {
        console.error('Audio error:', { 
          code: error.code, 
          message: error.message,
          url: audioUrl,
          networkState: audio.networkState,
          readyState: audio.readyState
        });
        
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - check your connection';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio source not found';
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
        console.log('Audio: waiting (buffering)');
        setIsLoading(true);
      }
    };

    const handlePlaying = () => {
      if (isMountedRef.current) {
        console.log('Audio: playing');
        setIsLoading(false);
        setIsPlaying(true);
      }
    };

    const handlePause = () => {
      if (isMountedRef.current) {
        console.log('Audio: pause');
        setIsPlaying(false);
      }
    };

    // Add all event listeners
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);

    // Set source and trigger load
    audio.src = audioUrl;
    
    return () => {
      isMountedRef.current = false;
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl, retryCount, initAudio, onProgress, onComplete]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setAudioError(null);
    toast({
      title: 'Retrying',
      description: 'Attempting to reload audio...',
    });
  };

  const handlePlay = async () => {
    const audio = audioRef.current;
    
    if (!audio || !audioUrl) {
      toast({
        title: 'No Audio',
        description: 'Audio is not available yet',
        variant: 'destructive',
      });
      return;
    }

    if (audioError) {
      handleRetry();
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        setIsLoading(true);
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Play error:', err);
        setIsLoading(false);
        
        if (err.name === 'NotAllowedError') {
          toast({
            title: 'Tap to Play',
            description: 'Please tap play again',
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
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Audio is being generated...</p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            This may take a moment
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
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium mb-1">{audioError}</p>
          <p className="text-xs text-muted-foreground mb-4">
            There was a problem loading the audio
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
            <a 
              href={audioUrl} 
              download 
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline px-3 py-1.5"
            >
              <Download className="w-4 h-4" />
              Download instead
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
        <a 
          href={audioUrl} 
          download 
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          Download
        </a>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">
            {formatTime(currentTime)}
          </span>
          <span className="font-bold text-primary text-lg">{Math.round(progress)}%</span>
          <span className="text-muted-foreground font-medium">
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
      <div className="flex items-center justify-center gap-3">
        {isLoading ? (
          <Button
            size="lg"
            disabled
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary px-8 h-14 rounded-full shadow-lg min-w-[180px]"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg font-semibold">Loading...</span>
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handlePlay}
            className="gap-3 bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 px-8 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 min-w-[160px]"
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

        {(isPlaying || progress > 0) && progress < 100 && (
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
