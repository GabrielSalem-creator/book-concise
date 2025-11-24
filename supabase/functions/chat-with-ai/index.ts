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
    const { message, chatHistory = [] } = await req.json();
    
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

    // Check if user has an active goal
    const { data: activeGoal } = await supabase
      .from('goals')
      .select('id, title, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeGoal) {
      const response = "You already have an active reading goal in progress. Please complete your current reading plan before setting a new goal. Check your Dashboard to see your progress!";
      
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: response }
      ]);

      return new Response(JSON.stringify({ response, hasActiveGoal: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // System prompt for concise, goal-based book recommendations
    const systemPrompt = `You are a concise reading advisor. When users share their goals:

1. Respond in 2-3 sentences acknowledging their goal
2. Use the create_reading_plan tool to recommend 4-6 specific books
3. Keep your language brief and encouraging

Important: Always use the tool to create the reading plan. The tool will handle book creation.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

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
        tools: [{
          type: 'function',
          function: {
            name: 'create_reading_plan',
            description: 'Create a reading plan with specific books to help achieve a goal',
            parameters: {
              type: 'object',
              properties: {
                goal_title: {
                  type: 'string',
                  description: 'A clear, concise title for the goal (e.g., "Master Leadership Skills")'
                },
                goal_description: {
                  type: 'string',
                  description: 'Brief description of what the user wants to achieve'
                },
                books: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Full book title' },
                      author: { type: 'string', description: 'Author name' },
                      reason: { type: 'string', description: 'One sentence why this book helps achieve the goal' }
                    },
                    required: ['title', 'author', 'reason']
                  },
                  minItems: 4,
                  maxItems: 6
                }
              },
              required: ['goal_title', 'goal_description', 'books']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_reading_plan' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0].message.tool_calls?.[0];

    if (!toolCall) {
      throw new Error('No reading plan generated');
    }

    const planData = JSON.parse(toolCall.function.arguments);

    // Create goal
    const { data: newGoal, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: planData.goal_title,
        description: planData.goal_description,
        status: 'active'
      })
      .select()
      .single();

    if (goalError) throw goalError;

    // Create or get books and add to reading plan
    for (let i = 0; i < planData.books.length; i++) {
      const bookInfo = planData.books[i];
      
      // Check if book exists
      let { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('title', bookInfo.title)
        .eq('author', bookInfo.author)
        .maybeSingle();

      let bookId: string;

      if (existingBook) {
        bookId = existingBook.id;
      } else {
        // Create new book
        const { data: newBook, error: bookError } = await supabase
          .from('books')
          .insert({
            title: bookInfo.title,
            author: bookInfo.author,
            description: bookInfo.reason
          })
          .select()
          .single();

        if (bookError) throw bookError;
        bookId = newBook.id;
      }

      // Add to reading plan
      await supabase
        .from('reading_plan_books')
        .insert({
          goal_id: newGoal.id,
          book_id: bookId,
          order_index: i,
          status: 'pending'
        });
    }

    // Create concise response
    const bookList = planData.books
      .map((b: any, i: number) => `${i + 1}. "${b.title}" by ${b.author}`)
      .join('\n');

    const aiResponse = `Great! I've created your reading plan: "${planData.goal_title}"

Here are your books:
${bookList}

Check your Dashboard to start reading and track your progress!`;

    // Save conversation
    await supabase.from('chat_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: aiResponse }
    ]);

    return new Response(JSON.stringify({ response: aiResponse, goalCreated: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-with-ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});