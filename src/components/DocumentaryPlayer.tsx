import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SummaryBullet } from "./SummaryBullets";

interface Scene {
  imageUrl: string;
  narration: string;
  conceptIndex: number;
}

interface Props {
  bookId: string;
  bookTitle: string;
  bullets: SummaryBullet[];
  onClose: () => void;
}

const SCENE_DURATION_MS = 7000;

export const DocumentaryPlayer = ({ bookId, bookTitle, bullets, onClose }: Props) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const { toast } = useToast();
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: cached } = await supabase
        .from('book_documentaries')
        .select('scenes')
        .eq('book_id', bookId)
        .maybeSingle();

      if (cached?.scenes && Array.isArray(cached.scenes)) {
        if (!cancelled) {
          setScenes(cached.scenes as unknown as Scene[]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-documentary', {
        body: { bookId, bookTitle, bullets },
      });
      if (cancelled) return;
      if (error || !data?.success) {
        toast({ title: "Documentary failed", description: "Could not generate scenes", variant: "destructive" });
        onClose();
        return;
      }
      setScenes(data.scenes as Scene[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  // Audio playback: try Lovable TTS first, fall back to browser Web Speech
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!playing || muted || loading || !scenes[index]) return;
    let cancelled = false;
    const text = scenes[index].narration;

    // Cleanup any prior audio/speech
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('lovable-tts', {
          body: { text: text.slice(0, 3500), voice: 'alloy' },
        });
        if (cancelled) return;
        if (error || !data?.audioContent) throw new Error(error?.message || 'no audio');
        const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioContent}`);
        audioRef.current = audio;
        await audio.play();
      } catch {
        // Fallback to Web Speech
        if (cancelled || !('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }
    })();

    return () => {
      cancelled = true;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [index, playing, muted, loading, scenes]);

  useEffect(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (!autoPlay || !playing || loading || scenes.length === 0) return;
    autoTimer.current = setTimeout(() => {
      setIndex(i => (i + 1 < scenes.length ? i + 1 : i));
    }, SCENE_DURATION_MS);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [index, autoPlay, playing, loading, scenes.length]);

  const next = useCallback(() => setIndex(i => Math.min(i + 1, scenes.length - 1)), [scenes.length]);
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/80">
          <Film className="w-4 h-4" />
          <span className="text-sm font-medium">Documentary</span>
          {scenes.length > 0 && (
            <span className="text-xs text-white/50 ml-2">{index + 1} / {scenes.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAutoPlay(a => !a)}
            className="text-white/80 hover:text-white hover:bg-white/10 h-8"
          >
            {autoPlay ? 'Auto' : 'Manual'}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setMuted(m => !m)} className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-black/70">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Creating the documentary for the first time…</p>
            <p className="text-xs text-black/40">This takes about a minute. Cached for next time.</p>
          </div>
        ) : scenes[index] ? (
          <img
            key={index}
            src={scenes[index].imageUrl}
            alt={scenes[index].narration}
            className="max-h-full max-w-full object-contain animate-fade-in"
          />
        ) : null}
      </div>

      <div className="bg-black px-4 sm:px-8 py-4 sm:py-5 border-t border-white/10">
        <p className="text-white text-base sm:text-lg lg:text-xl leading-relaxed text-center max-w-4xl mx-auto min-h-[3rem]">
          {scenes[index]?.narration ?? (loading ? '' : '—')}
        </p>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-black border-t border-white/10">
        <Button variant="ghost" onClick={prev} disabled={index === 0 || loading} className="text-white hover:bg-white/10 gap-2">
          <ChevronLeft className="w-5 h-5" /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={() => setPlaying(p => !p)}
          disabled={loading}
          className="text-white hover:bg-white/10 h-12 w-12 p-0 rounded-full"
        >
          {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </Button>
        <Button variant="ghost" onClick={next} disabled={index === scenes.length - 1 || loading} className="text-white hover:bg-white/10 gap-2">
          <span className="hidden sm:inline">Next</span> <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
