import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { message, bookId, bookTitle, bookAuthor, summary, chatHistory = [] } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // System prompt specialized for book discussions
    const systemPrompt = `You are an expert book discussion assistant. You have complete knowledge of the book "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}.

Here is the summary of the book you're discussing:
---
${summary}
---

Your role:
1. Answer questions about the book's content, themes, and key insights
2. Clarify concepts and ideas from the book
3. Provide deeper analysis when asked
4. Relate book concepts to real-world applications
5. Help users understand and apply what they've learned

Guidelines:
- Be concise but thorough
- Use examples from the book when relevant
- If asked about something not in the summary, acknowledge that and provide general guidance
- Be encouraging and helpful
- Format responses with markdown for clarity when appropriate`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    console.log(`[chat-with-book] User ${user.id} asking about book: ${bookTitle}`);
    console.log(`[chat-with-book] Question: ${message}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[chat-with-book] AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log(`[chat-with-book] Response generated successfully`);

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[chat-with-book] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
