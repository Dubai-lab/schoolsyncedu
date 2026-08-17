// Supabase Edge Function: school-stripe-verify
//
// Asks Stripe whether a payment actually happened, then records it.
//
// Called by: MyFees.tsx and SchoolFees.tsx, after stripe.confirmCardPayment().
//
// WHY THIS EXISTS
//   Both pages used to confirm the card in the browser and then call
//   record_fee_payment directly, telling the database how much had been paid.
//   The server never asked Stripe anything. Skipping the card step and calling
//   the RPC with any amount cleared the balance just as well — and cleared exam
//   clearance at the kiosk with it.
//
//   Flutterwave, MTN and Orange already verify server-side in their own
//   functions. This is the missing Stripe equivalent, so every gateway now
//   proves the payment before it is written down.
//
// WHAT IT TRUSTS
//   Only the PaymentIntent id. Everything else — school, student, fee, amount,
//   currency — is read back from Stripe: the school, student and fee come from
//   the metadata that school-stripe-payment set when it created the intent, and
//   the amount is what Stripe says was captured. Nothing the browser claims is
//   used, so there is nothing for a caller to inflate.
//
// Env secrets needed (Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// No STRIPE_* env vars — each school provides its own keys.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { school_id, payment_intent_id } = await req.json() as {
      school_id?: string;
      payment_intent_id?: string;
    };

    if (!school_id || !payment_intent_id) {
      return json({ error: 'Missing required fields: school_id, payment_intent_id' }, 400);
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── The school's own Stripe key ───────────────────────────────────────────
    const { data: config, error: configError } = await db
      .from('school_payment_configs')
      .select('stripe_secret_key, stripe_enabled')
      .eq('school_id', school_id)
      .maybeSingle();

    if (configError || !config?.stripe_secret_key) {
      return json({ error: 'Card payments are not configured for this school' }, 400);
    }
    if (config.stripe_enabled === false) {
      return json({ error: 'Card payments are disabled for this school' }, 400);
    }

    const stripe = new Stripe(config.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ── Ask Stripe what really happened ───────────────────────────────────────
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (intent.status !== 'succeeded') {
      return json({ error: `Payment has not completed (status: ${intent.status})` }, 402);
    }

    // The intent was created by school-stripe-payment, which stamped the
    // school, student and fee into its metadata. Reading them back means a
    // caller cannot point a genuine payment at a different fee.
    const meta = (intent.metadata ?? {}) as Record<string, string>;

    if (meta.school_id !== school_id) {
      return json({ error: 'Payment does not belong to this school' }, 403);
    }

    const studentFeeId  = meta.student_fee_id;
    const studentId     = meta.student_id;
    const applicationId = meta.application_id;

    // ── Application fee ───────────────────────────────────────────────────────
    // The public application pages called mark_application_fee_paid_stripe
    // straight from the browser as anon, with no check that the payment had
    // happened — any application could be marked paid with an invented
    // reference. Same treatment: Stripe is asked first.
    if (applicationId) {
      const { error: appError } = await db.rpc('mark_application_fee_paid_stripe', {
        p_application_id:    applicationId,
        p_payment_intent_id: intent.id,
      });
      if (appError) {
        console.error('school-stripe-verify application error:', appError.message);
        return json({ error: appError.message }, 500);
      }
      return json({ success: true, application_id: applicationId });
    }

    if (!studentFeeId || !studentId) {
      return json({ error: 'This payment is not a student fee or application fee payment' }, 400);
    }

    // amount_received is in the smallest currency unit, and is what Stripe
    // actually took — not what the browser asked for.
    const currency = (intent.currency ?? 'usd').toUpperCase();
    const amount   = (intent.amount_received ?? intent.amount ?? 0) / 100;

    if (amount <= 0) {
      return json({ error: 'Payment captured no amount' }, 402);
    }

    const { data: result, error: rpcError } = await db.rpc('record_fee_payment', {
      p_school_id:        school_id,
      p_student_id:       studentId,
      p_student_fee_id:   studentFeeId,
      p_amount_usd:       currency === 'USD' ? amount : 0,
      p_amount_lrd:       currency === 'USD' ? 0 : amount,
      p_currency_charged: currency,
      p_payment_method:   'visa',
      // The RPC treats a repeated reference as the same payment, so a retry
      // after a dropped connection cannot credit the fee twice.
      p_gateway_ref:      intent.id,
      p_recorded_by:      null,
    });

    if (rpcError) {
      console.error('school-stripe-verify record error:', rpcError.message);
      return json({ error: rpcError.message }, 500);
    }

    return json({ success: true, result });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('school-stripe-verify error:', message);
    return json({ error: message }, 500);
  }
});
