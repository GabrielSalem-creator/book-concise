import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TTSRequest {
  summaryId?: string;
  bookId?: string;
  text?: string;
  voice?: string;
  generateAll?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AZURE_SPEECH_KEY = Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_SPEECH_REGION = Deno.env.get("AZURE_SPEECH_REGION") || "eastus";
    
    if (!AZURE_SPEECH_KEY) {
      throw new Error("AZURE_SPEECH_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TTSRequest = await req.json();
    const { summaryId, bookId, text, voice = "en-US-AvaNeural", generateAll = false } = body;

    // If generateAll is true, find all summaries without audio and generate for them
    if (generateAll) {
      console.log("Finding summaries without audio...");
      
      const { data: summaries, error: fetchError } = await supabase
        .from("summaries")
        .select("id, book_id, content")
        .is("audio_url", null)
        .limit(10); // Process 10 at a time to avoid timeout

      if (fetchError) {
        throw new Error(`Failed to fetch summaries: ${fetchError.message}`);
      }

      if (!summaries || summaries.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No summaries need audio generation", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Found ${summaries.length} summaries to process`);
      
      const results = [];
      for (const summary of summaries) {
        try {
          const audioUrl = await generateAndUploadAudio(
            supabase,
            summary.content,
            summary.book_id,
            summary.id,
            voice,
            AZURE_SPEECH_KEY,
            AZURE_SPEECH_REGION
          );
          results.push({ summaryId: summary.id, success: true, audioUrl });
        } catch (err) {
          console.error(`Failed to generate audio for summary ${summary.id}:`, err);
          results.push({ summaryId: summary.id, success: false, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: results.length,
          results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate for a specific summary
    if (!summaryId && !text) {
      throw new Error("Either summaryId or text is required");
    }

    let summaryContent = text;
    let targetBookId = bookId;
    let targetSummaryId = summaryId;

    if (summaryId) {
      const { data: summary, error: summaryError } = await supabase
        .from("summaries")
        .select("id, book_id, content, audio_url")
        .eq("id", summaryId)
        .single();

      if (summaryError || !summary) {
        throw new Error(`Summary not found: ${summaryError?.message}`);
      }

      // Skip if already has audio
      if (summary.audio_url) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Audio already exists",
            audioUrl: summary.audio_url 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      summaryContent = summary.content;
      targetBookId = summary.book_id;
      targetSummaryId = summary.id;
    }

    if (!summaryContent) {
      throw new Error("No text content to convert");
    }

    const audioUrl = await generateAndUploadAudio(
      supabase,
      summaryContent,
      targetBookId!,
      targetSummaryId!,
      voice,
      AZURE_SPEECH_KEY,
      AZURE_SPEECH_REGION
    );

    return new Response(
      JSON.stringify({ success: true, audioUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("TTS generation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAndUploadAudio(
  supabase: any,
  text: string,
  bookId: string,
  summaryId: string,
  voice: string,
  apiKey: string,
  region: string
): Promise<string> {
  console.log(`Generating audio for summary ${summaryId} with voice ${voice}`);
  
  // Truncate text if too long (Azure has limits)
  const maxChars = 10000;
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + "..." : text;
  
  // Build SSML for better quality
  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voice}">
        <prosody rate="0.95" pitch="0%">
          ${escapeXml(truncatedText)}
        </prosody>
      </voice>
    </speak>
  `.trim();

  // Call Azure TTS API
  const ttsUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  
  const response = await fetch(ttsUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "SummaryApp",
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure TTS failed [${response.status}]: ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);
  
  console.log(`Audio generated: ${audioBytes.length} bytes`);

  // Upload to Supabase Storage
  const fileName = `${bookId}/${summaryId}.mp3`;
  
  const { error: uploadError } = await supabase.storage
    .from("audio-summaries")
    .upload(fileName, audioBytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("audio-summaries")
    .getPublicUrl(fileName);

  const audioUrl = urlData.publicUrl;

  // Update summary with audio URL
  const { error: updateError } = await supabase
    .from("summaries")
    .update({
      audio_url: audioUrl,
      audio_generated_at: new Date().toISOString(),
      audio_voice: voice,
    })
    .eq("id", summaryId);

  if (updateError) {
    console.error("Failed to update summary:", updateError);
  }

  console.log(`Audio uploaded: ${audioUrl}`);
  return audioUrl;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
