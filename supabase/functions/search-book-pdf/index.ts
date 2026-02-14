import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SCRAPER_API = "https://v0-marsupilami-scraper.vercel.app/api/scrape";

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

    // Search for PDF URLs using marsupilami scraper
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
      console.error('[search-book-pdf] Scraper error:', errorText);
      throw new Error(`Search failed: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const contentType = searchResponse.headers.get('Content-Type') || '';
    if (!contentType.includes('json')) {
      const text = await searchResponse.text();
      console.error('[search-book-pdf] Non-JSON response:', text.substring(0, 200));
      throw new Error('Search returned non-JSON response');
    }

    const result = await searchResponse.json();
    console.log('[search-book-pdf] Search result received');

    // Extract PDF URLs from results
    const pdfUrls: string[] = [];

    // Handle array of results
    if (Array.isArray(result)) {
      for (const item of result) {
        const url = item.url || item.link || item.href;
        if (typeof url === 'string' && url.toLowerCase().endsWith('.pdf') && !pdfUrls.includes(url)) {
          pdfUrls.push(url);
        }
      }
    }

    // Handle object with results array
    if (result.results && Array.isArray(result.results)) {
      for (const item of result.results) {
        const url = item.url || item.link || item.href;
        if (typeof url === 'string' && url.toLowerCase().endsWith('.pdf') && !pdfUrls.includes(url)) {
          pdfUrls.push(url);
        }
      }
    }

    // Also check for source field
    if (result.source && typeof result.source === 'string' && result.source.toLowerCase().endsWith('.pdf')) {
      if (!pdfUrls.includes(result.source)) {
        pdfUrls.push(result.source);
      }
    }

    // Check debug/search_results if present
    if (result.debug?.search_results && Array.isArray(result.debug.search_results)) {
      for (const url of result.debug.search_results) {
        if (typeof url === 'string' && url.toLowerCase().endsWith('.pdf') && !pdfUrls.includes(url)) {
          pdfUrls.push(url);
        }
      }
    }

    console.log(`[search-book-pdf] Found ${pdfUrls.length} PDF URLs`);

    return new Response(
      JSON.stringify({ 
        success: true,
        pdfUrls,
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
