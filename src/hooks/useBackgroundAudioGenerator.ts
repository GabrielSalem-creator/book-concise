import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  enabled: boolean;
  /** Minimum delay between jobs; should be fairly high to avoid Azure 429s */
  intervalMs?: number;
};

/**
 * Slowly pre-generates Azure audio for ALL summaries by repeatedly calling
 * the `generate-audio-background` edge function with `{ action: 'processOne' }`.
 *
 * This runs client-side (no cron required) and is safe to stop/restart.
 */
export function useBackgroundAudioGenerator({
  enabled,
  intervalMs = 45_000,
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
          "generate-audio-background",
          {
            body: { action: "processOne" },
          }
        );

        // If the function errors, back off more aggressively.
        if (error) {
          console.warn("[BG-AUDIO][client] processOne error:", error);
          scheduleNext(Math.max(intervalMs * 2, 90_000));
          return;
        }

        // When done, stop scheduling.
        if (data?.done || data?.remaining === 0) {
          console.log("[BG-AUDIO][client] All summaries already have audio.");
          return;
        }

        // Normal pacing.
        scheduleNext(intervalMs);
      } catch (e) {
        console.warn("[BG-AUDIO][client] processOne exception:", e);
        scheduleNext(Math.max(intervalMs * 2, 90_000));
      } finally {
        runningRef.current = false;
      }
    };

    // Start shortly after login to avoid competing with initial page loads.
    scheduleNext(10_000);

    return () => {
      cancelled = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, intervalMs]);
}
