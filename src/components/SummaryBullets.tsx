export interface SummaryBullet {
  concept: string;
  explanation: string;
  example?: string;
}

export function parseSummaryBullets(raw: string): SummaryBullet[] | null {
  if (!raw) return null;
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.bullets)) {
      return parsed.bullets.filter((b: any) => b && typeof b.concept === 'string');
    }
    return null;
  } catch {
    return null;
  }
}

interface Props {
  bullets: SummaryBullet[];
}

export const SummaryBullets = ({ bullets }: Props) => {
  return (
    <ol className="space-y-5">
      {bullets.map((b, i) => (
        <li
          key={i}
          className="rounded-xl border border-border bg-card/40 p-4 sm:p-5 transition-colors hover:bg-card/60"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div className="flex-1 space-y-2 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold leading-tight">
                {b.concept}
              </h3>
              <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
                {b.explanation}
              </p>
              {b.example && (
                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                  {b.example}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};
