// Supabase Edge Function: stripe-webhook
//
// Server-side safety net: if the browser-side RPC call fails after Stripe
// charges the customer, this webhook will still activate the subscription.
//
// Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL: https://<project>.supabase.co/functions/v1/stripe-webhook
//   Events to listen: payment_intent.succeeded
//
// Required Supabase Edge Function secrets:
//   STRIPE_SECRET_KEY        — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe webhook settings)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    // Read raw body for signature verification
    const body = await req.text();
    let event: Stripe.Event;

    if (webhookSecret) {
      const sig = req.headers.get('stripe-signature');
      if (!sig) {
        console.warn('Missing stripe-signature header');
        return new Response('Missing stripe-signature', { status: 400 });
      }
      try {
        event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response('Webhook signature verification failed', { status: 400 });
      }
    } else {
      console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting all webhooks');
      return new Response('Server configuration error', { status: 500 });
    }

    console.log('Stripe webhook received:', event.type, event.id);

    // Only handle successful payments
    if (event.type !== 'payment_intent.succeeded') {
      return new Response(
        JSON.stringify({ received: true, action: 'ignored', event: event.type }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const { school_id, subscription_id, tx_ref, plan_name, subdomain, subdomain_plan } = paymentIntent.metadata;
    const amountUsd = paymentIntent.amount / 100;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (!school_id) {
      console.error('Missing school_id in PaymentIntent metadata:', paymentIntent.id);
      return new Response(
        JSON.stringify({ received: true, action: 'missing_metadata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Subdomain add-on payment ──────────────────────────────────────────────
    // The browser already called activate_subdomain_addon. We send the receipt email
    // server-side here using the service role key — same reliable pattern as subscriptions.
    if (plan_name === 'subdomain-addon') {
      try {
        const [{ data: schoolRow }, { data: ownerRow }] = await Promise.all([
          adminClient.from('schools').select('name, subdomain, subdomain_paid_until').eq('id', school_id).maybeSingle(),
          adminClient.from('users').select('full_name, email').eq('school_id', school_id).eq('role', 'proprietor').maybeSingle(),
        ]);

        const ownerEmail = (ownerRow as any)?.email as string | undefined;
        const schoolName = (schoolRow as any)?.name as string | undefined;
        const resolvedSubdomain = subdomain || (schoolRow as any)?.subdomain || '';
        const dbPaidUntil = (schoolRow as any)?.subdomain_paid_until as string | undefined;
        const plan = subdomain_plan || 'monthly';

        // Use DB paid_until (set by activate_subdomain_addon) or compute from plan
        const computedPaidUntil = new Date(
          Date.now() + (plan === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
        ).toISOString();
        const paidUntil = dbPaidUntil || computedPaidUntil;

        if (ownerEmail && schoolName && resolvedSubdomain) {
          const notifyUrl = `${supabaseUrl}/functions/v1/process-subscription-notifications`;
          await fetch(notifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              trigger:     'subdomain_payment_confirmed',
              school_id,
              owner_email: ownerEmail,
              subdomain:   resolvedSubdomain,
              amount_usd:  amountUsd,
              plan,
              paid_until:  paidUntil,
            }),
          });
          console.log(`Subdomain receipt email dispatched to ${ownerEmail} for ${resolvedSubdomain}.schoolsyncedu.com`);
        } else {
          console.warn(`Subdomain receipt: missing owner/school data for school ${school_id}`, { ownerEmail, schoolName, resolvedSubdomain });
        }
      } catch (err) {
        console.warn('Subdomain receipt dispatch failed (non-fatal):', err instanceof Error ? err.message : err);
      }

      return new Response(
        JSON.stringify({ received: true, action: 'subdomain_payment_handled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Regular subscription payment ──────────────────────────────────────────
    if (!subscription_id) {
      console.error('Missing subscription_id in PaymentIntent metadata:', paymentIntent.id);
      return new Response(
        JSON.stringify({ received: true, action: 'missing_metadata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Idempotency — check if this payment_intent was already recorded
    const { data: existing } = await adminClient
      .from('platform_payments')
      .select('id')
      .eq('tx_ref', paymentIntent.id)
      .maybeSingle();

    if (existing) {
      console.log('Payment already recorded, skipping:', paymentIntent.id);
      return new Response(
        JSON.stringify({ received: true, action: 'already_recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'record_subscription_payment',
      {
        p_school_id:       school_id,
        p_subscription_id: subscription_id,
        p_amount_usd:      amountUsd,
        p_gateway_ref:     paymentIntent.id,
        p_tx_ref:          tx_ref || paymentIntent.id,
        p_payment_method:  'visa',
      },
    );

    if (rpcError) {
      console.error('record_subscription_payment RPC failed:', rpcError.message);
      return new Response(
        JSON.stringify({ received: true, action: 'rpc_failed', error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rpcData   = rpcResult as Record<string, unknown>;
    const invoice   = rpcData?.invoice_number as string | undefined;
    const expiresAt = rpcData?.expires_at     as string | undefined;
    console.log(`Subscription activated — school: ${school_id}, invoice: ${invoice}`);

    // ── Send billing confirmation email ───────────────────────────────────────
    try {
      // Look up school name and owner details
      const [{ data: schoolRow }, { data: ownerRow }] = await Promise.all([
        adminClient.from('schools').select('name').eq('id', school_id).maybeSingle(),
        adminClient.from('users').select('full_name, email').eq('school_id', school_id).eq('role', 'proprietor').maybeSingle(),
      ]);

      const schoolName = (schoolRow as { name: string } | null)?.name ?? 'Your School';
      const ownerEmail = (ownerRow as { email: string; full_name: string } | null)?.email;

      if (ownerEmail) {
        // Fetch updated expires_at from subscription (RPC may not return it)
        let newExpiresAt: string | null = expiresAt ?? null;
        if (!newExpiresAt) {
          const { data: subRow } = await adminClient
            .from('subscriptions')
            .select('expires_at')
            .eq('id', subscription_id)
            .maybeSingle();
          newExpiresAt = (subRow as { expires_at: string } | null)?.expires_at ?? null;
        }

        const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-subscription-notifications`;
        const notifyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${notifyKey}`,
          },
          body: JSON.stringify({
            trigger:        'payment_confirmed',
            school_id,
            school_name:    schoolName,
            owner_email:    ownerEmail,
            plan_name:      paymentIntent.metadata.plan_name || 'Subscription',
            amount_usd:     amountUsd,
            invoice_number: invoice ?? 'N/A',
            expires_at:     newExpiresAt,
          }),
        });

        console.log(`Billing email dispatched to ${ownerEmail} for school ${school_id}`);
      } else {
        console.warn(`No proprietor email found for school ${school_id} — skipping billing email`);
      }
    } catch (emailErr) {
      // Non-fatal — subscription is still activated
      console.warn('Billing email dispatch failed:', emailErr instanceof Error ? emailErr.message : emailErr);
    }

    // ── Save card details so the dashboard "no saved card" banner goes away ──
    try {
      const pmId = typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id;

      if (pmId) {
        const pm = await stripe.paymentMethods.retrieve(pmId);
        const card = pm.card;

        if (card) {
          const expiry = `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`;
          const holderName = pm.billing_details?.name ?? null;
          const email      = pm.billing_details?.email ?? null;

          // Clear existing defaults for this school, then insert new default
          await adminClient
            .from('saved_payment_tokens')
            .update({ is_default: false })
            .eq('school_id', school_id);

          const { error: insertErr } = await adminClient
            .from('saved_payment_tokens')
            .insert({
              school_id,
              provider:   'stripe',
              card_type:  card.brand,
              card_last4: card.last4,
              card_name:  holderName,
              card_expiry: expiry,
              email,
              is_default: true,
            });

          if (insertErr) {
            console.error('stripe-webhook card save error:', insertErr.message);
          }

          console.log(`Saved card for school ${school_id}: ${card.brand} ****${card.last4}`);
        }
      }
    } catch (cardErr) {
      // Non-fatal — subscription is already activated, just log it
      console.warn('Could not save card details:', cardErr instanceof Error ? cardErr.message : cardErr);
    }

    return new Response(
      JSON.stringify({ received: true, action: 'activated', invoice }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-webhook error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
