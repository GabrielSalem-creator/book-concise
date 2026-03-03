import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ReadingModeDisplayProps {
  summary: string;
  isPlaying: boolean;
  progress: number;
  onClose: () => void;
}

const CHARS_PER_CHUNK = 300;

export const ReadingModeDisplay = ({
  summary,
  isPlaying,
  progress,
  onClose,
}: ReadingModeDisplayProps) => {
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

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
    if (isPlaying && chunks.length > 0) {
      const idx = Math.min(
        Math.floor((progress / 100) * chunks.length),
        chunks.length - 1
      );
      setCurrentChunkIndex(idx);
    }
  }, [progress, isPlaying, chunks.length]);

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
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (chunks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Reading Mode
          </span>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {currentChunkIndex + 1} / {chunks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Large text display - takes all available space */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-relaxed text-foreground/90 text-center font-medium max-w-4xl animate-fade-in select-text">
          {chunks[currentChunkIndex]}
        </p>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-border/30">
        <Button
          variant="ghost"
          size="lg"
          onClick={goPrev}
          disabled={currentChunkIndex === 0}
          className="gap-2 h-12 px-6"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Progress dots */}
        <div className="flex items-center gap-1 max-w-[300px] overflow-hidden">
          {chunks.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentChunkIndex(i)}
              className={`h-2 rounded-full transition-all cursor-pointer hover:opacity-80 ${
                i === currentChunkIndex
                  ? "w-6 bg-primary"
                  : i < currentChunkIndex
                  ? "w-2 bg-primary/40"
                  : "w-2 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="lg"
          onClick={goNext}
          disabled={currentChunkIndex === chunks.length - 1}
          className="gap-2 h-12 px-6"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
