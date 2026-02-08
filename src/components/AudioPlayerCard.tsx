import { useState, useEffect, useRef } from 'react';
import { Play, Pause, StopCircle, Volume2, Loader2, Download } from 'lucide-react';
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Create audio element
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('loadstart', () => {
      if (isMountedRef.current) setIsLoading(true);
    });

    audio.addEventListener('canplay', () => {
      if (isMountedRef.current) setIsLoading(false);
    });

    audio.addEventListener('loadedmetadata', () => {
      if (isMountedRef.current) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (isMountedRef.current && audio.duration) {
        const currentProgress = (audio.currentTime / audio.duration) * 100;
        setProgress(currentProgress);
        setCurrentTime(audio.currentTime);
        onProgress?.(currentProgress);
      }
    });

    audio.addEventListener('ended', () => {
      if (isMountedRef.current) {
        setIsPlaying(false);
        setProgress(100);
        onComplete?.();
      }
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsPlaying(false);
        toast({
          title: 'Audio Error',
          description: 'Failed to load audio file',
          variant: 'destructive',
        });
      }
    });

    // Load audio if URL is available
    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }

    return () => {
      isMountedRef.current = false;
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, onProgress, onComplete, toast]);

  const handlePlay = () => {
    if (!audioRef.current || !audioUrl) {
      toast({
        title: 'No Audio',
        description: 'Audio is not available for this summary',
        variant: 'destructive',
      });
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Play error:', err);
        toast({
          title: 'Playback Error',
          description: 'Failed to play audio',
          variant: 'destructive',
        });
      });
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && duration) {
      const newTime = (value[0] / 100) * duration;
      audioRef.current.currentTime = newTime;
      setProgress(value[0]);
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          <div className="text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Audio is being generated...
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2">
            This may take a moment. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Volume2 className="w-4 h-4 text-primary animate-pulse" />
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
