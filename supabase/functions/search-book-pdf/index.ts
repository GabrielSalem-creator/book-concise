import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function searchGoogleForPdf(query: string): Promise<string[]> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' filetype:pdf')}&num=10`;
  console.log('[search-book-pdf] Google:', searchUrl);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) return [];
    const html = await response.text();
    const urls: string[] = [];

    const urlPattern = /\/url\?q=(https?:\/\/[^&"]+)/g;
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      const decoded = decodeURIComponent(match[1]);
      if (!decoded.includes('google.') && !decoded.includes('youtube.com') && !decoded.includes('gstatic')) {
        urls.push(decoded);
      }
    }

    const directPdf = /https?:\/\/[^\s"'<>]+\.pdf/gi;
    while ((match = directPdf.exec(html)) !== null) {
      if (!match[0].includes('google.') && !urls.includes(match[0])) urls.push(match[0]);
    }

    return urls;
  } catch (e) {
    console.error('[search-book-pdf] Google err:', e);
    return [];
  }
}

async function searchDuckDuckGoForPdf(query: string): Promise<string[]> {
  try {
    const r = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + ' filetype:pdf')}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const urls: string[] = [];
    const re = /href="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!m[1].includes('duckduckgo')) urls.push(m[1]);
    }
    return urls;
  } catch { return []; }
}

async function searchArchive(name: string): Promise<string[]> {
  try {
    const r = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(name)}&fl[]=identifier&rows=5&output=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.response?.docs || []).map((d: any) => `https://archive.org/download/${d.identifier}/${d.identifier}.pdf`);
  } catch { return []; }
}

async function validatePdfUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!r.ok) return false;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) return true;
    return (r.url || url).toLowerCase().endsWith('.pdf');
  } catch { return false; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const bookName = body.bookName || body.query || body.title;
    console.log('[search-book-pdf] query:', bookName);
    if (!bookName) throw new Error('Book name required');

    const [g, d, a] = await Promise.allSettled([
      searchGoogleForPdf(bookName),
      searchDuckDuckGoForPdf(bookName),
      searchArchive(bookName),
    ]);

    const all: string[] = [];
    if (g.status === 'fulfilled') all.push(...g.value);
    if (d.status === 'fulfilled') all.push(...d.value);
    if (a.status === 'fulfilled') all.push(...a.value);

    const unique = [...new Set(all)];
    const exact: string[] = [];
    const loose: string[] = [];
    for (const u of unique) {
      const l = u.toLowerCase();
      if (l.endsWith('.pdf') || /\.pdf[?#]/.test(l)) exact.push(u);
      else if (l.includes('/pdf/') || l.includes('download')) loose.push(u);
    }

    // Validate top candidates
    const toCheck = exact.slice(0, 4);
    const validated: string[] = [];
    if (toCheck.length) {
      const res = await Promise.allSettled(toCheck.map(async (u) => ({ u, ok: await validatePdfUrl(u) })));
      for (const r of res) if (r.status === 'fulfilled' && r.value.ok) validated.push(r.value.u);
    }

    const pdfUrls = [...validated, ...exact.filter(u => !validated.includes(u)), ...loose];
    const pdfUrl = pdfUrls[0] || null;

    console.log(`[search-book-pdf] ${exact.length} exact, ${validated.length} validated. Top: ${pdfUrl}`);

    return new Response(JSON.stringify({ success: true, pdfUrl, pdfUrls, bookName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[search-book-pdf] err:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
