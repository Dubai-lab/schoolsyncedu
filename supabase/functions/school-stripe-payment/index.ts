// Supabase Edge Function: school-stripe-payment
//
// Creates a Stripe PaymentIntent using the SCHOOL'S OWN Stripe keys.
// This is completely separate from the platform's Stripe integration —
// the school's payments go directly into the school's Stripe account.
//
// Called by: SchoolFees.tsx (student fee payment page)
//
// Flow:
//   1. Receive: school_id, student_id, student_fee_id, amount_usd
//   2. Look up school's stripe_secret_key from school_payment_configs
//      (uses service_role to bypass RLS — secret key is never sent to client)
//   3. Create a Stripe PaymentIntent with the school's key
//   4. Return: { clientSecret, paymentIntentId }
//
// Env secrets needed (Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// No STRIPE_* env vars needed here — each school provides their own keys.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Verify caller is authenticated ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser(jwt);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      school_id,
      student_id,
      student_fee_id,
      application_id,
      amount_usd,
    } = await req.json() as {
      school_id:       string;
      student_id?:     string;
      student_fee_id?: string;
      application_id?: string;
      amount_usd:      number;
    };

    // Must have school_id, amount, and either student_fee_id or application_id
    if (!school_id || !amount_usd || (!student_fee_id && !application_id)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: school_id, amount_usd, and either student_fee_id or application_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (amount_usd <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch the school's Stripe secret key (service role bypasses RLS) ──────
    const { data: config, error: configError } = await supabaseAuth
      .from('school_payment_configs')
      .select('stripe_secret_key, stripe_enabled, stripe_currency')
      .eq('school_id', school_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Payment configuration not found for this school' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.stripe_enabled) {
      return new Response(JSON.stringify({ error: 'Stripe payments are not enabled for this school' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.stripe_secret_key) {
      return new Response(JSON.stringify({ error: 'Stripe is not configured for this school' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Create Stripe PaymentIntent using the school's secret key ─────────────
    const stripe = new Stripe(config.stripe_secret_key, {
      apiVersion: '2024-06-20',
    });

    const currency = (config.stripe_currency || 'usd').toLowerCase();

    // Stripe amounts are in the smallest currency unit (cents for USD)
    const amountCents = Math.round(amount_usd * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency,
      metadata: {
        school_id,
        ...(student_id     && { student_id }),
        ...(student_fee_id && { student_fee_id }),
        ...(application_id && { application_id }),
        source: application_id ? 'schoolsync_application_fee' : 'schoolsync_fee_payment',
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret:    paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('school-stripe-payment error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
