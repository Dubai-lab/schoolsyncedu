// school-orange-pay
// Initiates an Orange Money payment request using the SCHOOL's own
// Orange Money API credentials.
//
// Orange Money Liberia uses a REST Collection API similar to MTN MoMo.
// Credentials stored: orange_api_key (subscription/client key),
//                     orange_user_id (API user ID)
//
// Body: { school_id, payment_type, student_fee_id?, application_id?,
//         amount_usd, phone_number }
// Returns: { reference_id, status: 'pending' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Orange Money base URL — configurable via env var for different environments
const ORANGE_BASE    = Deno.env.get('ORANGE_BASE_URL')    ?? 'https://api.orange.com/orange-money-webpay/lr/v1';
const ORANGE_ENV     = Deno.env.get('ORANGE_ENVIRONMENT') ?? 'sandbox';
const ORANGE_CURRENCY = Deno.env.get('ORANGE_CURRENCY')   ?? 'LRD';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db             = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { school_id, payment_type, student_fee_id, application_id, amount_usd, phone_number } = body as {
      school_id: string;
      payment_type: 'student_fee' | 'application_fee';
      student_fee_id?: string;
      application_id?: string;
      amount_usd: number;
      phone_number: string;
    };

    if (!school_id || !payment_type || !amount_usd || !phone_number) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // ── Fetch school's Orange credentials ─────────────────────────────────────
    const { data: cfg, error: cfgErr } = await db
      .from('school_payment_configs')
      .select('orange_enabled, orange_api_key, orange_user_id, orange_merchant_code')
      .eq('school_id', school_id)
      .maybeSingle();

    if (cfgErr || !cfg)      return json({ error: 'Payment config not found' }, 404);
    if (!cfg.orange_enabled) return json({ error: 'Orange Money not enabled for this school' }, 400);

    const clientKey = cfg.orange_api_key?.trim();
    const userId    = cfg.orange_user_id?.trim();

    if (!clientKey || !userId) {
      return json({ error: 'School Orange Money API credentials incomplete' }, 400);
    }

    // ── Get Orange access token ───────────────────────────────────────────────
    const tokenRes = await fetch(`${ORANGE_BASE}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${userId}:${clientKey}`)}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Orange token error:', err);
      return json({ error: 'Failed to authenticate with Orange Money' }, 502);
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // ── Build reference ───────────────────────────────────────────────────────
    const referenceId = crypto.randomUUID();

    // ── Normalize phone ───────────────────────────────────────────────────────
    let phone = phone_number.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '231' + phone.slice(1);
    if (!phone.startsWith('231')) phone = '231' + phone;

    // ── Initiate Orange Money request to pay ─────────────────────────────────
    const payRes = await fetch(`${ORANGE_BASE}/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${access_token}`,
        'X-Reference-Id': referenceId,
        'X-Environment':  ORANGE_ENV,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        amount:      String(Math.round(amount_usd * 100) / 100),
        currency:    ORANGE_CURRENCY,
        externalId:  referenceId,
        payer:       { partyIdType: 'MSISDN', partyId: phone },
        payerMessage: 'School fee payment',
        payeeNote:    'SchoolSync fee payment',
      }),
    });

    if (!payRes.ok && payRes.status !== 202) {
      const err = await payRes.text();
      console.error('Orange requestToPay error:', err);
      return json({ error: 'Orange Money payment request failed' }, 502);
    }

    // ── Store in tracking table ───────────────────────────────────────────────
    const { error: insertErr } = await db.from('school_mobile_payments').insert({
      school_id,
      gateway: 'orange',
      payment_type,
      student_fee_id:  student_fee_id ?? null,
      application_id:  application_id ?? null,
      reference_id:    referenceId,
      amount_usd,
      phone_number:    phone,
      status:          'pending',
    });

    if (insertErr) {
      console.error('Insert error:', insertErr.message);
      return json({ error: 'Failed to record payment request' }, 500);
    }

    return json({ reference_id: referenceId, status: 'pending' });

  } catch (err) {
    console.error('school-orange-pay error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
