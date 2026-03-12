import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Use Google search to find PDF URLs by scraping search results
async function searchGoogleForPdf(query: string): Promise<string[]> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' filetype:pdf')}&num=10`;
  
  console.log('[search-book-pdf] Google search URL:', searchUrl);
  
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  
  if (!response.ok) {
    console.error('[search-book-pdf] Google search failed:', response.status);
    throw new Error(`Google search failed: ${response.status}`);
  }
  
  const html = await response.text();
  console.log('[search-book-pdf] Google HTML length:', html.length);
  
  // Extract URLs from Google search results
  const urls: string[] = [];
  
  // Match href URLs in search results - Google wraps them in /url?q=
  const urlPattern = /\/url\?q=(https?:\/\/[^&"]+)/g;
  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    const decodedUrl = decodeURIComponent(match[1]);
    // Filter out Google's own URLs
    if (!decodedUrl.includes('google.com') && 
        !decodedUrl.includes('googleapis.com') &&
        !decodedUrl.includes('gstatic.com') &&
        !decodedUrl.includes('youtube.com')) {
      urls.push(decodedUrl);
    }
  }
  
  // Also try to find direct PDF links in the HTML
  const directPdfPattern = /https?:\/\/[^\s"'<>]+\.pdf/gi;
  while ((match = directPdfPattern.exec(html)) !== null) {
    const url = match[0];
    if (!url.includes('google.com') && !urls.includes(url)) {
      urls.push(url);
    }
  }
  
  return urls;
}

// Try alternative search: DuckDuckGo lite
async function searchDuckDuckGoForPdf(query: string): Promise<string[]> {
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + ' pdf')}`;
  
  console.log('[search-book-pdf] DDG search URL:', searchUrl);
  
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
  });
  
  if (!response.ok) {
    console.error('[search-book-pdf] DDG search failed:', response.status);
    return [];
  }
  
  const html = await response.text();
  const urls: string[] = [];
  
  // Extract URLs from DDG lite results
  const hrefPattern = /href="(https?:\/\/[^"]+)"/g;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('duckduckgo.com') && !url.includes('duck.com')) {
      urls.push(url);
    }
  }
  
  return urls;
}

// Known free PDF library sources - search these directly
async function searchKnownSources(bookName: string): Promise<string[]> {
  const urls: string[] = [];
  
  // Try Archive.org search
  try {
    const archiveUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(bookName)}&fl[]=identifier&fl[]=title&fl[]=format&rows=5&output=json`;
    const archiveResp = await fetch(archiveUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (archiveResp.ok) {
      const archiveData = await archiveResp.json();
      if (archiveData?.response?.docs) {
        for (const doc of archiveData.response.docs) {
          if (doc.identifier) {
            urls.push(`https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`);
          }
        }
      }
    }
  } catch (e) {
    console.log('[search-book-pdf] Archive.org search failed:', e);
  }
  
  return urls;
}

// Validate if a URL actually points to a PDF
async function validatePdfUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    
    if (!resp.ok) return false;
    
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) return true;
    
    // Check if URL ends with .pdf
    const finalUrl = resp.url || url;
    if (finalUrl.toLowerCase().endsWith('.pdf')) return true;
    
    return false;
  } catch {
    return false;
  }
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

    // Search multiple sources in parallel
    const [googleResults, ddgResults, knownResults] = await Promise.allSettled([
      searchGoogleForPdf(bookName),
      searchDuckDuckGoForPdf(bookName),
      searchKnownSources(bookName),
    ]);

    const allUrls: string[] = [];
    
    if (googleResults.status === 'fulfilled') {
      allUrls.push(...googleResults.value);
    }
    if (ddgResults.status === 'fulfilled') {
      allUrls.push(...ddgResults.value);
    }
    if (knownResults.status === 'fulfilled') {
      allUrls.push(...knownResults.value);
    }

    // Deduplicate
    const uniqueUrls = [...new Set(allUrls)];
    
    // Separate exact PDF URLs from other URLs
    const exactPdfUrls: string[] = [];
    const otherUrls: string[] = [];
    
    for (const url of uniqueUrls) {
      const lower = url.toLowerCase();
      if (lower.endsWith('.pdf') || lower.match(/\.pdf[\?#]/)) {
        exactPdfUrls.push(url);
      } else if (lower.includes('/pdf/') || lower.includes('pdf_url') || lower.includes('download')) {
        otherUrls.push(url);
      }
    }

    // Validate top PDF URLs (check first 3 to save time)
    const validatedUrls: string[] = [];
    const toValidate = exactPdfUrls.slice(0, 3);
    
    if (toValidate.length > 0) {
      const validationResults = await Promise.allSettled(
        toValidate.map(async (url) => {
          const isValid = await validatePdfUrl(url);
          return { url, isValid };
        })
      );
      
      for (const result of validationResults) {
        if (result.status === 'fulfilled' && result.value.isValid) {
          validatedUrls.push(result.value.url);
        }
      }
    }

    // Build final list: validated first, then unvalidated PDFs, then other URLs
    const pdfUrls = [
      ...validatedUrls,
      ...exactPdfUrls.filter(u => !validatedUrls.includes(u)),
      ...otherUrls,
    ];

    console.log(`[search-book-pdf] Found ${exactPdfUrls.length} PDF URLs, ${validatedUrls.length} validated, ${otherUrls.length} other URLs`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrls,
        bookName,
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
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
