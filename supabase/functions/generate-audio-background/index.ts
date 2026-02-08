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

// Generate audio with retry logic
async function generateAudioWithRetry(
  text: string, 
  voiceName: string, 
  azureKey: string, 
  azureRegion: string,
  maxRetries: number = 3
): Promise<string | null> {
  let region = azureRegion;
  
  // Clean up region format
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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TTS] Attempt ${attempt}/${maxRetries} for ${voiceName} in region: ${region}`);

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
        console.log(`[TTS] Rate limited (429), waiting ${retryAfter}s before retry...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TTS] Azure error for ${voiceName}:`, response.status, errorText);
        if (attempt < maxRetries) {
          await sleep(2000 * attempt); // Exponential backoff
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
      const base64Audio = btoa(binaryString);
      
      console.log(`[TTS] Generated ${voiceName}: ${audioBuffer.byteLength} bytes`);
      return base64Audio;

    } catch (error) {
      console.error(`[TTS] Attempt ${attempt} failed for ${voiceName}:`, error);
      if (attempt < maxRetries) {
        await sleep(3000 * attempt); // Longer wait on exception
        continue;
      }
      return null;
    }
  }
  
  return null;
}

// Find summaries that need audio
async function getSummariesNeedingAudio(supabase: SupabaseClient): Promise<Summary[]> {
  const { data: allSummaries, error } = await supabase
    .from('summaries')
    .select('id, book_id, content, audio_url')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[BG-AUDIO] Error fetching summaries:', error);
    return [];
  }

  const summaries = (allSummaries || []) as Summary[];
  
  return summaries.filter(summary => {
    if (!summary.audio_url) return true;
    
    try {
      const audioData = typeof summary.audio_url === 'string' 
        ? JSON.parse(summary.audio_url) 
        : summary.audio_url;
      
      const hasFemale = audioData[FEMALE_VOICE] && audioData[FEMALE_VOICE].length > 100;
      const hasMale = audioData[MALE_VOICE] && audioData[MALE_VOICE].length > 100;
      
      return !hasFemale || !hasMale;
    } catch {
      return true;
    }
  });
}

// Process a single summary - one voice at a time with delays
async function processSingleSummary(
  supabase: SupabaseClient,
  summary: Summary,
  azureKey: string,
  azureRegion: string
): Promise<{ success: boolean; bookId: string }> {
  console.log(`[BG-AUDIO] Processing book ${summary.book_id}`);
  
  let existingAudio: Record<string, string> = {};
  if (summary.audio_url) {
    try {
      existingAudio = typeof summary.audio_url === 'string'
        ? JSON.parse(summary.audio_url)
        : summary.audio_url;
    } catch {
      existingAudio = {};
    }
  }

  const needsFemale = !existingAudio[FEMALE_VOICE] || existingAudio[FEMALE_VOICE].length < 100;
  const needsMale = !existingAudio[MALE_VOICE] || existingAudio[MALE_VOICE].length < 100;

  const audioCache = { ...existingAudio };
  let success = true;

  // Process female voice first
  if (needsFemale) {
    console.log('[BG-AUDIO] Generating female voice...');
    const femaleAudio = await generateAudioWithRetry(
      summary.content,
      FEMALE_VOICE,
      azureKey,
      azureRegion
    );
    if (femaleAudio) {
      audioCache[FEMALE_VOICE] = femaleAudio;
      // Save immediately after female generation
      await supabase
        .from('summaries')
        .update({ audio_url: JSON.stringify(audioCache) })
        .eq('id', summary.id);
      console.log('[BG-AUDIO] Female voice saved');
    } else {
      success = false;
    }
  }

  // Wait before processing male voice to avoid rate limits
  if (needsMale && success) {
    console.log('[BG-AUDIO] Waiting 5s before male voice...');
    await sleep(5000);
    
    console.log('[BG-AUDIO] Generating male voice...');
    const maleAudio = await generateAudioWithRetry(
      summary.content,
      MALE_VOICE,
      azureKey,
      azureRegion
    );
    if (maleAudio) {
      audioCache[MALE_VOICE] = maleAudio;
    } else {
      success = false;
    }
  }

  // Final save with both voices
  const { error: updateError } = await supabase
    .from('summaries')
    .update({ audio_url: JSON.stringify(audioCache) })
    .eq('id', summary.id);

  if (updateError) {
    console.error(`[BG-AUDIO] Update failed for ${summary.id}:`, updateError);
    return { success: false, bookId: summary.book_id };
  }

  console.log(`[BG-AUDIO] Completed book ${summary.book_id} (success: ${success})`);
  return { success, bookId: summary.book_id };
}

// Process a single book by ID (called from generate-summary)
async function processSingleBook(
  supabase: SupabaseClient,
  bookId: string,
  summaryContent: string,
  azureKey: string,
  azureRegion: string
) {
  console.log(`[BG-AUDIO] Processing single book ${bookId}`);
  
  const audioCache: Record<string, string> = {};

  // Generate female voice
  console.log('[BG-AUDIO] Generating female voice for new book...');
  const femaleAudio = await generateAudioWithRetry(
    summaryContent,
    FEMALE_VOICE,
    azureKey,
    azureRegion
  );
  if (femaleAudio) {
    audioCache[FEMALE_VOICE] = femaleAudio;
    // Save immediately
    await supabase
      .from('summaries')
      .update({ audio_url: JSON.stringify(audioCache) })
      .eq('book_id', bookId);
  }

  // Wait before male voice
  await sleep(5000);

  // Generate male voice
  console.log('[BG-AUDIO] Generating male voice for new book...');
  const maleAudio = await generateAudioWithRetry(
    summaryContent,
    MALE_VOICE,
    azureKey,
    azureRegion
  );
  if (maleAudio) {
    audioCache[MALE_VOICE] = maleAudio;
  }

  if (Object.keys(audioCache).length > 0) {
    const { error: updateError } = await supabase
      .from('summaries')
      .update({ audio_url: JSON.stringify(audioCache) })
      .eq('book_id', bookId);

    if (updateError) {
      console.error(`[BG-AUDIO] Update failed for book ${bookId}:`, updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log(`[BG-AUDIO] Cached ${Object.keys(audioCache).length} voices for book ${bookId}`);
    return { success: true, voicesGenerated: Object.keys(audioCache).length };
  }

  return { success: false, error: 'No audio generated' };
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
      console.error("[BG-AUDIO] Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { bookId, summaryContent, action } = body;

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

      // Process just the first one in background
      const summary = summariesNeedingAudio[0];
      
      EdgeRuntime.waitUntil(
        processSingleSummary(supabase, summary, AZURE_TTS_KEY, AZURE_TTS_REGION)
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
        .select('id, book_id, audio_url');

      const summaries = (allSummaries || []) as Summary[];

      let withAudio = 0;
      let withoutAudio = 0;
      let partial = 0;

      for (const s of summaries) {
        if (!s.audio_url) {
          withoutAudio++;
          continue;
        }
        try {
          const data = typeof s.audio_url === 'string' ? JSON.parse(s.audio_url) : s.audio_url;
          const hasFemale = data[FEMALE_VOICE]?.length > 100;
          const hasMale = data[MALE_VOICE]?.length > 100;
          if (hasFemale && hasMale) withAudio++;
          else if (hasFemale || hasMale) partial++;
          else withoutAudio++;
        } catch {
          withoutAudio++;
        }
      }

      return new Response(
        JSON.stringify({ 
          total: summaries.length,
          withAudio,
          partial,
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
      EdgeRuntime.waitUntil(
        processSingleBook(supabase, bookId, summaryContent, AZURE_TTS_KEY, AZURE_TTS_REGION)
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
    console.error("[BG-AUDIO] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
