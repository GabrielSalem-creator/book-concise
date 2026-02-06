import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const CHUNK_SIZE = 2000; // ~2000 characters per chunk for faster generation
const FEMALE_VOICE = 'en-US-AvaNeural';
const MALE_VOICE = 'en-US-AndrewNeural';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Split text into chunks at sentence boundaries
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Generate audio for a single chunk
async function generateChunkAudio(
  text: string,
  voiceName: string,
  azureKey: string,
  azureRegion: string
): Promise<string | null> {
  let region = azureRegion;
  
  if (region.includes('.api.cognitive.microsoft.com')) {
    const match = region.match(/https?:\/\/([^.]+)\.api\.cognitive\.microsoft\.com/);
    if (match) region = match[1];
  }
  if (region.startsWith('https://') || region.startsWith('http://')) {
    region = region.replace(/https?:\/\//, '').split('.')[0];
  }

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <prosody rate='1.0' pitch='0%'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`.trim();

  const ttsEndpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[CHUNK-TTS] Attempt ${attempt}/3 for chunk (${text.length} chars)`);

      const response = await fetch(ttsEndpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "Nocturn-Chunked-TTS",
        },
        body: ssml,
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
        console.log(`[CHUNK-TTS] Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CHUNK-TTS] Azure error:`, response.status, errorText);
        if (attempt < 3) {
          await sleep(2000 * attempt);
          continue;
        }
        return null;
      }

      const audioBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(audioBuffer);
      
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      console.log(`[CHUNK-TTS] Generated ${audioBuffer.byteLength} bytes`);
      return btoa(binaryString);
    } catch (error) {
      console.error(`[CHUNK-TTS] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await sleep(3000 * attempt);
        continue;
      }
      return null;
    }
  }
  
  return null;
}

// Process all chunks for a book/voice
async function processBookChunks(
  supabase: any,
  summaryId: string,
  bookId: string,
  content: string,
  voiceName: string,
  azureKey: string,
  azureRegion: string
): Promise<{ success: boolean; chunksGenerated: number }> {
  const chunks = splitIntoChunks(content, CHUNK_SIZE);
  console.log(`[CHUNK-AUDIO] Processing ${chunks.length} chunks for ${voiceName}`);

  let generated = 0;

  for (let i = 0; i < chunks.length; i++) {
    // Check if chunk already exists
    const { data: existing } = await supabase
      .from('summary_audio_chunks')
      .select('id')
      .eq('summary_id', summaryId)
      .eq('voice_name', voiceName)
      .eq('chunk_index', i)
      .maybeSingle();

    if (existing) {
      console.log(`[CHUNK-AUDIO] Chunk ${i} already exists, skipping`);
      generated++;
      continue;
    }

    const audioBase64 = await generateChunkAudio(chunks[i], voiceName, azureKey, azureRegion);
    
    if (audioBase64) {
      const { error } = await supabase
        .from('summary_audio_chunks')
        // Race-safe: multiple generators can run concurrently; ignore duplicates via upsert.
        .upsert(
          {
            summary_id: summaryId,
            book_id: bookId,
            voice_name: voiceName,
            chunk_index: i,
            audio_base64: audioBase64,
          },
          {
            onConflict: 'summary_id,voice_name,chunk_index',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        console.error(`[CHUNK-AUDIO] Upsert error for chunk ${i}:`, error);
      } else {
        generated++;
        console.log(`[CHUNK-AUDIO] Saved chunk ${i}/${chunks.length - 1}`);
      }
    }

    // Rate limit protection between chunks
    if (i < chunks.length - 1) {
      await sleep(2000);
    }
  }

  return { success: generated === chunks.length, chunksGenerated: generated };
}

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AZURE_TTS_KEY = Deno.env.get("AZURE_TTS_KEY");
    const AZURE_TTS_REGION = Deno.env.get("AZURE_TTS_REGION") || "francecentral";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AZURE_TTS_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[CHUNK-AUDIO] Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { bookId, voiceName, action } = body;

    // Action: Get chunks for a book/voice
    if (action === 'getChunks') {
      if (!bookId) {
        return new Response(
          JSON.stringify({ error: "bookId is required" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const voice = voiceName || FEMALE_VOICE;

      const { data: chunks, error } = await supabase
        .from('summary_audio_chunks')
        .select('chunk_index, audio_base64')
        .eq('book_id', bookId)
        .eq('voice_name', voice)
        .order('chunk_index', { ascending: true });

      if (error) {
        console.error("[CHUNK-AUDIO] Error fetching chunks:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch chunks" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          chunks: chunks || [],
          voiceName: voice,
          bookId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Generate chunks for a book
    if (action === 'generate' && bookId) {
      // Get summary (use limit(1) to handle multiple summaries for same book)
      // If there is no persisted summary yet, we can fall back to summaryText sent by the client.
      const { summaryText } = body as { summaryText?: string };

      const { data: summaries, error: summaryError } = await supabase
        .from('summaries')
        .select('id, content')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
        .limit(1);

      let summary = summaries?.[0];

      if ((summaryError || !summary) && summaryText && summaryText.trim().length > 0) {
        console.log('[CHUNK-AUDIO] No saved summary found; creating one from summaryText');

        const { data: inserted, error: insertError } = await supabase
          .from('summaries')
          .insert({
            book_id: bookId,
            content: summaryText,
            is_public: true,
          })
          .select('id, content')
          .single();

        if (insertError) {
          console.error('[CHUNK-AUDIO] Failed to create fallback summary:', insertError);
        } else {
          summary = inserted;
        }
      }

      if (!summary) {
        console.error('[CHUNK-AUDIO] Summary error:', summaryError);
        return new Response(
          JSON.stringify({ error: "Summary not found for this book" }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const voice = voiceName || FEMALE_VOICE;

      // Check existing chunks
      const { data: existingChunks } = await supabase
        .from('summary_audio_chunks')
        .select('chunk_index')
        .eq('summary_id', summary.id)
        .eq('voice_name', voice);

      const expectedChunks = splitIntoChunks(summary.content, CHUNK_SIZE).length;
      
      if (existingChunks && existingChunks.length >= expectedChunks) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Chunks already generated",
            totalChunks: existingChunks.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process in background
      EdgeRuntime.waitUntil(
        processBookChunks(
          supabase,
          summary.id,
          bookId,
          summary.content,
          voice,
          AZURE_TTS_KEY,
          AZURE_TTS_REGION
        )
      );

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Started generating ${expectedChunks} chunks for ${voice}`,
          totalChunks: expectedChunks,
          existingChunks: existingChunks?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Process next book needing chunks (for background worker)
    if (action === 'processNext') {
      const { data: summaries } = await supabase
        .from('summaries')
        .select('id, book_id, content')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!summaries || summaries.length === 0) {
        return new Response(
          JSON.stringify({ done: true, message: "No summaries found" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find summaries missing chunks
      for (const summary of summaries) {
        const expectedChunks = splitIntoChunks(summary.content, CHUNK_SIZE).length;

        for (const voice of [FEMALE_VOICE, MALE_VOICE]) {
          const { data: existingChunks } = await supabase
            .from('summary_audio_chunks')
            .select('chunk_index')
            .eq('summary_id', summary.id)
            .eq('voice_name', voice);

          if (!existingChunks || existingChunks.length < expectedChunks) {
            console.log(`[CHUNK-AUDIO] Processing ${summary.book_id} for ${voice}`);
            
            EdgeRuntime.waitUntil(
              processBookChunks(
                supabase,
                summary.id,
                summary.book_id,
                summary.content,
                voice,
                AZURE_TTS_KEY,
                AZURE_TTS_REGION
              )
            );

            return new Response(
              JSON.stringify({ 
                processing: true,
                bookId: summary.book_id,
                voice,
                existingChunks: existingChunks?.length || 0,
                totalChunks: expectedChunks,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ done: true, message: "All chunks generated" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: "Invalid request",
        usage: {
          getChunks: "POST with {action: 'getChunks', bookId, voiceName?}",
          generate: "POST with {action: 'generate', bookId, voiceName?}",
          processNext: "POST with {action: 'processNext'}",
        }
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[CHUNK-AUDIO] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
