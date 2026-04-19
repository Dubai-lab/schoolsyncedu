// Supabase Edge Function: save-payment-card
//
// Called client-side immediately after a successful Stripe payment.
// Retrieves card details (last4, brand, expiry) from Stripe using the
// PaymentIntent ID, then upserts into saved_payment_tokens.
// This is a client-side complement to the webhook — whichever runs first wins.
//
// Required secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const { payment_intent_id, setup_intent_id, school_id } = await req.json() as {
      payment_intent_id?: string;
      setup_intent_id?: string;
      school_id?: string;
    };

    if ((!payment_intent_id && !setup_intent_id) || !school_id) {
      return new Response(JSON.stringify({ error: 'payment_intent_id or setup_intent_id, and school_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    // Retrieve the PaymentMethod from either a PaymentIntent or SetupIntent
    let pm: Stripe.PaymentMethod | null = null;

    if (payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id, {
        expand: ['payment_method'],
      });
      pm = pi.payment_method as Stripe.PaymentMethod | null;
    } else if (setup_intent_id) {
      const si = await stripe.setupIntents.retrieve(setup_intent_id, {
        expand: ['payment_method'],
      });
      pm = si.payment_method as Stripe.PaymentMethod | null;
    }

    const card = pm?.card;

    if (!card) {
      return new Response(JSON.stringify({ saved: false, reason: 'No card on payment method' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiry     = `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`;
    const holderName = pm?.billing_details?.name ?? null;
    const email      = pm?.billing_details?.email ?? null;

    // Clear existing defaults for this school then insert new default
    await adminClient
      .from('saved_payment_tokens')
      .update({ is_default: false })
      .eq('school_id', school_id);

    const { error: insertError } = await adminClient
      .from('saved_payment_tokens')
      .insert({
        school_id,
        provider:    'stripe',
        card_type:   card.brand,
        card_last4:  card.last4,
        card_name:   holderName,
        card_expiry: expiry,
        email,
        is_default:  true,
      });

    if (insertError) {
      console.error('save-payment-card insert error:', insertError.message);
      return new Response(JSON.stringify({ error: `Failed to save card: ${insertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Card saved for school ${school_id}: ${card.brand} ****${card.last4}`);

    return new Response(
      JSON.stringify({ saved: true, brand: card.brand, last4: card.last4 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('save-payment-card error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
