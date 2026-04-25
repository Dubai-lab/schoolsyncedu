// Supabase Edge Function: mtn-status
//
// Polls the status of an MTN MoMo payment request.
// Frontend calls this every 5 seconds after initiating a payment.
// When the status is SUCCESSFUL, this function activates the subscription
// by calling the record_subscription_payment RPC.
//
// Query params:
//   reference_id — UUID returned by mtn-pay
//
// Env secrets required:
//   MTN_SUBSCRIPTION_KEY   — primary subscription key
//   MTN_USER_ID            — API user ID
//   MTN_API_KEY            — API key
//   MTN_BASE_URL           — base URL
//   MTN_TARGET_ENVIRONMENT — sandbox | production
//   SUPABASE_URL           — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MtnTokenResponse {
  access_token: string;
}

interface MtnStatusResponse {
  amount:                 string;
  currency:               string;
  financialTransactionId: string;
  externalId:             string;
  payer:                  { partyIdType: string; partyId: string };
  status:                 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  reason?:                { code: string; message: string };
}

async function getMtnAccessToken(baseUrl: string, subscriptionKey: string, userId: string, apiKey: string): Promise<string> {
  const credentials = btoa(`${userId}:${apiKey}`);
  const res = await fetch(`${baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization':             `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type':              'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status})`);
  }
  const data = await res.json() as MtnTokenResponse;
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url         = new URL(req.url);
    const referenceId = url.searchParams.get('reference_id');

    if (!referenceId) {
      return new Response(JSON.stringify({ error: 'Missing reference_id query param' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Load env ──────────────────────────────────────────────────────────
    const subscriptionKey = Deno.env.get('MTN_SUBSCRIPTION_KEY');
    const userId          = Deno.env.get('MTN_USER_ID');
    const apiKey          = Deno.env.get('MTN_API_KEY');
    const baseUrl         = Deno.env.get('MTN_BASE_URL')           ?? 'https://sandbox.momodeveloper.mtn.com';
    const targetEnv       = Deno.env.get('MTN_TARGET_ENVIRONMENT')  ?? 'sandbox';

    if (!subscriptionKey || !userId || !apiKey) {
      return new Response(JSON.stringify({ error: 'MTN credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get access token ──────────────────────────────────────────────────
    const accessToken = await getMtnAccessToken(baseUrl, subscriptionKey, userId, apiKey);

    // ── Poll MTN for payment status ───────────────────────────────────────
    const statusRes = await fetch(`${baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
      method: 'GET',
      headers: {
        'Authorization':             `Bearer ${accessToken}`,
        'X-Target-Environment':      targetEnv,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!statusRes.ok) {
      const body = await statusRes.text();
      return new Response(JSON.stringify({ error: 'MTN status check failed', detail: body }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mtnData = await statusRes.json() as MtnStatusResponse;
    console.log(`MTN status for ${referenceId}: ${mtnData.status}`);

    // ── Connect to Supabase ───────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── Look up our DB record ─────────────────────────────────────────────
    const { data: payReq, error: fetchError } = await adminClient
      .from('mtn_payment_requests')
      .select('id, school_id, subscription_id, amount, currency, activated, status')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (fetchError) {
      console.error('DB fetch error:', fetchError.message);
    }

    // ── Update status in DB ───────────────────────────────────────────────
    if (payReq && payReq.status !== mtnData.status) {
      await adminClient
        .from('mtn_payment_requests')
        .update({ status: mtnData.status, mtn_response: mtnData, updated_at: new Date().toISOString() })
        .eq('reference_id', referenceId);
    }

    // ── Activate subscription on success ──────────────────────────────────
    let invoiceNumber: string | null = null;

    if (mtnData.status === 'SUCCESSFUL' && payReq && !payReq.activated) {
      console.log(`Activating subscription ${payReq.subscription_id} for school ${payReq.school_id}`);

      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'record_subscription_payment',
        {
          p_school_id:       payReq.school_id,
          p_subscription_id: payReq.subscription_id,
          p_amount_usd:      payReq.amount,
          p_gateway_ref:     referenceId,
          p_tx_ref:          referenceId,
          p_payment_method:  'mtn',
        }
      );

      if (rpcError) {
        console.error('record_subscription_payment RPC failed:', rpcError.message);
      } else {
        invoiceNumber = (rpcResult as { invoice_number?: string })?.invoice_number ?? null;

        // Mark activated so we don't double-activate
        await adminClient
          .from('mtn_payment_requests')
          .update({ activated: true, updated_at: new Date().toISOString() })
          .eq('reference_id', referenceId);

        console.log(`Subscription activated. Invoice: ${invoiceNumber}`);
      }
    }

    return new Response(
      JSON.stringify({
        status:         mtnData.status,
        amount:         mtnData.amount,
        currency:       mtnData.currency,
        reference_id:   referenceId,
        activated:      mtnData.status === 'SUCCESSFUL' ? (payReq?.activated || !!invoiceNumber) : false,
        invoice_number: invoiceNumber,
        reason:         mtnData.reason ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('mtn-status error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
