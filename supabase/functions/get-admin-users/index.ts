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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser } } = await supabase.auth.getUser(token);
    
    if (!callerUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: callerUser.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all users from auth.users with their profiles and preferences
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    // Get user preferences for credits
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('user_id, daily_credits, last_credit_reset');

    // Get active sessions
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('user_id, last_seen_at, is_active')
      .eq('is_active', true);

    // Get reading sessions count per user
    const { data: readingSessions } = await supabase
      .from('reading_sessions')
      .select('user_id')
      .not('completed_at', 'is', null);

    // Get total session count per user
    const { data: allSessions } = await supabase
      .from('user_sessions')
      .select('user_id');

    // Get user roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    // Combine data
    const users = authUsers.users.map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id);
      const userPrefs = preferences?.find(p => p.user_id === authUser.id);
      const activeSession = sessions?.find(s => s.user_id === authUser.id);
      const userReadingSessions = readingSessions?.filter(r => r.user_id === authUser.id);
      const userAllSessions = allSessions?.filter(s => s.user_id === authUser.id);
      const userRole = userRoles?.find(r => r.user_id === authUser.id);

      return {
        id: profile?.id || authUser.id,
        user_id: authUser.id,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
        username: profile?.username || authUser.user_metadata?.user_name || null,
        email: authUser.email || 'Unknown',
        created_at: profile?.created_at || authUser.created_at,
        is_online: activeSession?.is_active || false,
        last_seen: activeSession?.last_seen_at || null,
        total_sessions: userAllSessions?.length || 0,
        books_read: userReadingSessions?.length || 0,
        credits: userPrefs?.daily_credits ?? 3,
        last_credit_reset: userPrefs?.last_credit_reset || null,
        is_admin: userRole?.role === 'admin'
      };
    });

    return new Response(
      JSON.stringify({ success: true, users }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-admin-users:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
