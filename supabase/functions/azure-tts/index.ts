import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AZURE_TTS_KEY = Deno.env.get("AZURE_TTS_KEY");
    let AZURE_TTS_REGION = Deno.env.get("AZURE_TTS_REGION") || "francecentral";

    // Handle case where region is provided as full URL
    // e.g., "https://francecentral.api.cognitive.microsoft.com/" -> "francecentral"
    if (AZURE_TTS_REGION.includes('.api.cognitive.microsoft.com')) {
      const match = AZURE_TTS_REGION.match(/https?:\/\/([^.]+)\.api\.cognitive\.microsoft\.com/);
      if (match) {
        AZURE_TTS_REGION = match[1];
        console.log(`Extracted region from URL: ${AZURE_TTS_REGION}`);
      }
    }
    
    // Also handle if it starts with https:// but doesn't match the pattern
    if (AZURE_TTS_REGION.startsWith('https://') || AZURE_TTS_REGION.startsWith('http://')) {
      AZURE_TTS_REGION = AZURE_TTS_REGION.replace(/https?:\/\//, '').split('.')[0];
      console.log(`Cleaned region: ${AZURE_TTS_REGION}`);
    }

    if (!AZURE_TTS_KEY) {
      console.error("AZURE_TTS_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Azure TTS not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Using Azure TTS region: ${AZURE_TTS_REGION}`);

    const { action, text, voiceName = "en-US-AvaNeural", rate = "1.0", pitch = "0%" } = await req.json();

    // Action: Get list of available voices
    if (action === "getVoices") {
      console.log("Fetching Azure TTS voices list...");
      
      const voicesEndpoint = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      
      const voicesResponse = await fetch(voicesEndpoint, {
        headers: {
          "Ocp-Apim-Subscription-Key": AZURE_TTS_KEY,
        },
      });

      if (!voicesResponse.ok) {
        console.error("Failed to fetch voices:", voicesResponse.status, await voicesResponse.text());
        return new Response(
          JSON.stringify({ error: "Failed to fetch voices" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const allVoices = await voicesResponse.json();
      
      // Filter to English voices and add useful metadata
      const englishVoices = allVoices
        .filter((v: any) => v.Locale.startsWith('en-'))
        .map((v: any) => ({
          name: v.ShortName,
          displayName: v.DisplayName,
          localName: v.LocalName,
          gender: v.Gender,
          locale: v.Locale,
          voiceType: v.VoiceType,
          styleList: v.StyleList || [],
        }))
        .sort((a: any, b: any) => {
          // Prioritize Neural voices
          if (a.voiceType === 'Neural' && b.voiceType !== 'Neural') return -1;
          if (b.voiceType === 'Neural' && a.voiceType !== 'Neural') return 1;
          return a.displayName.localeCompare(b.displayName);
        });

      console.log(`Found ${englishVoices.length} English voices`);

      return new Response(
        JSON.stringify({ voices: englishVoices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Generate speech from text
    if (action === "speak" || !action) {
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Text is required" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Generating speech: voice=${voiceName}, text length=${text.length}`);

      const ttsEndpoint = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

      // Escape special XML characters in the text
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      // Build SSML with proper voice and prosody
      const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <prosody rate='${rate}' pitch='${pitch}'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`.trim();

      const response = await fetch(ttsEndpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": AZURE_TTS_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "Lovable-TTS-Client",
        },
        body: ssml,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Azure TTS error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `TTS generation failed: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return audio as base64
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

      console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

      return new Response(
        JSON.stringify({ 
          audio: base64Audio, 
          format: "audio/mpeg",
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'getVoices' or 'speak'" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Azure TTS error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
