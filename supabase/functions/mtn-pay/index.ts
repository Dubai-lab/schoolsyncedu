// Supabase Edge Function: mtn-pay
//
// Initiates an MTN MoMo Collections "Request to Pay".
// Called by the frontend when a user clicks "Pay with MTN MoMo".
//
// Flow:
//   1. Validate request body (school_id, subscription_id, amount, currency, phone)
//   2. Get MTN access token (Basic auth with user_id:api_key)
//   3. Generate a unique reference_id (UUID v4)
//   4. Call MTN requestToPay API
//   5. Store request in mtn_payment_requests table
//   6. Return reference_id to frontend for polling
//
// Env secrets required (Supabase Dashboard → Edge Functions → Secrets):
//   MTN_SUBSCRIPTION_KEY   — primary subscription key from momodeveloper.mtn.com
//   MTN_USER_ID            — API user ID created via mtn-setup
//   MTN_API_KEY            — API key created via mtn-setup
//   MTN_BASE_URL           — https://sandbox.momodeveloper.mtn.com (sandbox)
//   MTN_TARGET_ENVIRONMENT — sandbox (sandbox) | production (live)
//   MTN_CURRENCY           — EUR (sandbox) | LRD (production)
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
  token_type:   string;
  expires_in:   number;
}

async function getMtnAccessToken(baseUrl: string, subscriptionKey: string, userId: string, apiKey: string): Promise<string> {
  const credentials = btoa(`${userId}:${apiKey}`);
  const res = await fetch(`${baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MTN token request failed (${res.status}): ${body}`);
  }

  const data = await res.json() as MtnTokenResponse;
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Parse and validate body ───────────────────────────────────────────
    const {
      school_id,
      subscription_id,
      amount,
      phone,
    } = await req.json() as {
      school_id:       string;
      subscription_id: string;
      amount:          number;
      phone:           string;
    };

    if (!school_id || !subscription_id || !amount || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields: school_id, subscription_id, amount, phone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitise phone: digits only
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Load MTN config from env ──────────────────────────────────────────
    const subscriptionKey = Deno.env.get('MTN_SUBSCRIPTION_KEY');
    const userId          = Deno.env.get('MTN_USER_ID');
    const apiKey          = Deno.env.get('MTN_API_KEY');
    const baseUrl         = Deno.env.get('MTN_BASE_URL')          ?? 'https://sandbox.momodeveloper.mtn.com';
    const targetEnv       = Deno.env.get('MTN_TARGET_ENVIRONMENT') ?? 'sandbox';
    const currency        = Deno.env.get('MTN_CURRENCY')           ?? 'EUR';

    if (!subscriptionKey || !userId || !apiKey) {
      return new Response(JSON.stringify({ error: 'MTN credentials not configured. Run mtn-setup first.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get access token ──────────────────────────────────────────────────
    const accessToken = await getMtnAccessToken(baseUrl, subscriptionKey, userId, apiKey);

    // ── Generate unique reference ID ──────────────────────────────────────
    const referenceId = crypto.randomUUID();

    // ── Call MTN requestToPay ─────────────────────────────────────────────
    const mtnRes = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization':             `Bearer ${accessToken}`,
        'X-Reference-Id':            referenceId,
        'X-Target-Environment':      targetEnv,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type':              'application/json',
      },
      body: JSON.stringify({
        amount:       String(amount),
        currency:     currency,
        externalId:   referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId:     cleanPhone,
        },
        payerMessage: 'SchoolSync Subscription Payment',
        payeeNote:    `Subscription for school ${school_id.slice(0, 8)}`,
      }),
    });

    if (mtnRes.status !== 202) {
      const body = await mtnRes.text();
      return new Response(JSON.stringify({ error: 'MTN requestToPay failed', detail: body, mtn_status: mtnRes.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`MTN requestToPay accepted. referenceId: ${referenceId}, phone: ${cleanPhone}, amount: ${amount} ${currency}`);

    // ── Store request in DB ───────────────────────────────────────────────
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient  = createClient(supabaseUrl, serviceKey);

    const { error: dbError } = await adminClient
      .from('mtn_payment_requests')
      .insert({
        school_id,
        subscription_id,
        reference_id:  referenceId,
        amount,
        currency,
        phone_number:  cleanPhone,
        status:        'PENDING',
      });

    if (dbError) {
      console.error('DB insert failed:', dbError.message);
      // Don't fail the payment — the callback/status endpoint will still work
    }

    return new Response(
      JSON.stringify({
        success:      true,
        reference_id: referenceId,
        message:      'Payment request sent. Please approve on your MTN MoMo phone.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('mtn-pay error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
