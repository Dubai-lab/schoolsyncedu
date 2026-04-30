// school-flw-pay
// Generates a unique tx_ref for a Flutterwave inline checkout and records a
// pending tracking entry. The actual popup is opened client-side using the
// school's own flw_public_key (already exposed via get_payment_config_public).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { school_id, payment_type, student_fee_id, application_id, amount_usd } =
      await req.json() as {
        school_id:       string;
        payment_type:    string;
        student_fee_id?: string;
        application_id?: string;
        amount_usd:      number;
      };

    if (!school_id || !payment_type || !amount_usd) {
      return json({ error: 'school_id, payment_type, and amount_usd are required' }, 400);
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db             = createClient(supabaseUrl, serviceRoleKey);

    // Verify school has Flutterwave enabled with credentials
    const { data: cfg } = await db
      .from('school_payment_configs')
      .select('flw_enabled, flw_public_key, flw_secret_key')
      .eq('school_id', school_id)
      .maybeSingle();

    if (!cfg?.flw_enabled) {
      return json({ error: 'Flutterwave is not enabled for this school' }, 400);
    }
    if (!cfg.flw_public_key || !cfg.flw_secret_key) {
      return json({ error: 'Flutterwave API keys are not configured for this school' }, 400);
    }

    // Generate unique transaction reference
    const tx_ref = crypto.randomUUID();

    // Insert pending tracking record
    const { error: insertErr } = await db.from('school_mobile_payments').insert({
      school_id,
      gateway:        'flw',
      payment_type,
      student_fee_id: student_fee_id ?? null,
      application_id: application_id ?? null,
      reference_id:   tx_ref,
      amount_usd,
      phone_number:   '',
      status:         'pending',
    });

    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ tx_ref });

  } catch (err) {
    console.error('school-flw-pay error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
