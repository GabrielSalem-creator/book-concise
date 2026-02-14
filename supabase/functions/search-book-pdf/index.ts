import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SCRAPER_API = "https://v0-marsupilami-scraper.vercel.app/api/scrape";

// Parse SSE streaming response to extract final JSON data
async function parseSSEResponse(response: Response): Promise<any> {
  const text = await response.text();
  console.log('[search-book-pdf] Raw response length:', text.length);

  const lines = text.split('\n');
  let lastData: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      const jsonStr = trimmed.slice(6);
      try {
        const parsed = JSON.parse(jsonStr);
        lastData = parsed;
      } catch {
        // partial or non-JSON data line, skip
      }
    }
  }

  // If no SSE data found, try parsing the whole text as JSON
  if (!lastData) {
    try {
      lastData = JSON.parse(text);
    } catch {
      console.error('[search-book-pdf] Could not parse response:', text.substring(0, 500));
      throw new Error('Could not parse scraper response');
    }
  }

  return lastData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookName } = await req.json();
    console.log(`[search-book-pdf] Searching for: ${bookName}`);

    if (!bookName) {
      throw new Error('Book name is required');
    }

    const searchResponse = await fetch(SCRAPER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://v0-marsupilami-scraper.vercel.app',
        'Referer': 'https://v0-marsupilami-scraper.vercel.app/'
      },
      body: JSON.stringify({
        query: `${bookName} pdf url`,
        num_results: 10
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[search-book-pdf] Scraper error:', errorText.substring(0, 200));
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const result = await parseSSEResponse(searchResponse);
    console.log('[search-book-pdf] Parsed result type:', typeof result, Array.isArray(result) ? 'array' : '');

    // Collect all URLs from various response shapes
    const allUrls: string[] = [];
    const pdfUrls: string[] = [];

    if (Array.isArray(result)) {
      for (const item of result) {
        const url = item.url || item.link || item.href;
        if (typeof url === 'string') allUrls.push(url);
      }
    }

    if (result?.results && Array.isArray(result.results)) {
      for (const item of result.results) {
        const url = item.url || item.link || item.href;
        if (typeof url === 'string') allUrls.push(url);
      }
    }

    if (result?.source && typeof result.source === 'string') {
      allUrls.push(result.source);
    }

    if (result?.debug?.search_results && Array.isArray(result.debug.search_results)) {
      for (const url of result.debug.search_results) {
        if (typeof url === 'string') allUrls.push(url);
      }
    }

    // Filter for PDF URLs - check .pdf extension or /pdf/ in path
    for (const url of allUrls) {
      const lower = url.toLowerCase();
      const isPdf = lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf/') || lower.includes('pdf_url');
      if (isPdf && !pdfUrls.includes(url)) {
        pdfUrls.push(url);
      }
    }

    // If no direct PDF links found, return all URLs so the caller can try them
    const urlsToReturn = pdfUrls.length > 0 ? pdfUrls : allUrls.filter((u, i, a) => a.indexOf(u) === i);

    console.log(`[search-book-pdf] Found ${pdfUrls.length} PDF URLs from ${allUrls.length} total URLs, returning ${urlsToReturn.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrls: urlsToReturn,
        bookName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[search-book-pdf] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
