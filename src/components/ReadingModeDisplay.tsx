import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";

interface ReadingModeDisplayProps {
  summary: string;
  isPlaying: boolean;
  progress: number;
  onToggleMute: () => void;
  isMuted: boolean;
}

const CHARS_PER_CHUNK = 300;

export const ReadingModeDisplay = ({
  summary,
  isPlaying,
  progress,
  onToggleMute,
  isMuted,
}: ReadingModeDisplayProps) => {
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Split summary into readable chunks by sentence boundaries
  useEffect(() => {
    if (!summary) return;
    const sentences = summary.match(/[^.!?]+[.!?]+\s*/g) || [summary];
    const result: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if ((current + sentence).length > CHARS_PER_CHUNK && current.length > 0) {
        result.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) result.push(current.trim());
    setChunks(result);
  }, [summary]);

  // Sync chunk index with audio progress when playing
  useEffect(() => {
    if (isPlaying && !isMuted && chunks.length > 0) {
      const idx = Math.min(
        Math.floor((progress / 100) * chunks.length),
        chunks.length - 1
      );
      setCurrentChunkIndex(idx);
    }
  }, [progress, isPlaying, isMuted, chunks.length]);

  const goNext = useCallback(() => {
    setCurrentChunkIndex(prev => Math.min(prev + 1, chunks.length - 1));
  }, [chunks.length]);

  const goPrev = useCallback(() => {
    setCurrentChunkIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  if (chunks.length === 0) return null;

  return (
    <Card className="glass-morphism border-primary/20 overflow-hidden" ref={containerRef}>
      {/* Mode toggle bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Reading Mode
          </span>
          <span className="text-[10px] text-muted-foreground">
            {currentChunkIndex + 1}/{chunks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleMute}
          className="h-8 gap-1.5 text-xs"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Read Only</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-primary" />
              <span>Listen & Read</span>
            </>
          )}
        </Button>
      </div>

      {/* Large text display */}
      <div className="relative min-h-[200px] sm:min-h-[260px] flex items-center justify-center p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />
        <p className="relative text-lg sm:text-xl lg:text-2xl leading-relaxed text-foreground/90 text-center font-medium max-w-2xl animate-fade-in">
          {chunks[currentChunkIndex]}
        </p>
      </div>

      {/* Navigation controls (always visible, but auto-advance when listening) */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={currentChunkIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Progress dots */}
        <div className="flex items-center gap-1 max-w-[200px] overflow-hidden">
          {chunks.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentChunkIndex
                  ? "w-4 bg-primary"
                  : i < currentChunkIndex
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={currentChunkIndex === chunks.length - 1}
          className="gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};
