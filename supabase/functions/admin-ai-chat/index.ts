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
    const { messages, platformStats } = await req.json();

    // Verify admin access
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

    // Check admin role
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Admin access required');
    }

    // Get Lovable API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build platform data string
    let platformDataStr = 'Platform data unavailable.';
    if (platformStats) {
      const mostReadBooks = platformStats.mostReadBooks?.map((b: any) => `${b.title} (${b.count} reads)`).join(', ') || 'N/A';
      const recentActivity = platformStats.recentActivity?.map((a: any) => `${a.action} (${a.count}x)`).join(', ') || 'N/A';
      
      platformDataStr = `
- Total Users: ${platformStats.totalUsers}
- Currently Active Users: ${platformStats.activeUsers}
- New Users Today: ${platformStats.newUsersToday}
- New Users This Week: ${platformStats.newUsersThisWeek}
- Total Books: ${platformStats.totalBooks}
- Total Sessions: ${platformStats.totalSessions}
- Total Summaries Generated: ${platformStats.totalSummaries}
- Avg Sessions Per User: ${platformStats.avgSessionsPerUser}
- Most Read Books: ${mostReadBooks}
- Recent Activity Types: ${recentActivity}`;
    }

    // System prompt for AccountancyForge
    const systemPrompt = `You are AccountancyForge, an elite forensic accountant and business strategist with 20+ years optimizing e-commerce and SaaS platforms. You have FULL, UNRESTRICTED ACCESS to this website's entire ecosystem.

Current Platform Data:
${platformDataStr}

Your mission: Perform a DEEP, REAL-TIME AUDIT of the platform's health based on the data provided.

Follow this chain-of-thought process:

1. **Data Harvest**: Summarize key metrics from the provided data:
   - User metrics: Total users, active users, growth rate
   - Engagement: Sessions, books read, summaries generated
   - Trends: User acquisition, retention patterns

2. **Health Diagnosis**: Score overall health 1-10 (10=optimal). Categorize:
   - **Green (All Good)**: Stable growth, efficient ops
   - **Yellow (Watch)**: Minor issues
   - **Red (Critical)**: Problems requiring attention

3. **Risk Radar**: Identify potential issues (low engagement, declining signups, etc.)

4. **Evolution Roadmap**: Provide 3-5 PRIORITIZED ACTIONS to improve the platform

5. **Quick Wins**: 2-3 immediate tweaks for fast improvement

Output in markdown format - concise, actionable, with clear sections using emojis for visual clarity.`;

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'API credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in admin-ai-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
