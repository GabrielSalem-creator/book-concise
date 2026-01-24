import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Days for each plan type
const PLAN_DAYS = {
  monthly: 30,
  yearly: 365,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get admin user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, action } = await req.json();

    if (!requestId || !action) {
      return new Response(
        JSON.stringify({ error: 'requestId and action required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "approve" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the subscription request
    const { data: request, error: fetchError } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return new Response(
        JSON.stringify({ error: 'Subscription request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'This request has already been processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();

    if (action === 'approve') {
      // Calculate expiry date based on plan type
      const days = PLAN_DAYS[request.plan_type as keyof typeof PLAN_DAYS] || 30;
      const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Update subscription request
      const { error: updateRequestError } = await supabase
        .from('subscription_requests')
        .update({
          status: 'approved',
          approved_at: now.toISOString(),
          approved_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', requestId);

      if (updateRequestError) {
        console.error('Error updating request:', updateRequestError);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update user preferences to premium
      const { data: existingPrefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', request.user_id)
        .maybeSingle();

      if (existingPrefs) {
        const { error: updatePrefsError } = await supabase
          .from('user_preferences')
          .update({
            is_premium: true,
            premium_expires_at: expiresAt.toISOString(),
          })
          .eq('user_id', request.user_id);

        if (updatePrefsError) {
          console.error('Error updating preferences:', updatePrefsError);
        }
      } else {
        const { error: insertPrefsError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: request.user_id,
            is_premium: true,
            premium_expires_at: expiresAt.toISOString(),
            daily_credits: 2,
            themes: [],
          });

        if (insertPrefsError) {
          console.error('Error inserting preferences:', insertPrefsError);
        }
      }

      console.log(`Approved subscription ${request.reference_code} for user ${request.user_id}, expires ${expiresAt.toISOString()}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription approved successfully',
          expiresAt: expiresAt.toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Reject the request
      const { error: updateError } = await supabase
        .from('subscription_requests')
        .update({
          status: 'rejected',
          approved_at: now.toISOString(),
          approved_by: user.id,
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error rejecting request:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to reject subscription request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Rejected subscription ${request.reference_code}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription rejected',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
