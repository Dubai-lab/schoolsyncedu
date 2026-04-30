// school-mtn-pay
// Initiates an MTN MoMo Collection "Request to Pay" using the SCHOOL's
// own MTN API credentials (not SchoolSync's platform credentials).
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db               = createClient(supabaseUrl, serviceRoleKey);

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

    // ── Fetch school's MTN credentials (service role bypasses RLS) ────────────
    const { data: cfg, error: cfgErr } = await db
      .from('school_payment_configs')
      .select('mtn_enabled, mtn_api_key, mtn_user_id, mtn_api_user_key, mtn_merchant_code')
      .eq('school_id', school_id)
      .maybeSingle();

    if (cfgErr || !cfg) return json({ error: 'Payment config not found' }, 404);
    if (!cfg.mtn_enabled) return json({ error: 'MTN payments not enabled for this school' }, 400);

    const subscriptionKey = cfg.mtn_api_key?.trim();      // Ocp-Apim-Subscription-Key header
    const userId          = cfg.mtn_user_id?.trim();      // Basic auth username
    const apiUserKey      = cfg.mtn_api_user_key?.trim(); // Basic auth password

    if (!subscriptionKey || !userId || !apiUserKey) {
      return json({ error: 'School MTN API credentials incomplete (need Subscription Key, API User ID, and API User Key)' }, 400);
    }

    // ── Get MTN access token ──────────────────────────────────────────────────
    const mtnBase = Deno.env.get('MTN_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com';
    const mtnEnv  = Deno.env.get('MTN_TARGET_ENVIRONMENT') ?? 'sandbox';

    const tokenRes = await fetch(`${mtnBase}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${userId}:${apiUserKey}`)}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('MTN token error:', err);
      return json({ error: 'Failed to authenticate with MTN' }, 502);
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // ── Build reference UUID ──────────────────────────────────────────────────
    const referenceId = crypto.randomUUID();

    // ── Normalize phone (strip leading 0, add country prefix 231 if needed) ──
    let phone = phone_number.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '231' + phone.slice(1);
    if (!phone.startsWith('231')) phone = '231' + phone;

    // ── Send Request to Pay ───────────────────────────────────────────────────
    const currency = mtnEnv === 'sandbox' ? 'EUR' : 'LRD';
    const payRes = await fetch(`${mtnBase}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': mtnEnv,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:      String(Math.round(amount_usd * 100) / 100),
        currency,
        externalId:  referenceId,
        payer:       { partyIdType: 'MSISDN', partyId: phone },
        payerMessage: 'School fee payment',
        payeeNote:    'SchoolSync fee payment',
      }),
    });

    if (!payRes.ok && payRes.status !== 202) {
      const err = await payRes.text();
      console.error('MTN requestToPay error:', err);
      return json({ error: 'MTN payment request failed' }, 502);
    }

    // ── Store in tracking table ───────────────────────────────────────────────
    const { error: insertErr } = await db.from('school_mobile_payments').insert({
      school_id,
      gateway: 'mtn',
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
    console.error('school-mtn-pay error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
