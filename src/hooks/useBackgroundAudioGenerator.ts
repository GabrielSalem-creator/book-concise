import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  enabled: boolean;
  /** Minimum delay between jobs; should be fairly high to avoid Azure 429s */
  intervalMs?: number;
};

/**
 * Slowly pre-generates Azure audio CHUNKS for ALL summaries by repeatedly calling
 * the `generate-audio-chunks` edge function with `{ action: 'processNext' }`.
 *
 * This runs client-side (no cron required) and is safe to stop/restart.
 */
export function useBackgroundAudioGenerator({
  enabled,
  intervalMs = 60_000, // 60s default for chunked approach
}: Options) {
  const runningRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const scheduleNext = (ms: number) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void tick();
      }, ms);
    };

    const tick = async () => {
      if (cancelled || !enabled) return;
      if (runningRef.current) {
        scheduleNext(intervalMs);
        return;
      }

      runningRef.current = true;
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-audio-chunks",
          {
            body: { action: "processNext" },
          }
        );

        // If the function errors, back off more aggressively.
        if (error) {
          console.warn("[BG-CHUNKS][client] processNext error:", error);
          scheduleNext(Math.max(intervalMs * 2, 120_000));
          return;
        }

        // When done, slow down polling significantly
        if (data?.done) {
          console.log("[BG-CHUNKS][client] All chunks generated.");
          scheduleNext(300_000); // Check again in 5 mins
          return;
        }

        // Normal pacing
        scheduleNext(intervalMs);
      } catch (e) {
        console.warn("[BG-CHUNKS][client] processNext exception:", e);
        scheduleNext(Math.max(intervalMs * 2, 120_000));
      } finally {
        runningRef.current = false;
      }
    };

    // Start shortly after login to avoid competing with initial page loads.
    scheduleNext(15_000);

    return () => {
      cancelled = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, intervalMs]);
}

