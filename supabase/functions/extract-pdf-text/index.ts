import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();
    console.log(`[extract-pdf-text] Extracting text from: ${pdfUrl}`);

    if (!pdfUrl) {
      throw new Error('PDF URL is required');
    }

    // Fetch the PDF
    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBlob = await pdfResponse.blob();
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Extract text from PDF using basic text extraction
    // This finds text between parentheses in PDF streams and BT/ET blocks
    let extractedText = '';
    const decoder = new TextDecoder('utf-8', { fatal: false });
    
    try {
      const pdfContent = decoder.decode(uint8Array);
      
      // Method 1: Extract text from Tj and TJ operators (common in PDFs)
      const tjMatches = pdfContent.matchAll(/\(([^)]*)\)\s*Tj/g);
      for (const match of tjMatches) {
        if (match[1]) {
          extractedText += decodeSpecialChars(match[1]) + ' ';
        }
      }
      
      // Method 2: Extract from TJ arrays
      const tjArrayMatches = pdfContent.matchAll(/\[((?:[^[\]]*|\[[^\]]*\])*)\]\s*TJ/g);
      for (const match of tjArrayMatches) {
        if (match[1]) {
          const innerMatches = match[1].matchAll(/\(([^)]*)\)/g);
          for (const inner of innerMatches) {
            if (inner[1]) {
              extractedText += decodeSpecialChars(inner[1]) + ' ';
            }
          }
        }
      }
      
      // Method 3: Look for stream content with text
      const streamMatches = pdfContent.matchAll(/stream\s*\n([\s\S]*?)\nendstream/g);
      for (const match of streamMatches) {
        if (match[1]) {
          // Extract readable ASCII text from streams
          const streamText = match[1].replace(/[^\x20-\x7E\n]/g, ' ');
          const words = streamText.match(/[a-zA-Z]{3,}/g);
          if (words && words.length > 5) {
            extractedText += words.slice(0, 100).join(' ') + ' ';
          }
        }
      }
      
    } catch (e) {
      console.log('[extract-pdf-text] UTF-8 decode failed, trying Latin1');
      // Fallback: Try to extract ASCII/Latin1 text
      let latin1Text = '';
      for (let i = 0; i < Math.min(uint8Array.length, 500000); i++) {
        const byte = uint8Array[i];
        if (byte >= 32 && byte <= 126) {
          latin1Text += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) {
          latin1Text += ' ';
        }
      }
      
      // Extract meaningful words (3+ letters)
      const words = latin1Text.match(/[a-zA-ZÀ-ÿ]{3,}/g);
      if (words) {
        extractedText = words.slice(0, 500).join(' ');
      }
    }
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, ' ')
      .trim()
      .substring(0, 5000); // Limit to first 5000 chars for language detection
    
    const wordCount = extractedText.split(/\s+/).filter(w => w.length > 2).length;
    
    console.log(`[extract-pdf-text] PDF size: ${arrayBuffer.byteLength} bytes, extracted ~${wordCount} words`);
    console.log(`[extract-pdf-text] Sample text: ${extractedText.substring(0, 200)}...`);

    return new Response(
      JSON.stringify({ 
        success: true,
        pdfUrl,
        size: arrayBuffer.byteLength,
        estimatedWords: wordCount,
        extractedText: extractedText || null,
        message: 'PDF validated and text extracted'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[extract-pdf-text] Error:', error);
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

// Helper to decode PDF special characters
function decodeSpecialChars(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}
