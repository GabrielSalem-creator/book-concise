
## Scope
Big change set. Four tracks, shipped together.

---

### 1. UI simplification (full redesign of main screens)

**Remove (delete these components & their usages):**
- `DailyRewardBanner`, `ExitIntentPopup`, `FeedbackPopup`, `WelcomeBackModal`, `StreakMilestoneToast`, `NoCreditsPopup` (keep credit check, drop popup), `ReadingPlanPopup`, `SubscriptionStatus`, `PaymentInstructionsModal` (admin keeps it), `PersonalizedBooks` (replaced by RecommendedBooks).
- Drop heavy gradient cards, glass-morphism layers, decorative blurs.

**Redesign:**
- **Dashboard**: single column. Top = current book (one big card, one primary button "Continue"). Below = reading plan list (minimal rows). Below = recommended books (only if no active reading). One header, one search, one bottom-nav. No stats clutter — keep just streak + books read inline.
- **ReadBook**: top bar (back, title, voice). One hero "Play" button. Below: tabs `Summary` | `Documentary` | `Chat`. No floating widgets.
- **Landing/Auth**: leave largely alone (already minimal).

Design tokens stay; just stop using gradients/shadows in components. Keep dark mode.

---

### 2. PDF scraper output

In `search-book-pdf` edge function, after running Google/DDG/Archive, return the **first validated PDF URL** as `pdfUrl` in the response (already does, but ensure it's the raw `.pdf` not the Google viewer wrapper). Surface that URL in the UI under the book card as a "Source PDF" link (opens in new tab) — exactly what the user asked: "extract as the output the pdf url, to show it".

---

### 3. Summary format → "Concept + Explanation + Example" bullets

Rewrite `generate-summary` edge function prompt to output strict JSON:
```json
{
  "bullets": [
    { "concept": "...", "explanation": "...", "example": "..." }
  ]
}
```
Target 6–10 bullets. Store as JSON in `summaries.summary` (existing TEXT column — store stringified JSON; render-side parses).

`SummaryDisplay` renders each bullet as a clean card row:
- **Concept** (bold)
- Explanation (1–2 sentences)
- *Example* (italic, muted)

Backward compat: if `summary` doesn't parse as JSON, render as plain text (legacy summaries).

---

### 4. Documentary Stick-Figure Mode (new concept)

**Concept**: For each summary bullet, generate **2 stick-figure scene images** + narration text. User clicks Play → fullscreen slideshow with images crossfading, TTS narrating each scene. Auto or manual mode toggle.

**Generation flow** (new edge function `generate-documentary`):
1. Input: bookId + bullets[].
2. For each bullet → ask Lovable AI (Gemini) for 2 scene prompts in the "Hero's Journey stick-figure storyboard" style (using the user's template as the system prompt).
3. For each scene prompt:
   - **Try first**: `POST https://simple-generator-five.vercel.app/api/generate` with `{ positivePrompt, generatorType: 'architecture' }`, session cookie warmed via GET. Resolve relative `imageUrl` against base.
   - **Fallback**: Lovable AI Gateway image gen (`google/gemini-2.5-flash-image`), prompt = "minimalist black-and-white stick-figure cinematic storyboard frame: {scene}".
4. Download image bytes, upload to Supabase storage bucket `documentary-scenes` (new public bucket), save URL.
5. Persist in new table `book_documentaries` (book_id PK, scenes JSONB `[{imageUrl, narration, conceptIndex}]`).
6. Subsequent loads: read from table directly — instant, no regeneration.

**New table** (with GRANTs + RLS):
```sql
CREATE TABLE public.book_documentaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  scenes jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (book_id)
);
GRANT SELECT ON public.book_documentaries TO anon, authenticated;
GRANT ALL ON public.book_documentaries TO service_role;
ALTER TABLE public.book_documentaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.book_documentaries FOR SELECT USING (true);
CREATE POLICY "Service write" ON public.book_documentaries FOR ALL TO service_role USING (true);
```
Plus storage bucket `documentary-scenes` (public).

**Player component `DocumentaryPlayer.tsx`** (fullscreen overlay):
- Image fills screen, narration text below (large).
- Mode toggle: **Auto** (TTS narrates, advances on audio end) / **Manual** (next/prev arrows, optional mute).
- TTS uses existing Lovable AI gateway TTS route.
- Generate-on-first-play; show progress while generating; cached forever after.

**ReadBook tab `Documentary`**: shows scene thumbnails + big "Play documentary" button.

---

### Files

**Delete:**
- src/components/DailyRewardBanner.tsx, ExitIntentPopup.tsx, FeedbackPopup.tsx, WelcomeBackModal.tsx, StreakMilestoneToast.tsx, ReadingPlanPopup.tsx, PersonalizedBooks.tsx, NoCreditsPopup.tsx, PaymentInstructionsModal.tsx (admin-only — keep), SubscriptionStatus.tsx

**New:**
- src/components/DocumentaryPlayer.tsx
- src/components/SummaryBullets.tsx
- supabase/functions/generate-documentary/index.ts
- Migration for `book_documentaries` + `documentary-scenes` bucket

**Edit:**
- src/pages/Dashboard.tsx (full rewrite, minimal)
- src/pages/ReadBook.tsx (tabs + simplified header)
- src/components/SummaryDisplay.tsx (renders bullets via SummaryBullets)
- supabase/functions/generate-summary/index.ts (JSON bullet output)
- supabase/functions/search-book-pdf/index.ts (ensure raw pdfUrl returned)
- src/App.tsx (remove popup mounts)

---

### Risks / Notes
- Removing popups is irreversible in this pass — confirm none of them are business-critical (the user said "remove all plugins that are shit and keep essential").
- The vercel scraper is a hobby endpoint; fallback to Lovable AI image gen is essential.
- Documentary generation costs credits (image gen × ~16 per book). It runs once per book then caches.
- This will touch ~15 files and add a table + bucket — bigger blast radius than usual.

Approve and I'll execute the full set.
