import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FEMALE_VOICE = 'en-US-AvaNeural';
const MALE_VOICE = 'en-US-AndrewNeural';

interface Summary {
  id: string;
  book_id: string;
  content: string;
  audio_url: string | null;
}

// Helper: sleep for ms
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate audio using Azure TTS
async function generateAudioWithAzure(
  text: string, 
  voiceName: string, 
  azureKey: string, 
  azureRegion: string
): Promise<Uint8Array | null> {
  // Clean up region format
  let region = azureRegion;
  if (region.includes('.api.cognitive.microsoft.com')) {
    const match = region.match(/https?:\/\/([^.]+)\.api\.cognitive\.microsoft\.com/);
    if (match) region = match[1];
  }
  if (region.startsWith('https://') || region.startsWith('http://')) {
    region = region.replace(/https?:\/\//, '').split('.')[0];
  }

  // Truncate text if too long
  const maxChars = 8000;
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + "..." : text;

  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <prosody rate='0.95' pitch='0%'>
      ${escapeXml(truncatedText)}
    </prosody>
  </voice>
</speak>`.trim();

  const ttsEndpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[BG-TTS] Attempt ${attempt}/3 for ${voiceName}`);

      const response = await fetch(ttsEndpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "Nocturn-Background-TTS",
        },
        body: ssml,
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
        console.log(`[BG-TTS] Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BG-TTS] Azure error [${response.status}]:`, errorText);
        if (attempt < 3) {
          await sleep(2000 * attempt);
          continue;
        }
        return null;
      }

      const audioBuffer = await response.arrayBuffer();
      console.log(`[BG-TTS] Generated ${voiceName}: ${audioBuffer.byteLength} bytes`);
      return new Uint8Array(audioBuffer);

    } catch (error) {
      console.error(`[BG-TTS] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await sleep(3000 * attempt);
        continue;
      }
      return null;
    }
  }
  
  return null;
}

// Upload audio to storage and update summary
async function uploadAudioAndUpdate(
  supabase: SupabaseClient,
  audioData: Uint8Array,
  bookId: string,
  summaryId: string,
  voiceName: string
): Promise<string | null> {
  try {
    const fileName = `${bookId}/${summaryId}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('audio-summaries')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error(`[BG-TTS] Upload error:`, uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('audio-summaries')
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // Update summary with audio URL
    const { error: updateError } = await supabase
      .from('summaries')
      .update({
        audio_url: audioUrl,
        audio_generated_at: new Date().toISOString(),
        audio_voice: voiceName,
      })
      .eq('id', summaryId);

    if (updateError) {
      console.error(`[BG-TTS] Update error:`, updateError);
    }

    console.log(`[BG-TTS] Audio saved: ${audioUrl}`);
    return audioUrl;

  } catch (error) {
    console.error(`[BG-TTS] Error in uploadAudioAndUpdate:`, error);
    return null;
  }
}

// Process a single book
async function processSingleBook(
  supabase: SupabaseClient,
  bookId: string,
  summaryContent: string,
  summaryId: string | null,
  azureKey: string,
  azureRegion: string
): Promise<{ success: boolean; audioUrl?: string }> {
  console.log(`[BG-TTS] Processing book ${bookId}`);

  // If no summaryId, find it
  let targetSummaryId = summaryId;
  if (!targetSummaryId) {
    const { data: summary } = await supabase
      .from('summaries')
      .select('id')
      .eq('book_id', bookId)
      .maybeSingle();
    
    if (summary) {
      targetSummaryId = summary.id;
    }
  }

  if (!targetSummaryId) {
    console.error(`[BG-TTS] No summary found for book ${bookId}`);
    return { success: false };
  }

  // Generate audio with female voice (default)
  const audioData = await generateAudioWithAzure(
    summaryContent,
    FEMALE_VOICE,
    azureKey,
    azureRegion
  );

  if (!audioData) {
    return { success: false };
  }

  const audioUrl = await uploadAudioAndUpdate(
    supabase,
    audioData,
    bookId,
    targetSummaryId,
    FEMALE_VOICE
  );

  return { success: !!audioUrl, audioUrl: audioUrl || undefined };
}

// Get summaries that need audio
async function getSummariesNeedingAudio(supabase: SupabaseClient): Promise<Summary[]> {
  const { data, error } = await supabase
    .from('summaries')
    .select('id, book_id, content, audio_url')
    .is('audio_url', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[BG-TTS] Error fetching summaries:', error);
    return [];
  }

  return data || [];
}

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AZURE_TTS_KEY = Deno.env.get("AZURE_TTS_KEY") || Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_TTS_REGION = Deno.env.get("AZURE_TTS_REGION") || Deno.env.get("AZURE_SPEECH_REGION") || "eastus";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AZURE_TTS_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[BG-TTS] Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { bookId, summaryContent, summaryId, action } = body;

    console.log(`[BG-TTS] Request:`, { bookId, action, hasSummaryContent: !!summaryContent });

    // Action: Process ONE book that needs audio
    if (action === 'processOne') {
      const summariesNeedingAudio = await getSummariesNeedingAudio(supabase);
      
      if (summariesNeedingAudio.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'All books have audio!',
            remaining: 0,
            done: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const summary = summariesNeedingAudio[0];
      
      // Process in background
      EdgeRuntime.waitUntil(
        processSingleBook(
          supabase, 
          summary.book_id, 
          summary.content, 
          summary.id,
          AZURE_TTS_KEY, 
          AZURE_TTS_REGION
        )
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          bookId: summary.book_id,
          remaining: summariesNeedingAudio.length - 1,
          processing: true,
          message: `Started processing book ${summary.book_id}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get status
    if (action === 'status') {
      const { data: allSummaries } = await supabase
        .from('summaries')
        .select('id, audio_url');

      const summaries = (allSummaries || []) as { id: string; audio_url: string | null }[];
      const withAudio = summaries.filter(s => s.audio_url && s.audio_url.length > 10).length;
      const withoutAudio = summaries.length - withAudio;

      return new Response(
        JSON.stringify({ 
          total: summaries.length,
          withAudio,
          withoutAudio,
          percentComplete: summaries.length 
            ? Math.round((withAudio / summaries.length) * 100) 
            : 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Generate audio for a specific book (called from generate-summary)
    if (bookId && summaryContent) {
      // Process in background
      EdgeRuntime.waitUntil(
        processSingleBook(
          supabase, 
          bookId, 
          summaryContent, 
          summaryId || null,
          AZURE_TTS_KEY, 
          AZURE_TTS_REGION
        )
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Background audio generation started for book ${bookId}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: "Invalid request",
        usage: {
          processOne: "POST with {action: 'processOne'} - processes one book at a time",
          status: "POST with {action: 'status'} - get audio generation status",
          singleBook: "POST with {bookId: string, summaryContent: string} - generate for specific book"
        }
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[BG-TTS] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
