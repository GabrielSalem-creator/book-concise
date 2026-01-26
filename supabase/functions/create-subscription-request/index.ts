import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Pricing configuration
const PRICING = {
  monthly: { amount: 9.99, currency: 'USD', days: 30 },
  yearly: { amount: 79.99, currency: 'USD', days: 365 },
};

// Generate unique reference code
function generateReferenceCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'SUB-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
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

    const { planType } = await req.json();

    if (!planType || !PRICING[planType as keyof typeof PRICING]) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type. Use "monthly" or "yearly"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = PRICING[planType as keyof typeof PRICING];

    // Check if user already has a pending request
    const { data: existingRequest } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({
          message: 'You already have a pending subscription request',
          referenceCode: existingRequest.reference_code,
          planType: existingRequest.plan_type,
          amount: existingRequest.amount,
          currency: existingRequest.currency,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference code
    let referenceCode = generateReferenceCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('subscription_requests')
        .select('id')
        .eq('reference_code', referenceCode)
        .maybeSingle();
      
      if (!existing) break;
      referenceCode = generateReferenceCode();
      attempts++;
    }

    // Create subscription request
    const { data: newRequest, error: insertError } = await supabase
      .from('subscription_requests')
      .insert({
        user_id: user.id,
        reference_code: referenceCode,
        plan_type: planType,
        amount: plan.amount,
        currency: plan.currency,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created subscription request ${referenceCode} for user ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        referenceCode,
        planType,
        amount: plan.amount,
        currency: plan.currency,
        paymentDetails: {
          iban: 'LB49005699840103500663680002',
          swift: 'AUDBLBBX',
          bankName: 'Audi Bank',
          accountHolder: 'ReadWise Premium',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
