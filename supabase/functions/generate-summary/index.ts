import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported TTS languages (Web Speech API common languages)
const TTS_SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ms', 'sv', 'da', 'no', 'fi', 'cs', 'el', 'he', 'ro', 'hu', 'uk'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookTitle, bookAuthor, pdfUrl, bookId: inputBookId, targetLanguage, pdfText } = await req.json();
    console.log(`[generate-summary] Generating summary for: ${bookTitle}, bookId: ${inputBookId}, targetLanguage: ${targetLanguage || 'auto-detect'}`);

    if (!bookTitle) {
      throw new Error('Book title is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    }

    // FIRST: Check if summary already exists - don't consume credits for existing summaries
    let existingBook = null;
    if (inputBookId) {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, summaries(id, content)')
        .eq('id', inputBookId)
        .maybeSingle();
      existingBook = data;
      console.log(`[generate-summary] Checked by bookId: ${inputBookId}, found: ${!!existingBook}, summaries: ${JSON.stringify(existingBook?.summaries)}`);
    } else {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, summaries(id, content)')
        .eq('title', bookTitle)
        .maybeSingle();
      existingBook = data;
      console.log(`[generate-summary] Checked by title: ${bookTitle}, found: ${!!existingBook}`);
    }

    // If summary already exists AND no targetLanguage for translation, return it
    if (existingBook?.summaries && existingBook.summaries.length > 0 && !targetLanguage) {
      console.log('[generate-summary] Found existing summary, returning without consuming credits');
      return new Response(
        JSON.stringify({
          success: true,
          summary: existingBook.summaries[0].content,
          bookId: existingBook.id,
          summaryId: existingBook.summaries[0].id,
          existingSummary: true,
          detectedLanguage: 'en',
          ttsLanguage: 'en'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // NOW check user credits - only for NEW summary generation
    if (userId && !targetLanguage) {
      const { data: preferences, error: prefsError } = await supabase
        .from('user_preferences')
        .select('daily_credits, last_credit_reset')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefsError) {
        console.error('[generate-summary] Error fetching preferences:', prefsError);
      }

      // If no preferences exist, create them
      if (!preferences) {
        const today = new Date().toISOString().split('T')[0];
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: userId,
            daily_credits: 3,
            last_credit_reset: today,
            completed_onboarding: false,
            themes: []
          });
        
        if (insertError) {
          console.error('[generate-summary] Error creating preferences:', insertError);
        } else {
          console.log('[generate-summary] Created new user preferences with 3 credits');
        }
      } else {
        // Weekly reset logic
        const today = new Date();
        const lastReset = new Date(preferences.last_credit_reset);
        const daysSinceReset = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
        let currentCredits = preferences.daily_credits;

        // Reset credits if it's been 7 days
        if (daysSinceReset >= 7) {
          currentCredits = 3;
          await supabase
            .from('user_preferences')
            .update({
              daily_credits: 3,
              last_credit_reset: today.toISOString().split('T')[0]
            })
            .eq('user_id', userId);
          console.log('[generate-summary] Credits reset to 3 for new week');
        }

        // Check if user has credits
        if (currentCredits <= 0) {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'No credits remaining. You get 3 credits weekly to generate new summaries.',
              creditsRemaining: 0
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    let bookId = existingBook?.id;

    // If book doesn't exist, create it
    if (!bookId) {
      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          title: bookTitle,
          author: bookAuthor || 'Unknown',
          pdf_url: pdfUrl
        })
        .select('id')
        .single();

      if (bookError) throw bookError;
      bookId = newBook.id;
      console.log(`[generate-summary] Created new book with id: ${bookId}`);
    }

    // Step 1: Detect language and theme from the book content or title
    const contentSample = pdfText ? pdfText.substring(0, 2000) : bookTitle;
    
    console.log('[generate-summary] Analyzing book language and theme...');
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You analyze books to detect their language and genre/theme. Respond ONLY with valid JSON, no markdown.'
          },
          {
            role: 'user',
            content: `Analyze this book content/title and detect:
1. The language code (ISO 639-1, e.g., 'en', 'fr', 'es', 'ar', 'zh', 'ja')
2. The genre/theme (e.g., 'business', 'self-help', 'fiction-action', 'fiction-comedy', 'fiction-drama', 'fiction-romance', 'fiction-thriller', 'biography', 'history', 'science', 'philosophy', 'spirituality', 'health', 'technology', 'children', 'poetry')
3. The appropriate tone for the summary (e.g., 'professional', 'inspirational', 'adventurous', 'humorous', 'dramatic', 'poetic', 'educational', 'conversational', 'serious', 'playful')

Book title: "${bookTitle}"
Author: "${bookAuthor || 'Unknown'}"
Content sample: "${contentSample}"

Respond in JSON format only:
{"language": "xx", "genre": "genre-name", "tone": "tone-name"}`
          }
        ],
      }),
    });

    let detectedLanguage = 'en';
    let detectedGenre = 'business';
    let detectedTone = 'professional';

    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json();
      const analysisText = analysisData.choices[0].message.content;
      try {
        // Clean the response - remove markdown code blocks if present
        const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(cleanedText);
        detectedLanguage = analysis.language || 'en';
        detectedGenre = analysis.genre || 'business';
        detectedTone = analysis.tone || 'professional';
        console.log(`[generate-summary] Detected - Language: ${detectedLanguage}, Genre: ${detectedGenre}, Tone: ${detectedTone}`);
      } catch (e) {
        console.error('[generate-summary] Failed to parse analysis:', e, analysisText);
      }
    }

    // Use target language if specified, otherwise use detected language
    const outputLanguage = targetLanguage || detectedLanguage;
    
    // Determine TTS language - fallback to English if not supported
    const ttsLanguage = TTS_SUPPORTED_LANGUAGES.includes(outputLanguage) ? outputLanguage : 'en';

    // Get language name for prompt
    const languageNames: Record<string, string> = {
      'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
      'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese',
      'ar': 'Arabic', 'hi': 'Hindi', 'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish',
      'vi': 'Vietnamese', 'th': 'Thai', 'id': 'Indonesian', 'ms': 'Malay', 'sv': 'Swedish',
      'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'cs': 'Czech', 'el': 'Greek',
      'he': 'Hebrew', 'ro': 'Romanian', 'hu': 'Hungarian', 'uk': 'Ukrainian'
    };
    const languageName = languageNames[outputLanguage] || 'English';

    // Build tone-specific writing instructions
    const toneInstructions: Record<string, string> = {
      'professional': 'Write in a clear, authoritative, and structured professional style. Use formal language and logical flow.',
      'inspirational': 'Write in an uplifting, motivational tone that inspires action. Use powerful, emotionally resonant language.',
      'adventurous': 'Write with energy and excitement! Use vivid action words, create suspense, and make the reader feel the thrill.',
      'humorous': 'Write with wit and humor. Include amusing observations, playful language, and a light-hearted perspective.',
      'dramatic': 'Write with intensity and emotion. Build tension, explore deep feelings, and create impactful moments.',
      'poetic': 'Write with lyrical beauty. Use metaphors, imagery, and rhythmic language that flows beautifully.',
      'educational': 'Write in a clear, accessible teaching style. Explain concepts step-by-step with helpful examples.',
      'conversational': 'Write in a friendly, casual tone as if talking to a friend. Keep it warm and approachable.',
      'serious': 'Write with gravity and depth. Address weighty topics with appropriate solemnity and thoughtfulness.',
      'playful': 'Write with lightness and joy. Use fun language, creative expressions, and an energetic vibe.'
    };
    const toneInstruction = toneInstructions[detectedTone] || toneInstructions['professional'];

    // Build genre-specific content focus
    const genreInstructions: Record<string, string> = {
      'business': 'Focus on strategies, case studies, business insights, and actionable business advice.',
      'self-help': 'Focus on personal growth techniques, life lessons, and transformative practices.',
      'fiction-action': 'Focus on exciting plot points, thrilling sequences, character journeys, and pivotal action moments.',
      'fiction-comedy': 'Focus on funny situations, witty dialogue, comedic timing, and humorous observations.',
      'fiction-drama': 'Focus on emotional arcs, character relationships, dramatic turning points, and meaningful themes.',
      'fiction-romance': 'Focus on relationship development, emotional connections, romantic moments, and character chemistry.',
      'fiction-thriller': 'Focus on suspenseful plot twists, tension-building moments, mysteries, and gripping revelations.',
      'biography': 'Focus on life events, personal struggles, achievements, and the subject\'s impact on the world.',
      'history': 'Focus on historical events, context, key figures, and lessons from the past.',
      'science': 'Focus on discoveries, experiments, scientific concepts, and their real-world applications.',
      'philosophy': 'Focus on ideas, arguments, thought experiments, and philosophical frameworks.',
      'spirituality': 'Focus on spiritual teachings, practices, inner wisdom, and transcendent experiences.',
      'health': 'Focus on health advice, research findings, wellness practices, and practical health tips.',
      'technology': 'Focus on innovations, technical concepts, future implications, and practical applications.',
      'children': 'Focus on the story message, characters, adventures, and lessons for young readers.',
      'poetry': 'Focus on themes, imagery, emotional resonance, and the beauty of the language used.'
    };
    const genreInstruction = genreInstructions[detectedGenre] || genreInstructions['business'];

    // Call AI to generate summary with language, theme, and tone awareness
    const summaryPrompt = `Generate an exceptionally detailed and engaging summary of the book "${bookTitle}" by ${bookAuthor || 'Unknown'}. 

CRITICAL REQUIREMENTS:
- Write the ENTIRE summary in ${languageName} language
- ${toneInstruction}
- ${genreInstruction}

Your summary MUST include:
1. **Core Themes & Main Ideas**: Explain the 3-5 central concepts in depth
2. **Specific Stories & Examples**: Include at least 2-3 concrete stories, case studies, or examples from the book
3. **Key Insights**: Highlight breakthrough ideas or memorable moments
4. **Actionable Takeaways**: Provide 5-7 specific, practical actions or lessons readers can apply
5. **Context & Background**: Explain why this book matters and its unique contribution
6. **Memorable Quotes**: Include 2-3 impactful quotes or passages from the book
7. **Chapter/Section Overview**: Brief overview of major sections

Writing Style Requirements:
- Length: 800-1200 words (comprehensive and detailed)
- Be SPECIFIC, not general - use actual examples and stories from the book
- Write in an engaging, ${detectedTone} style appropriate for this ${detectedGenre} book
- Make it memorable and immersive
- Include concrete details mentioned in the book
- Avoid generic statements - every point should be specific to THIS book
- Remember: The tone should match the book's genre (${detectedGenre})

Make it so detailed and specific that someone reading this summary will remember the book's core elements and can apply its teachings immediately.`;

    console.log('[generate-summary] Calling AI API to generate detailed summary...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a professional book analyst who creates exceptionally detailed, specific, and practical summaries. You write in ${languageName} with a ${detectedTone} tone appropriate for ${detectedGenre} books. Focus on concrete stories, examples, and engaging content that matches the book's style.`
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
      }),
    });

    // Generate AI summary
    const startTime = Date.now();

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI request failed: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices[0].message.content;
    const generationTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`[generate-summary] Summary generated in ${generationTime}s, Language: ${outputLanguage}, TTS: ${ttsLanguage}`);

    // Deduct a credit from the user (only for new summaries, not translations)
    if (userId && !targetLanguage) {
      const { data: currentPrefs } = await supabase
        .from('user_preferences')
        .select('daily_credits')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (currentPrefs) {
        const { error: creditError } = await supabase
          .from('user_preferences')
          .update({ daily_credits: Math.max(0, currentPrefs.daily_credits - 1) })
          .eq('user_id', userId);

        if (creditError) {
          console.error('[generate-summary] Error deducting credit:', creditError);
        } else {
          console.log('[generate-summary] Credit deducted from user');
        }
      }
    }

    // Save summary to database (only for new summaries, not translations)
    let summaryId = null;
    if (!targetLanguage) {
      const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .insert({
          book_id: bookId,
          content: summary,
          generated_by: userId,
          generation_time_seconds: generationTime,
          is_public: true
        })
        .select()
        .single();

      if (summaryError) throw summaryError;
      summaryId = summaryData.id;
      console.log(`[generate-summary] Summary saved with id: ${summaryId}`);
    }

    // Get updated credits
    let creditsRemaining = null;
    if (userId) {
      const { data: updatedPrefs } = await supabase
        .from('user_preferences')
        .select('daily_credits')
        .eq('user_id', userId)
        .maybeSingle();
      creditsRemaining = updatedPrefs?.daily_credits ?? null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        bookId,
        summaryId,
        generationTime,
        creditsRemaining,
        detectedLanguage: outputLanguage,
        detectedGenre,
        detectedTone,
        ttsLanguage,
        isTranslation: !!targetLanguage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[generate-summary] Error:', error);
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
