import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FEMALE_VOICE = 'en-US-AvaNeural';
const MALE_VOICE = 'en-US-AndrewNeural';

async function generateAudioForVoice(
  text: string, 
  voiceName: string, 
  azureKey: string, 
  azureRegion: string
): Promise<string | null> {
  try {
    let region = azureRegion;
    
    // Handle case where region is provided as full URL
    if (region.includes('.api.cognitive.microsoft.com')) {
      const match = region.match(/https?:\/\/([^.]+)\.api\.cognitive\.microsoft\.com/);
      if (match) {
        region = match[1];
      }
    }
    if (region.startsWith('https://') || region.startsWith('http://')) {
      region = region.replace(/https?:\/\//, '').split('.')[0];
    }

    console.log(`Generating audio for voice: ${voiceName} in region: ${region}`);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Azure TTS error for ${voiceName}:`, response.status, errorText);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Convert to base64 in chunks
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binaryString);
    
    console.log(`Generated audio for ${voiceName}: ${audioBuffer.byteLength} bytes`);
    return base64Audio;
  } catch (error) {
    console.error(`Failed to generate audio for ${voiceName}:`, error);
    return null;
  }
}

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
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { bookId, summaryContent, action } = await req.json();

    // Action: Generate audio for ALL summaries without audio
    if (action === 'generateAll') {
      console.log('Generating audio for all summaries without audio...');
      
      const { data: summaries, error: fetchError } = await supabase
        .from('summaries')
        .select('id, book_id, content, audio_url')
        .or('audio_url.is.null,audio_url.eq.{}');

      if (fetchError) {
        console.error('Error fetching summaries:', fetchError);
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found ${summaries?.length || 0} summaries needing audio`);

      let processed = 0;
      let failed = 0;

      for (const summary of summaries || []) {
        // Check if already has both voices
        let existingAudio: Record<string, string> = {};
        if (summary.audio_url) {
          try {
            existingAudio = JSON.parse(summary.audio_url);
          } catch {
            existingAudio = {};
          }
        }

        const needsFemale = !existingAudio[FEMALE_VOICE];
        const needsMale = !existingAudio[MALE_VOICE];

        if (!needsFemale && !needsMale) {
          continue;
        }

        const audioCache = { ...existingAudio };

        if (needsFemale) {
          const femaleAudio = await generateAudioForVoice(
            summary.content,
            FEMALE_VOICE,
            AZURE_TTS_KEY,
            AZURE_TTS_REGION
          );
          if (femaleAudio) {
            audioCache[FEMALE_VOICE] = femaleAudio;
          } else {
            failed++;
          }
        }

        if (needsMale) {
          const maleAudio = await generateAudioForVoice(
            summary.content,
            MALE_VOICE,
            AZURE_TTS_KEY,
            AZURE_TTS_REGION
          );
          if (maleAudio) {
            audioCache[MALE_VOICE] = maleAudio;
          } else {
            failed++;
          }
        }

        // Update the summary with cached audio
        const { error: updateError } = await supabase
          .from('summaries')
          .update({ audio_url: JSON.stringify(audioCache) })
          .eq('id', summary.id);

        if (updateError) {
          console.error(`Failed to update summary ${summary.id}:`, updateError);
          failed++;
        } else {
          processed++;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed, 
          failed,
          message: `Processed ${processed} summaries, ${failed} failures`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Generate audio for a specific book
    if (bookId && summaryContent) {
      console.log(`Generating audio for book ${bookId}`);
      
      const audioCache: Record<string, string> = {};

      // Generate female voice
      const femaleAudio = await generateAudioForVoice(
        summaryContent,
        FEMALE_VOICE,
        AZURE_TTS_KEY,
        AZURE_TTS_REGION
      );
      if (femaleAudio) {
        audioCache[FEMALE_VOICE] = femaleAudio;
      }

      // Generate male voice
      const maleAudio = await generateAudioForVoice(
        summaryContent,
        MALE_VOICE,
        AZURE_TTS_KEY,
        AZURE_TTS_REGION
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
          console.error('Failed to update summary with audio:', updateError);
        } else {
          console.log(`Successfully cached audio for book ${bookId}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          voicesGenerated: Object.keys(audioCache).length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request. Provide bookId and summaryContent, or action='generateAll'" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Background audio generation error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
