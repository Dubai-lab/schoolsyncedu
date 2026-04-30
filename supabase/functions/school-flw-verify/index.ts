// school-flw-verify
// Verifies a Flutterwave transaction server-side using the school's own secret key.
// On success, automatically records the student fee or application fee payment.
//
// POST body: { transaction_id, tx_ref, school_id }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { transaction_id, tx_ref, school_id } = await req.json() as {
      transaction_id: number | string;
      tx_ref:         string;
      school_id:      string;
    };

    if (!transaction_id || !tx_ref || !school_id) {
      return json({ error: 'transaction_id, tx_ref, and school_id are required' }, 400);
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db             = createClient(supabaseUrl, serviceRoleKey);

    // ── Load tracking record ──────────────────────────────────────────────────
    const { data: rec } = await db
      .from('school_mobile_payments')
      .select('*')
      .eq('reference_id', tx_ref)
      .maybeSingle();

    if (!rec) return json({ error: 'Payment record not found' }, 404);
    if (rec.activated) return json({ status: 'successful', activated: true });

    // ── Fetch school's Flutterwave secret key ─────────────────────────────────
    const { data: cfg } = await db
      .from('school_payment_configs')
      .select('flw_secret_key, flw_currency')
      .eq('school_id', school_id)
      .maybeSingle();

    if (!cfg?.flw_secret_key) {
      return json({ error: 'School Flutterwave credentials not found' }, 400);
    }

    // ── Verify with Flutterwave API ───────────────────────────────────────────
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${cfg.flw_secret_key.trim()}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!verifyRes.ok) {
      await db.from('school_mobile_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('reference_id', tx_ref);
      return json({ status: 'failed', error: 'Flutterwave API verification failed' });
    }

    const verifyData = await verifyRes.json() as {
      status: string;
      data?: {
        status:   string;
        amount:   number;
        currency: string;
        tx_ref:   string;
      };
    };

    // ── Check response integrity ──────────────────────────────────────────────
    if (
      verifyData.status !== 'success'   ||
      verifyData.data?.status !== 'successful' ||
      verifyData.data?.tx_ref !== tx_ref
    ) {
      await db.from('school_mobile_payments')
        .update({ status: 'failed', gateway_response: verifyData, updated_at: new Date().toISOString() })
        .eq('reference_id', tx_ref);
      return json({ status: 'failed' });
    }

    // ── Update tracking to successful ─────────────────────────────────────────
    await db.from('school_mobile_payments')
      .update({ status: 'successful', gateway_response: verifyData, updated_at: new Date().toISOString() })
      .eq('reference_id', tx_ref);

    // ── Auto-record the fee payment ───────────────────────────────────────────
    let activated = false;

    if (rec.payment_type === 'student_fee' && rec.student_fee_id) {
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
          p_currency_charged: verifyData.data!.currency,
          p_payment_method:   'flw',
          p_gateway_ref:      String(transaction_id),
          p_recorded_by:      null,
        });
        if (!rpcErr) activated = true;
      }
    }

    if (rec.payment_type === 'application_fee' && rec.application_id) {
      const { error: rpcErr } = await db.rpc('mark_application_fee_paid_stripe', {
        p_application_id:    rec.application_id,
        p_payment_intent_id: String(transaction_id),
      });
      if (!rpcErr) activated = true;
    }

    if (activated) {
      await db.from('school_mobile_payments')
        .update({ activated: true })
        .eq('reference_id', tx_ref);
    }

    return json({ status: 'successful', activated });

  } catch (err) {
    console.error('school-flw-verify error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
