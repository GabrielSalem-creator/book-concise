import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Bullet { concept: string; explanation: string; example?: string }
interface Scene { imageUrl: string; narration: string; conceptIndex: number; source: 'vercel' | 'lovable' | 'placeholder' }

const VERCEL_BASE = "https://simple-generator-five.vercel.app";

async function generateViaVercel(prompt: string): Promise<string | null> {
  try {
    await fetch(`${VERCEL_BASE}/?type=architecture`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }).catch(() => {});

    const r = await fetch(`${VERCEL_BASE}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': `${VERCEL_BASE}/?type=architecture`,
      },
      body: JSON.stringify({ positivePrompt: prompt, generatorType: 'architecture' }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const url = data?.imageUrl || data?.url || data?.image;
    if (!url) return null;
    return url.startsWith('http') ? url : `${VERCEL_BASE}${url.startsWith('/') ? url : '/' + url}`;
  } catch (e) {
    console.warn('[doc] vercel fail:', e);
    return null;
  }
}

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
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      console.warn('[doc] lovable img status', r.status, await r.text().catch(() => ''));
      return null;
    }
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('[doc] lovable fail:', e);
    return null;
  }
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

    const styleSuffix = ', minimalist black-and-white stick-figure cinematic storyboard frame, single panel, clean white background, simple line art, documentary illustration, no text';
    const scenes: Scene[] = [];

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const promptA = `Stick-figure scene depicting the concept "${b.concept}": ${b.explanation}${styleSuffix}`;
      const promptB = `Stick-figure scene showing the example: ${b.example || b.explanation}${styleSuffix}`;

      for (const [idx, prompt] of [promptA, promptB].entries()) {
        let url = await generateViaVercel(prompt);
        let source: Scene['source'] = 'vercel';
        if (!url) {
          url = await generateViaLovable(prompt, apiKey);
          source = 'lovable';
        }
        if (!url) {
          url = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><rect fill='white' width='600' height='400'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' text-anchor='middle' fill='black'>${b.concept}</text></svg>`)}`;
          source = 'placeholder';
        }
        scenes.push({
          imageUrl: url,
          narration: idx === 0 ? `${b.concept}. ${b.explanation}` : (b.example || b.explanation),
          conceptIndex: i,
          source,
        });
      }
    }

    await supabase.from('book_documentaries').upsert(
      { book_id: bookId, scenes: scenes as any },
      { onConflict: 'book_id' }
    );

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
