import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Background function to fetch book cover image from Open Library API
async function fetchBookCover(supabase: any, bookId: string, title: string, author: string) {
  try {
    // Try Open Library search for cover
    const query = encodeURIComponent(`${title} ${author}`);
    const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i,title`);
    if (!response.ok) return;
    
    const data = await response.json();
    if (data.docs?.[0]?.cover_i) {
      const coverId = data.docs[0].cover_i;
      const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      
      await supabase
        .from('books')
        .update({ cover_image_url: coverUrl })
        .eq('id', bookId);
      
      console.log(`[chat] Cover image saved for: ${title}`);
    }
  } catch (error) {
    console.error(`[chat] Failed to fetch cover for ${title}:`, error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, chatHistory = [] } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

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
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Build full conversation for AI
    const fullHistory = [
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // Count conversation turns to understand where we are
    const userTurns = fullHistory.filter((m: any) => m.role === 'user').length;

    const systemPrompt = `You are a concise, expert reading advisor. You know ALL published books across every genre.

YOUR MISSION: Quickly understand what the user wants and create the perfect reading plan.

CONVERSATION RULES:
1. Be CONCISE - max 2-3 sentences per response plus your question.
2. Ask only 1-2 quick clarifying questions before creating the plan. Don't over-ask.
3. If the user's goal is clear from the first message, you can create the plan after just 1 exchange.
4. Questions to consider (pick the most relevant 1-2):
   - What specifically they want to achieve
   - Their experience level (beginner/intermediate/advanced)
   - How many books they want (quick 2-3 or deep 5-7)
5. Show expertise by naturally referencing relevant books.
6. Be warm but efficient - respect the user's time.

BOOK SELECTION (WHEN CREATING PLAN):
- Pick highly rated, well-regarded, REAL published books
- Each book serves a distinct purpose - no redundancy
- Order: foundational first, then advanced
- Brief reason for each pick (1 sentence max)
- 2-7 books based on user preference

Current turn: ${userTurns}. ${userTurns < 2 ? 'Ask ONE quick clarifying question.' : 'Create the plan now if you have enough info.'}`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...fullHistory
    ];

    const aiBody: any = {
      model: 'google/gemini-3-flash-preview',
      messages: aiMessages,
      temperature: 0.8,
    };

    // Only provide the tool after enough conversation
    if (userTurns >= 2) {
      aiBody.tools = [{
        type: 'function',
        function: {
          name: 'create_reading_plan',
          description: 'Create a personalized reading plan after gathering enough info about the user\'s needs. Only call this when you have a clear understanding of what the user wants.',
          parameters: {
            type: 'object',
            properties: {
              goal_title: { type: 'string', description: 'Concise title for the reading goal' },
              goal_description: { type: 'string', description: 'Description of what the user wants to achieve, based on the conversation' },
              depth_level: { type: 'string', enum: ['shallow', 'medium', 'deep'] },
              books: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Exact real book title' },
                    author: { type: 'string', description: 'Author name' },
                    reason: { type: 'string', description: 'Why this book is perfect for THIS user based on the conversation' }
                  },
                  required: ['title', 'author', 'reason'],
                  additionalProperties: false
                }
              }
            },
            required: ['goal_title', 'goal_description', 'depth_level', 'books'],
            additionalProperties: false
          }
        }
      }];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited. Please wait a moment and try again.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0].message;
    const toolCall = choice.tool_calls?.[0];

    // If the AI is still asking questions (no tool call)
    if (!toolCall) {
      const aiResponse = choice.content || "Tell me more about what you're looking for!";
      
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: aiResponse }
      ]);

      return new Response(JSON.stringify({ response: aiResponse, goalCreated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI decided to create the plan
    const planData = JSON.parse(toolCall.function.arguments);
    console.log('[chat] Creating plan:', planData.goal_title, 'with', planData.books.length, 'books');

    // Create goal
    const { data: newGoal, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: planData.goal_title,
        description: `${planData.goal_description} (${planData.depth_level} - ${planData.books.length} books)`,
        status: 'active'
      })
      .select()
      .single();

    if (goalError) throw goalError;

    // Create or find books and add to reading plan
    const addedBooks: any[] = [];
    const createdBooks: any[] = [];

    for (let i = 0; i < planData.books.length; i++) {
      const bookInfo = planData.books[i];
      
      // Check if book exists in DB
      let { data: existingBook } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url, summaries(id)')
        .ilike('title', bookInfo.title)
        .maybeSingle();

      let bookId: string;

      if (existingBook) {
        bookId = existingBook.id;
        const hasSummary = existingBook.summaries && existingBook.summaries.length > 0;
        addedBooks.push({ ...bookInfo, hasSummary });

        // Try to fetch cover image if missing
        if (!existingBook.cover_image_url) {
          fetchBookCover(supabase, existingBook.id, bookInfo.title, bookInfo.author);
        }
      } else {
        // Create the book entry
        const { data: newBook } = await supabase
          .from('books')
          .insert({
            title: bookInfo.title,
            author: bookInfo.author,
            description: bookInfo.reason
          })
          .select()
          .single();

        if (!newBook) {
          console.error('[chat] Failed to create book:', bookInfo.title);
          continue;
        }
        bookId = newBook.id;
        createdBooks.push(bookInfo);

        // Fetch cover image in background
        fetchBookCover(supabase, newBook.id, bookInfo.title, bookInfo.author);
      }

      await supabase.from('reading_plan_books').insert({
        goal_id: newGoal.id,
        book_id: bookId,
        order_index: i,
        status: 'pending'
      });
    }

    const totalBooks = addedBooks.length + createdBooks.length;

    if (totalBooks === 0) {
      await supabase.from('goals').delete().eq('id', newGoal.id);
      const failResponse = "I'm sorry, I couldn't set up the reading plan. Please try again with a different request.";
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: failResponse }
      ]);
      return new Response(JSON.stringify({ response: failResponse, goalCreated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a rich response
    const allBooks = [...addedBooks, ...createdBooks];
    const bookList = allBooks
      .map((b: any, i: number) => `${i + 1}. **"${b.title}"** by ${b.author}\n   _${b.reason}_`)
      .join('\n\n');

    const depthEmoji = planData.depth_level === 'deep' ? '📚' : planData.depth_level === 'medium' ? '📖' : '📕';

    let aiResponse = `${depthEmoji} I've crafted your personalized reading plan: **"${planData.goal_title}"**

Based on everything you've shared, here are your ${totalBooks} carefully selected books:

${bookList}

Head to your **Dashboard** to start reading! Each book was chosen specifically for your situation. 🚀`;

    if (createdBooks.length > 0) {
      aiResponse += `\n\n💡 _${createdBooks.length} book(s) will need summaries generated when you start reading._`;
    }

    // Also include the text content the AI wanted to say alongside the tool call
    if (choice.content) {
      aiResponse = choice.content + '\n\n' + aiResponse;
    }

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
