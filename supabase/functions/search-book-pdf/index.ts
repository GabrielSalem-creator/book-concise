import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEEP_SCRAPER_API = "https://deep-scraper-96.created.app/api/deep-scrape";

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

    // Search for PDF URLs
    const searchResponse = await fetch(DEEP_SCRAPER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ query: `${bookName} pdf url` })
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.statusText}`);
    }

    const result = await searchResponse.json();
    console.log('[search-book-pdf] Search result received');

    // Extract PDF URLs
    const pdfUrls: string[] = [];
    
    if (result.source && typeof result.source === 'string' && result.source.toLowerCase().endsWith('.pdf')) {
      pdfUrls.push(result.source);
    }

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
