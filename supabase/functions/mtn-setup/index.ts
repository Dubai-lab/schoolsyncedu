// Supabase Edge Function: mtn-setup
//
// ONE-TIME SETUP — run this once to create the MTN MoMo API user and API key.
// The returned user_id and api_key must be saved as Supabase Edge Function secrets:
//   MTN_USER_ID  = the user_id returned
//   MTN_API_KEY  = the api_key returned
//
// How to invoke (from terminal):
//   curl -X POST https://zjwgqosyffyisatfgmff.supabase.co/functions/v1/mtn-setup \
//     -H "Authorization: Bearer <your_setup_secret>" \
//     -H "Content-Type: application/json"
//
// Env secrets needed BEFORE running setup:
//   MTN_SUBSCRIPTION_KEY  — primary subscription key from momodeveloper.mtn.com
//   MTN_BASE_URL          — https://sandbox.momodeveloper.mtn.com (sandbox)
//   MTN_CALLBACK_HOST     — sandbox (for sandbox) or your domain (for production)
//   SETUP_SECRET          — a random string you choose to protect this endpoint
//
// After running, add these secrets:
//   MTN_USER_ID   — returned user_id
//   MTN_API_KEY   — returned api_key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randomUUID(): string {
  return crypto.randomUUID();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Guard: require setup secret ───────────────────────────────────────
    const setupSecret = Deno.env.get('SETUP_SECRET');
    const authHeader  = req.headers.get('Authorization') ?? '';
    const provided    = authHeader.replace('Bearer ', '').trim();

    if (!setupSecret || !provided || provided !== setupSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionKey = Deno.env.get('MTN_SUBSCRIPTION_KEY');
    const baseUrl         = Deno.env.get('MTN_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com';
    const callbackHost    = Deno.env.get('MTN_CALLBACK_HOST') ?? 'sandbox';

    if (!subscriptionKey) {
      return new Response(JSON.stringify({ error: 'MTN_SUBSCRIPTION_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Generate API user ID ────────────────────────────────────────────
    const userId = randomUUID();
    console.log('Creating MTN API user with ID:', userId);

    const createUserRes = await fetch(`${baseUrl}/v1_0/apiuser`, {
      method: 'POST',
      headers: {
        'X-Reference-Id': userId,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerCallbackHost: callbackHost }),
    });

    if (createUserRes.status !== 201) {
      const body = await createUserRes.text();
      return new Response(JSON.stringify({ error: 'Failed to create API user', detail: body, status: createUserRes.status }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('API user created successfully');

    // ── 2. Generate API key ────────────────────────────────────────────────
    const createKeyRes = await fetch(`${baseUrl}/v1_0/apiuser/${userId}/apikey`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
    });

    if (createKeyRes.status !== 201) {
      const body = await createKeyRes.text();
      return new Response(JSON.stringify({ error: 'Failed to create API key', detail: body, status: createKeyRes.status }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyData = await createKeyRes.json() as { apiKey: string };
    console.log('API key created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        api_key: keyData.apiKey,
        instructions: [
          'Save these as Supabase Edge Function secrets:',
          `  MTN_USER_ID = ${userId}`,
          `  MTN_API_KEY = ${keyData.apiKey}`,
          'Go to: Supabase Dashboard → Edge Functions → Secrets',
        ],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MTN setup error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
