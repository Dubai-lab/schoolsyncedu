// Supabase Edge Function: create-stripe-payment-intent
//
// Creates a Stripe PaymentIntent server-side and returns the clientSecret
// to the browser. The secret key never touches the frontend.
//
// Required Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   — sk_test_... or sk_live_...
//
// Called by: src/services/stripeService.ts → createPaymentIntent()

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not set in Edge Function secrets');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

    const body = await req.json();
    const { amount_usd, school_id, subscription_id, plan_name, tx_ref } = body as {
      amount_usd: number;
      school_id: string;
      subscription_id: string;
      plan_name: string;
      tx_ref: string;
    };

    if (!amount_usd || !school_id || !subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount_usd, school_id, subscription_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_usd <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Stripe requires amount in the smallest currency unit (cents for USD)
    const amountCents = Math.round(amount_usd * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      description: `SchoolSync — ${plan_name || 'Subscription'} plan`,
      metadata: {
        school_id,
        subscription_id,
        plan_name: plan_name || '',
        tx_ref: tx_ref || '',
        platform: 'schoolsync',
      },
    });

    console.log(
      `PaymentIntent created: ${paymentIntent.id} for $${amount_usd} — school: ${school_id}`,
    );

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        txRef: tx_ref,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('create-stripe-payment-intent error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
