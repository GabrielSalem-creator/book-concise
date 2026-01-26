import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();
    console.log(`[extract-pdf-text] Validating PDF from: ${pdfUrl}`);

    if (!pdfUrl) {
      throw new Error('PDF URL is required');
    }

    // Only fetch the first 50KB to validate and get a sample - prevents CPU timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    let pdfResponse;
    try {
      pdfResponse = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': 'bytes=0-51200' // Only first 50KB
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      // If range request fails, try without range but with timeout
      pdfResponse = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!pdfResponse.ok && pdfResponse.status !== 206) { // 206 is partial content
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBlob = await pdfResponse.blob();
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`[extract-pdf-text] Fetched ${arrayBuffer.byteLength} bytes for analysis`);
    
    // Quick text extraction - just grab readable ASCII/UTF8 strings
    let extractedText = '';
    const sampleSize = Math.min(uint8Array.length, 50000);
    
    // Fast extraction: just grab printable characters
    for (let i = 0; i < sampleSize; i++) {
      const byte = uint8Array[i];
      if (byte >= 32 && byte <= 126) {
        extractedText += String.fromCharCode(byte);
      } else if (byte === 10 || byte === 13) {
        extractedText += ' ';
      }
    }
    
    // Extract meaningful words (3+ letters) for language detection
    const words = extractedText.match(/[a-zA-ZÀ-ÿА-яЁё\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]{3,}/g);
    const cleanText = words ? words.slice(0, 300).join(' ') : '';
    
    const wordCount = words?.length || 0;
    
    console.log(`[extract-pdf-text] Extracted ~${wordCount} words for language detection`);
    console.log(`[extract-pdf-text] Sample: ${cleanText.substring(0, 150)}...`);

    return new Response(
      JSON.stringify({ 
        success: true,
        pdfUrl,
        size: arrayBuffer.byteLength,
        estimatedWords: wordCount,
        extractedText: cleanText.substring(0, 3000) || null, // Limit text for API
        message: 'PDF validated and text extracted'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[extract-pdf-text] Error:', error);
    
    // Return success with null text instead of failing - let AI detect language from title
    return new Response(
      JSON.stringify({ 
        success: true,
        pdfUrl: '',
        size: 0,
        estimatedWords: 0,
        extractedText: null,
        message: 'PDF validation skipped - will use title for detection'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
