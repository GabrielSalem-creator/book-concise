export interface SummaryBullet {
  concept: string;
  explanation: string;
  example?: string;
}

function tryParse(text: string): SummaryBullet[] | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.bullets)) {
      const valid = parsed.bullets
        .filter((b: any) => b && typeof b.concept === 'string' && typeof b.explanation === 'string')
        .map((b: any) => ({
          concept: String(b.concept).trim(),
          explanation: String(b.explanation).trim(),
          example: b.example ? String(b.example).trim() : undefined,
        }));
      return valid.length ? valid : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Best-effort repair for truncated JSON streamed from the LLM.
 * Closes trailing strings, drops the last partial object, and balances brackets.
 */
function repairTruncatedJson(raw: string): string {
  let text = raw.trim();
  // Strip code fences
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  // Slice from the first { to the last syntactically meaningful char
  const start = text.indexOf('{');
  if (start === -1) return text;
  text = text.slice(start);

  // Walk through tracking string state and bracket depth
  let inStr = false;
  let escape = false;
  const stack: string[] = [];
  let lastCompleteObjEnd = -1; // index within bullets array of the end of a closed bullet object
  let inBulletsArray = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      if (c === '}' && inBulletsArray && stack.length === 2) {
        // closed a bullet object inside `bullets` array (root{ bullets[ {} ])
        lastCompleteObjEnd = i;
      }
      if (c === ']' && stack.length === 1) inBulletsArray = false;
    }
    if (!inBulletsArray && c === '[' && /"bullets"\s*:\s*\[$/.test(text.slice(Math.max(0, i - 20), i + 1))) {
      inBulletsArray = true;
    }
  }

  if (stack.length === 0) return text;

  // Truncate to last complete bullet, then close brackets cleanly
  if (lastCompleteObjEnd > 0) {
    return text.slice(0, lastCompleteObjEnd + 1) + ']}';
  }

  // Fallback: close everything that's open
  let closed = text;
  if (inStr) closed += '"';
  while (stack.length) {
    const open = stack.pop();
    closed += open === '{' ? '}' : ']';
  }
  return closed;
}

export function parseSummaryBullets(raw: string): SummaryBullet[] | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  return tryParse(cleaned) ?? tryParse(repairTruncatedJson(cleaned));
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
