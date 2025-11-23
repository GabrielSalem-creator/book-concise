import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookTitle, bookAuthor, pdfUrl } = await req.json();
    console.log(`[generate-summary] Generating summary for: ${bookTitle}`);

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

    // Check user credits if authenticated
    if (userId) {
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
            daily_credits: 2,
            last_credit_reset: today,
            completed_onboarding: false,
            themes: []
          });
        
        if (insertError) {
          console.error('[generate-summary] Error creating preferences:', insertError);
        } else {
          console.log('[generate-summary] Created new user preferences with 2 credits');
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        const lastReset = preferences.last_credit_reset;
        let currentCredits = preferences.daily_credits;

        // Reset credits if it's a new day
        if (lastReset !== today) {
          currentCredits = 2;
          await supabase
            .from('user_preferences')
            .update({
              daily_credits: 2,
              last_credit_reset: today
            })
            .eq('user_id', userId);
          console.log('[generate-summary] Credits reset to 2 for new day');
        }

        // Check if user has credits
        if (currentCredits <= 0) {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'No credits remaining. You get 2 credits daily to generate new summaries.',
              creditsRemaining: 0
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // First, try to find existing book and check for existing summary
    const { data: existingBook } = await supabase
      .from('books')
      .select('id, summaries(id, content)')
      .eq('title', bookTitle)
      .maybeSingle();

    // If summary already exists, return it without consuming credits
    if (existingBook?.summaries && existingBook.summaries.length > 0) {
      console.log('[generate-summary] Found existing summary, returning without consuming credits');
      return new Response(
        JSON.stringify({
          success: true,
          summary: existingBook.summaries[0].content,
          bookId: existingBook.id,
          summaryId: existingBook.summaries[0].id,
          existingSummary: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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

    // Call AI to generate summary with specific details and stories
    const summaryPrompt = `Generate an exceptionally detailed and engaging summary of the book "${bookTitle}" by ${bookAuthor}. 

Your summary MUST include:
1. **Core Themes & Main Ideas**: Explain the 3-5 central concepts in depth
2. **Specific Stories & Examples**: Include at least 2-3 concrete stories, case studies, or real examples from the book that illustrate key points
3. **Key Insights**: Highlight breakthrough ideas or paradigm shifts the book offers
4. **Actionable Takeaways**: Provide 5-7 specific, practical actions readers can implement
5. **Context & Background**: Explain why this book matters and its unique contribution
6. **Memorable Quotes**: Include 2-3 impactful quotes from the book
7. **Chapter Breakdown**: Brief overview of major sections/chapters

Requirements:
- Length: 800-1200 words (very comprehensive and detailed)
- Be SPECIFIC, not general - use actual examples and stories from the book
- Write in an engaging, storytelling style
- Make it memorable and practical
- Include concrete details like names, situations, experiments, or case studies mentioned in the book
- Avoid generic statements - every point should be specific to THIS book

Make it so detailed and specific that someone reading this summary will remember the book's core stories and can apply its teachings immediately.`;

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
            content: 'You are a professional book analyst who creates exceptionally detailed, specific, and practical summaries. Focus on concrete stories, examples, and actionable insights.'
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

    console.log(`[generate-summary] Summary generated in ${generationTime}s`);

    // Deduct a credit from the user
    if (userId) {
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
      } else {
        console.log('[generate-summary] No preferences found to deduct credit');
      }
    }

    // Save summary to database
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

    console.log(`[generate-summary] Summary saved with id: ${summaryData.id}`);

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
        summaryId: summaryData.id,
        generationTime,
        creditsRemaining
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
