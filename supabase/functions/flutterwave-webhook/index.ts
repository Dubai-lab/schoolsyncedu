// Supabase Edge Function: flutterwave-webhook
//
// Handles Flutterwave webhook callbacks for subscription payments.
// This is the server-side safety net — if the browser-side RPC call
// fails after Flutterwave charges the customer, this webhook will
// still activate the subscription.
//
// Flutterwave Dashboard → Settings → Webhooks → set URL to:
//   https://<project>.supabase.co/functions/v1/flutterwave-webhook
//
// Set a Webhook Secret Hash in Flutterwave and add it to Supabase
// Edge Function secrets as: FLUTTERWAVE_WEBHOOK_SECRET
//
// Env secrets needed (Supabase Dashboard → Edge Functions → Secrets):
//   FLUTTERWAVE_SECRET_KEY   — your Flutterwave secret key (sk_...)
//   FLUTTERWAVE_WEBHOOK_SECRET — the webhook hash secret
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify Flutterwave webhook signature ────────────────
    const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('verif-hash');
      if (!signature || signature !== webhookSecret) {
        console.warn('Webhook signature mismatch');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const body = await req.json();
    const { event, data } = body as {
      event: string;
      data: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        status: string;
        amount: number;
        currency: string;
        payment_type: string;
        meta: {
          school_id?: string;
          subscription_id?: string;
        };
      };
    };

    console.log('Flutterwave webhook received:', event, data?.tx_ref);

    // ── 2. Only handle successful charge events ────────────────
    if (event !== 'charge.completed' || data?.status !== 'successful') {
      return new Response(JSON.stringify({ received: true, action: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Extract meta from tx_ref or data.meta ───────────────
    // tx_ref format: SCHOOLSYNC-<school_id_8chars>-<timestamp>
    const txRef = data.tx_ref;
    let schoolId = data.meta?.school_id;
    const subscriptionId = data.meta?.subscription_id;

    if (!schoolId && txRef?.startsWith('SCHOOLSYNC-')) {
      // Best-effort extraction from tx_ref when meta isn't set
      // We'll look up by tx_ref in platform_payments
    }

    // ── 4. Verify with Flutterwave API ─────────────────────────
    const flwSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    if (!flwSecretKey) {
      console.error('FLUTTERWAVE_SECRET_KEY not set');
      return new Response('Server configuration error', { status: 500 });
    }

    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${data.id}/verify`, {
      headers: { Authorization: `Bearer ${flwSecretKey}` },
    });
    const verification = await verifyRes.json();

    if (verification.status !== 'success' || verification.data?.status !== 'successful') {
      console.warn('Payment verification failed for tx_ref:', txRef);
      return new Response(JSON.stringify({ received: true, action: 'verification_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verifiedAmount = verification.data.amount;
    const verifiedCurrency = verification.data.currency;

    console.log(`Verified payment: ${verifiedAmount} ${verifiedCurrency} for tx_ref: ${txRef}`);

    // ── 5. Connect to Supabase with service_role ───────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── 6. Check if already recorded (idempotency) ─────────────
    const { data: existing } = await adminClient
      .from('platform_payments')
      .select('id')
      .eq('tx_ref', txRef)
      .maybeSingle();

    if (existing) {
      console.log('Payment already recorded for tx_ref:', txRef);
      return new Response(JSON.stringify({ received: true, action: 'already_recorded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Look up school_id and subscription_id if not in meta ─
    if (!schoolId || !subscriptionId) {
      // Try to find from subscriptions via the owner's email in customer info
      const customerEmail = verification.data?.customer?.email;
      if (customerEmail) {
        const { data: userRow } = await adminClient
          .from('users')
          .select('school_id')
          .eq('email', customerEmail.toLowerCase())
          .maybeSingle();
        if (userRow?.school_id) schoolId = userRow.school_id;
      }
    }

    if (!schoolId || !subscriptionId) {
      console.error('Cannot determine school_id or subscription_id from webhook data:', {
        txRef, meta: data.meta, email: verification.data?.customer?.email,
      });
      return new Response(JSON.stringify({ received: true, action: 'missing_ids' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 8. Map payment method ─────────────────────────────────
    const paymentType = (data.payment_type || '').toLowerCase();
    let paymentMethod: string = 'visa';
    if (paymentType.includes('card')) paymentMethod = 'visa';
    else if (paymentType.includes('mtn') || paymentType.includes('momo')) paymentMethod = 'mtn';
    else if (paymentType.includes('orange')) paymentMethod = 'orange';
    else if (paymentType.includes('bank') || paymentType.includes('transfer')) paymentMethod = 'bank';

    // ── 9. Call RPC to activate subscription ──────────────────
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'record_subscription_payment',
      {
        p_school_id: schoolId,
        p_subscription_id: subscriptionId,
        p_amount_usd: verifiedAmount,
        p_gateway_ref: String(data.id),
        p_tx_ref: txRef,
        p_payment_method: paymentMethod,
      }
    );

    if (rpcError) {
      console.error('RPC record_subscription_payment failed:', rpcError.message);
      return new Response(JSON.stringify({ received: true, action: 'rpc_failed', error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Subscription activated via webhook for school:', schoolId, 'invoice:', (rpcResult as any)?.invoice_number);

    return new Response(
      JSON.stringify({ received: true, action: 'activated', invoice: (rpcResult as any)?.invoice_number }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
