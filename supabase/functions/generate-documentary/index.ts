import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Bullet { concept: string; explanation: string; example?: string }
interface Scene { imageUrl: string; narration: string; conceptIndex: number; source: 'lovable' | 'placeholder' }

const STYLE = ', minimalist black-and-white stick-figure cinematic storyboard frame, single panel, clean white background, simple line art, documentary illustration, NO text, NO words, NO labels';

async function generateViaLovable(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      console.warn('[doc] lovable img status', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) {
      console.warn('[doc] no b64 in response', JSON.stringify(j).slice(0, 200));
      return null;
    }
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('[doc] lovable fail:', e);
    return null;
  }
}

function placeholder(concept: string): string {
  const safe = concept.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><rect fill='white' width='600' height='400'/><circle cx='300' cy='160' r='30' fill='none' stroke='black' stroke-width='3'/><line x1='300' y1='190' x2='300' y2='280' stroke='black' stroke-width='3'/><line x1='300' y1='220' x2='260' y2='250' stroke='black' stroke-width='3'/><line x1='300' y1='220' x2='340' y2='250' stroke='black' stroke-width='3'/><line x1='300' y1='280' x2='270' y2='340' stroke='black' stroke-width='3'/><line x1='300' y1='280' x2='330' y2='340' stroke='black' stroke-width='3'/><text x='50%' y='380' font-family='sans-serif' font-size='16' text-anchor='middle' fill='black'>${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { bookId, bookTitle, bullets } = await req.json() as { bookId: string; bookTitle: string; bullets: Bullet[] };
    if (!bookId || !bullets?.length) throw new Error('bookId and bullets required');

    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cached } = await supabase
      .from('book_documentaries')
      .select('scenes')
      .eq('book_id', bookId)
      .maybeSingle();
    if (cached?.scenes) {
      console.log('[doc] cache hit', bookId);
      return new Response(JSON.stringify({ success: true, scenes: cached.scenes, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[doc] generating ${bullets.length * 2} scenes for "${bookTitle}"`);

    // Build all prompts up-front
    const tasks: { prompt: string; narration: string; conceptIndex: number; concept: string }[] = [];
    bullets.forEach((b, i) => {
      tasks.push({
        prompt: `Stick figure scene illustrating the concept "${b.concept}". ${b.explanation}.${STYLE}`,
        narration: `${b.concept}. ${b.explanation}`,
        conceptIndex: i,
        concept: b.concept,
      });
      tasks.push({
        prompt: `Stick figure scene showing a concrete example: ${b.example || b.explanation}.${STYLE}`,
        narration: b.example || b.explanation,
        conceptIndex: i,
        concept: b.concept,
      });
    });

    // Parallelize with a small concurrency cap to avoid rate limits
    const CONCURRENCY = 4;
    const scenes: Scene[] = new Array(tasks.length);
    let cursor = 0;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= tasks.length) return;
        const t = tasks[idx];
        let url = await generateViaLovable(t.prompt, apiKey);
        let source: Scene['source'] = 'lovable';
        if (!url) { url = placeholder(t.concept); source = 'placeholder'; }
        scenes[idx] = { imageUrl: url, narration: t.narration, conceptIndex: t.conceptIndex, source };
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    await supabase.from('book_documentaries').upsert(
      { book_id: bookId, scenes: scenes as any },
      { onConflict: 'book_id' }
    );

    console.log(`[doc] done. lovable=${scenes.filter(s => s.source === 'lovable').length}/${scenes.length}`);

    return new Response(JSON.stringify({ success: true, scenes, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[doc] error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
