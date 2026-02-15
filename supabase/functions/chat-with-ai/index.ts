import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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

    const systemPrompt = `You are a world-class reading advisor, literary expert, and personal development coach. You have deep, encyclopedic knowledge of ALL books ever published across every genre — fiction, non-fiction, academic, self-help, business, philosophy, psychology, neuroscience, history, biography, spirituality, technology, health, relationships, and every niche in between. You know classics and hidden gems. You know which books changed industries and which ones are overrated.

YOUR CORE MISSION: Help users discover the PERFECT books for their unique situation by deeply understanding their needs through warm, insightful conversation.

CONVERSATION RULES — THIS IS CRITICAL:
1. DO NOT generate a reading plan immediately. You MUST ask at least 2-3 clarifying questions first across multiple messages.
2. Each response should be warm, insightful, and 2-4 sentences max (plus your question).
3. Your questions should progressively explore:
   - FIRST: What specifically they want to achieve, learn, or how they want to grow
   - THEN: Their current knowledge/experience level on the topic (beginner, intermediate, advanced)
   - THEN: Their reading style preferences (practical how-to vs philosophical/narrative, short vs long reads, academic vs conversational tone)
   - ALSO: What they've already read on this topic (so you can avoid repeating and build on their foundation)
   - FINALLY: How deep they want to go (quick overview with 2-3 books vs comprehensive mastery with 5-7 books)
4. Show genuine expertise. Naturally reference specific books, authors, or ideas in your responses to demonstrate your knowledge and build trust.
5. Be empathetic and curious — treat this like a conversation with a brilliant friend who genuinely cares about their growth.
6. Pick up on subtle cues in their answers to personalize your follow-up questions.
7. Once you feel you truly understand their unique needs (after 2-3+ exchanges), THEN create the plan.

BOOK SELECTION RULES (WHEN CREATING THE PLAN):
- Draw from YOUR FULL KNOWLEDGE of all books worldwide — you are NOT limited to any database
- Pick books that are highly rated, well-regarded, and specifically relevant to the user's stated needs and level
- Consider timeless classics AND modern gems published recently
- Each book should serve a DISTINCT purpose in the plan — no redundancy in themes or lessons
- Include diverse perspectives when appropriate (different authors, cultures, methodologies)
- The books MUST be real, published books — never invent fictional titles
- Order books logically: foundational reads first, then progressively more advanced/specific
- For each book, explain specifically WHY it's perfect for THIS user based on what they shared

WHEN READY TO CREATE PLAN:
- Briefly summarize what you understood about their needs
- Explain the logic behind the book order
- Use the create_reading_plan tool with 2-7 books based on the depth they indicated
- Add a personal touch — mention what they should pay attention to in each book

TONE: You're like a brilliant, well-read friend who happens to have read thousands of books and genuinely wants to help. Be conversational, warm, occasionally witty, and never robotic or generic.

Current conversation turn: ${userTurns}. ${userTurns < 3 ? 'You MUST ask a clarifying question — do NOT create a plan yet. Show genuine curiosity.' : 'If you have enough information, you may create the plan. If not, ask another question to refine your understanding.'}`;
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
    if (userTurns >= 3) {
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
        .select('id, title, author, summaries(id)')
        .ilike('title', bookInfo.title)
        .maybeSingle();

      let bookId: string;

      if (existingBook) {
        bookId = existingBook.id;
        const hasSummary = existingBook.summaries && existingBook.summaries.length > 0;
        addedBooks.push({ ...bookInfo, hasSummary });
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
