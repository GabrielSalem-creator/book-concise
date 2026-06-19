import { useState, useEffect } from "react";
import { Volume2, VolumeX, BookmarkPlus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SummaryBullets, parseSummaryBullets, type SummaryBullet } from "./SummaryBullets";

interface SummaryDisplayProps {
  summary: string;
  bookTitle: string;
  bookAuthor?: string;
}

export const SummaryDisplay = ({ summary, bookTitle }: SummaryDisplayProps) => {
  const [bullets, setBullets] = useState<SummaryBullet[] | null>(null);
  const [plainText, setPlainText] = useState("");
  const [isReading, setIsReading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const parsed = parseSummaryBullets(summary);
    if (parsed && parsed.length) {
      setBullets(parsed);
      setPlainText(
        parsed
          .map((b, i) => `${i + 1}. ${b.concept}. ${b.explanation}${b.example ? ' Example: ' + b.example : ''}`)
          .join('\n\n')
      );
    } else {
      setBullets(null);
      setPlainText(
        summary
          .replace(/#+\s/g, '')
          .replace(/[-*_]{2,}/g, '')
          .replace(/^\s*[-*]\s/gm, '')
          .replace(/\*\*/g, '')
          .replace(/__/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .trim()
      );
    }
  }, [summary]);

  const speak = async () => {
    if (isReading) {
      window.speechSynthesis?.cancel();
      setIsReading(false);
      return;
    }
    setIsReading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lovable-tts', {
        body: { text: plainText.slice(0, 3500), voice: 'alloy' },
      });
      if (error || !data?.audioContent) throw new Error('fallback');
      const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioContent}`);
      audio.onended = () => setIsReading(false);
      audio.onerror = () => setIsReading(false);
      await audio.play();
    } catch {
      if (!('speechSynthesis' in window)) { setIsReading(false); return; }
      const u = new SpeechSynthesisUtterance(plainText);
      u.rate = 0.95;
      u.onend = () => setIsReading(false);
      u.onerror = () => setIsReading(false);
      window.speechSynthesis.speak(u);
    }
  };

  const bookmark = async () => {
    if (!user) return;
    const { data: book } = await supabase
      .from('books').select('id').ilike('title', `%${bookTitle}%`).limit(1).maybeSingle();
    if (!book) return;
    await supabase.from('bookmarks').insert({ user_id: user.id, book_id: book.id });
    toast({ title: "Saved" });
  };

  const share = () => {
    navigator.clipboard.writeText(plainText);
    toast({ title: "Copied" });
  };

  return (
    <Card className="p-4 sm:p-6 border border-border bg-card">
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-border">
        <h2 className="text-lg sm:text-xl font-bold truncate">{bookTitle}</h2>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={speak} aria-label="Read aloud">
            {isReading ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={bookmark} aria-label="Bookmark">
            <BookmarkPlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={share} aria-label="Copy">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {bullets ? (
        <SummaryBullets bullets={bullets} />
      ) : (
        <div className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-foreground/85">
          {plainText}
        </div>
      )}
    </Card>
  );
};
