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

    // First, try to find existing book
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('title', bookTitle)
      .maybeSingle();

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

    // Generate AI summary
    const startTime = Date.now();
    
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
            content: 'You are a professional book summarizer. Create concise, engaging summaries that capture the key ideas, main themes, and important takeaways. Keep summaries between 300-500 words.'
          },
          {
            role: 'user',
            content: `Create a comprehensive summary for the book "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}. Include:\n1. Main premise and themes\n2. Key ideas and concepts\n3. Important takeaways\n4. Target audience\n\nMake it engaging and easy to understand.`
          }
        ],
      }),
    });

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

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
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

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        bookId,
        summaryId: summaryData.id,
        generationTime
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
