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

    // Get all available books with summaries from database
    const { data: availableBooks } = await supabase
      .from('books')
      .select('id, title, author, summaries(id)')
      .not('summaries', 'is', null);

    const booksWithSummaries = availableBooks?.filter(b => b.summaries && b.summaries.length > 0) || [];
    const bookTitles = booksWithSummaries.map(b => `"${b.title}" by ${b.author || 'Unknown'}`).join('\n');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Check if user has specified depth preference
    const lowerMessage = message.toLowerCase();
    const hasDepthPreference = lowerMessage.includes('deep') || 
                               lowerMessage.includes('medium') || 
                               lowerMessage.includes('shallow') ||
                               lowerMessage.includes('thorough') ||
                               lowerMessage.includes('quick') ||
                               lowerMessage.includes('overview');

    // Check if this is a goal message (not just asking about depth)
    const isGoalMessage = lowerMessage.includes('want to') || 
                          lowerMessage.includes('learn') ||
                          lowerMessage.includes('become') ||
                          lowerMessage.includes('improve') ||
                          lowerMessage.includes('understand') ||
                          lowerMessage.includes('master') ||
                          lowerMessage.includes('goal') ||
                          chatHistory.length > 0;

    // If user shared a goal but no depth preference, ask for it
    if (isGoalMessage && !hasDepthPreference && chatHistory.length === 0) {
      const depthQuestion = `Great goal! Before I create your personalized reading plan, how deep would you like to go?

📚 **Deep Understanding** (5-7 books)
For comprehensive mastery and expert-level knowledge

📖 **Medium Understanding** (3-4 books)  
For solid foundational knowledge and practical skills

📕 **Quick Overview** (1-2 books)
For essential concepts and quick wins

Just reply with "deep", "medium", or "shallow" and I'll curate the perfect reading list for you!`;
      
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: depthQuestion }
      ]);

      return new Response(JSON.stringify({ 
        response: depthQuestion, 
        askingDepth: true,
        originalGoal: message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine book count based on depth preference
    let minBooks = 3;
    let maxBooks = 5;
    let depthLabel = 'medium';

    if (lowerMessage.includes('deep') || lowerMessage.includes('thorough') || lowerMessage.includes('comprehensive')) {
      minBooks = 5;
      maxBooks = 7;
      depthLabel = 'deep';
    } else if (lowerMessage.includes('shallow') || lowerMessage.includes('quick') || lowerMessage.includes('overview') || lowerMessage.includes('1') || lowerMessage.includes('2')) {
      minBooks = 1;
      maxBooks = 2;
      depthLabel = 'shallow';
    } else if (lowerMessage.includes('medium') || lowerMessage.includes('moderate') || lowerMessage.includes('3') || lowerMessage.includes('4')) {
      minBooks = 3;
      maxBooks = 4;
      depthLabel = 'medium';
    }

    // Extract the original goal from chat history if this is a depth response
    let userGoal = message;
    if (chatHistory.length > 0) {
      // Find the first user message which should be the goal
      const firstUserMsg = chatHistory.find((msg: any) => msg.role === 'user');
      if (firstUserMsg && (lowerMessage.includes('deep') || lowerMessage.includes('medium') || lowerMessage.includes('shallow') || lowerMessage.includes('quick') || lowerMessage.includes('thorough'))) {
        userGoal = firstUserMsg.content;
      }
    }

    // System prompt for goal-based book recommendations
    const systemPrompt = `You are a concise reading advisor helping users achieve their goals. 

AVAILABLE BOOKS IN OUR LIBRARY (prioritize these when relevant):
${bookTitles || 'No books available yet'}

When users share goals:
1. Acknowledge their goal in 1-2 sentences
2. Use the create_reading_plan tool to recommend ${minBooks}-${maxBooks} books (${depthLabel} understanding level)
3. PRIORITIZE books from our library above, but you can also recommend well-known books that match the goal
4. Keep responses brief and encouraging

Important: 
- Always use the tool to create the reading plan
- Match the number of books to the user's desired depth level
- Focus on books that directly help achieve the stated goal`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: `My goal: ${userGoal}. Depth preference: ${depthLabel} (${minBooks}-${maxBooks} books)` }
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
                depth_level: {
                  type: 'string',
                  enum: ['shallow', 'medium', 'deep'],
                  description: 'The depth of understanding the user wants'
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
                  minItems: minBooks,
                  maxItems: maxBooks
                }
              },
              required: ['goal_title', 'goal_description', 'depth_level', 'books']
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
        description: `${planData.goal_description} (${depthLabel} understanding - ${planData.books.length} books)`,
        status: 'active'
      })
      .select()
      .single();

    if (goalError) throw goalError;

    // Create or get books and add to reading plan
    const addedBooks: any[] = [];
    const skippedBooks: any[] = [];
    const createdBooks: any[] = [];

    for (let i = 0; i < planData.books.length; i++) {
      const bookInfo = planData.books[i];
      
      // Check if book exists WITH a summary
      let { data: existingBook } = await supabase
        .from('books')
        .select('id, title, author, summaries(id)')
        .eq('title', bookInfo.title)
        .maybeSingle();

      let bookId: string | null = null;
      let hasSummary = false;

      if (existingBook) {
        bookId = existingBook.id;
        hasSummary = existingBook.summaries && existingBook.summaries.length > 0;
      } else {
        // Search for similar books with summaries in database
        const { data: similarBooks } = await supabase
          .from('books')
          .select('id, title, author, summaries(id)')
          .ilike('title', `%${bookInfo.title.split(' ').slice(0, 3).join('%')}%`)
          .limit(1)
          .maybeSingle();
        
        if (similarBooks?.summaries && similarBooks.summaries.length > 0) {
          bookId = similarBooks.id;
          hasSummary = true;
        }
      }

      // Only add books that have summaries to avoid credit consumption
      if (bookId && hasSummary) {
        await supabase
          .from('reading_plan_books')
          .insert({
            goal_id: newGoal.id,
            book_id: bookId,
            order_index: addedBooks.length,
            status: 'pending'
          });
        addedBooks.push(bookInfo);
      } else {
        // Create the book entry without summary - user can generate later
        const { data: newBook } = await supabase
          .from('books')
          .insert({
            title: bookInfo.title,
            author: bookInfo.author,
            description: bookInfo.reason
          })
          .select()
          .single();

        if (newBook) {
          await supabase
            .from('reading_plan_books')
            .insert({
              goal_id: newGoal.id,
              book_id: newBook.id,
              order_index: addedBooks.length + createdBooks.length,
              status: 'pending'
            });
          createdBooks.push(bookInfo);
        } else {
          skippedBooks.push(bookInfo);
        }
        console.log(`[chat] Created book without summary: ${bookInfo.title}`);
      }
    }

    // If no books were added at all, delete the goal
    if (addedBooks.length === 0 && createdBooks.length === 0) {
      await supabase.from('goals').delete().eq('id', newGoal.id);
      
      const noSummariesResponse = `I couldn't create a reading plan because none of the recommended books are available yet. Please try searching for and generating summaries for these books first:\n\n${planData.books.map((b: any, i: number) => `${i + 1}. "${b.title}" by ${b.author}`).join('\n')}`;
      
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: noSummariesResponse }
      ]);

      return new Response(JSON.stringify({ response: noSummariesResponse, goalCreated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create concise response
    const allBooks = [...addedBooks, ...createdBooks];
    const bookList = allBooks
      .map((b: any, i: number) => `${i + 1}. "${b.title}" by ${b.author}`)
      .join('\n');

    const depthEmoji = depthLabel === 'deep' ? '📚' : depthLabel === 'medium' ? '📖' : '📕';
    const depthText = depthLabel === 'deep' ? 'comprehensive deep-dive' : depthLabel === 'medium' ? 'solid foundational' : 'quick overview';

    let aiResponse = `${depthEmoji} Perfect! I've created your ${depthText} reading plan: "${planData.goal_title}"

Here are your ${allBooks.length} books:
${bookList}

Head to your Dashboard to start reading!`;

    if (createdBooks.length > 0) {
      aiResponse += `\n\n💡 Note: ${createdBooks.length} book(s) will need summaries generated when you start reading them.`;
    }

    if (skippedBooks.length > 0) {
      const skippedList = skippedBooks.map((b: any) => `"${b.title}"`).join(', ');
      aiResponse += `\n\n⚠️ ${skippedBooks.length} book(s) couldn't be added: ${skippedList}`;
    }

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
