// school-mtn-status
// Polls MTN for the status of a school-level payment request.
// On SUCCESSFUL: calls record_fee_payment or mark_application_fee_paid_stripe
// RPC to automatically update the student's balance.
//
// Accepts: POST body { reference_id } OR query param ?reference_id=

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = new URL(req.url);
    let referenceId = url.searchParams.get('reference_id');
    if (!referenceId && req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { reference_id?: string };
      referenceId = body.reference_id ?? null;
    }
    if (!referenceId) return json({ error: 'reference_id required' }, 400);

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db             = createClient(supabaseUrl, serviceRoleKey);

    // ── Load tracking record ──────────────────────────────────────────────────
    const { data: rec, error: recErr } = await db
      .from('school_mobile_payments')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (recErr || !rec) return json({ error: 'Payment record not found' }, 404);
    if (rec.activated)  return json({ status: 'successful', activated: true });

    // ── Fetch school's MTN credentials ────────────────────────────────────────
    const { data: cfg } = await db
      .from('school_payment_configs')
      .select('mtn_api_key, mtn_user_id')
      .eq('school_id', rec.school_id)
      .maybeSingle();

    if (!cfg?.mtn_api_key || !cfg?.mtn_user_id) {
      return json({ error: 'School MTN credentials missing' }, 400);
    }

    const subscriptionKey = cfg.mtn_api_key.trim();
    const userId          = cfg.mtn_user_id.trim();
    const mtnBase         = Deno.env.get('MTN_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com';
    const mtnEnv          = Deno.env.get('MTN_TARGET_ENVIRONMENT') ?? 'sandbox';

    // ── Get access token ──────────────────────────────────────────────────────
    const tokenRes = await fetch(`${mtnBase}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${userId}:${subscriptionKey}`)}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!tokenRes.ok) return json({ status: rec.status, error: 'Token refresh failed' });
    const { access_token } = await tokenRes.json() as { access_token: string };

    // ── Poll MTN for status ───────────────────────────────────────────────────
    const statusRes = await fetch(`${mtnBase}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Target-Environment': mtnEnv,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!statusRes.ok) return json({ status: rec.status });
    const mtnData = await statusRes.json() as { status: string; reason?: unknown };
    const mtnStatus = mtnData.status?.toUpperCase();

    // ── Update DB ─────────────────────────────────────────────────────────────
    const dbStatus = mtnStatus === 'SUCCESSFUL' ? 'successful'
                   : mtnStatus === 'FAILED'     ? 'failed'
                   : 'pending';

    await db.from('school_mobile_payments')
      .update({ status: dbStatus, gateway_response: mtnData, updated_at: new Date().toISOString() })
      .eq('reference_id', referenceId);

    // ── Auto-activate fee on success ──────────────────────────────────────────
    if (dbStatus === 'successful') {
      let activated = false;

      if (rec.payment_type === 'student_fee' && rec.student_fee_id) {
        // Look up student_id for the fee
        const { data: feeRow } = await db
          .from('student_fees')
          .select('student_id')
          .eq('id', rec.student_fee_id)
          .maybeSingle();

        if (feeRow?.student_id) {
          const { error: rpcErr } = await db.rpc('record_fee_payment', {
            p_school_id:        rec.school_id,
            p_student_id:       feeRow.student_id,
            p_student_fee_id:   rec.student_fee_id,
            p_amount_usd:       rec.amount_usd,
            p_amount_lrd:       0,
            p_currency_charged: 'USD',
            p_payment_method:   'mtn',
            p_gateway_ref:      referenceId,
            p_recorded_by:      null,
          });
          if (!rpcErr) activated = true;
        }
      }

      if (rec.payment_type === 'application_fee' && rec.application_id) {
        const { error: rpcErr } = await db.rpc('mark_application_fee_paid_stripe', {
          p_application_id:    rec.application_id,
          p_payment_intent_id: referenceId,
        });
        if (!rpcErr) activated = true;
      }

      if (activated) {
        await db.from('school_mobile_payments')
          .update({ activated: true })
          .eq('reference_id', referenceId);
      }

      return json({ status: 'successful', activated });
    }

    return json({ status: dbStatus, activated: false });

  } catch (err) {
    console.error('school-mtn-status error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
