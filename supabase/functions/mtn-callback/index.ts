// Supabase Edge Function: mtn-callback
//
// Receives MTN MoMo webhook callbacks for Collection (requestToPay) payments.
// MTN calls this URL when a payment status changes.
//
// Set this as the callback URL in your MTN developer account:
//   https://zjwgqosyffyisatfgmff.supabase.co/functions/v1/mtn-callback
//
// Or pass it as the X-Callback-Url header in mtn-pay (when you have a live cert).
// For sandbox, MTN may not send real callbacks — rely on mtn-status polling.
//
// Env secrets required:
//   SUPABASE_URL              — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MtnCallbackBody {
  financialTransactionId?: string;
  externalId?:             string;
  amount:                  string;
  currency:                string;
  payer:                   { partyIdType: string; partyId: string };
  status:                  'SUCCESSFUL' | 'FAILED' | 'PENDING';
  reason?:                 { code: string; message: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as MtnCallbackBody;
    console.log('MTN callback received:', JSON.stringify(body));

    // The externalId we set in mtn-pay is the reference_id (UUID)
    const referenceId = body.externalId;

    if (!referenceId) {
      console.warn('Callback missing externalId — cannot identify payment record');
      return new Response(JSON.stringify({ received: true, action: 'missing_reference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── Look up payment record ────────────────────────────────────────────
    const { data: payReq } = await adminClient
      .from('mtn_payment_requests')
      .select('id, school_id, subscription_id, amount, activated, status')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (!payReq) {
      console.warn('No payment record found for externalId:', referenceId);
      return new Response(JSON.stringify({ received: true, action: 'not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Update status ─────────────────────────────────────────────────────
    await adminClient
      .from('mtn_payment_requests')
      .update({ status: body.status, mtn_response: body, updated_at: new Date().toISOString() })
      .eq('reference_id', referenceId);

    // ── Activate subscription if successful and not yet activated ─────────
    if (body.status === 'SUCCESSFUL' && !payReq.activated) {
      console.log(`Callback: activating subscription ${payReq.subscription_id}`);

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
        console.error('RPC failed in callback:', rpcError.message);
        return new Response(JSON.stringify({ received: true, action: 'rpc_failed', error: rpcError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient
        .from('mtn_payment_requests')
        .update({ activated: true, updated_at: new Date().toISOString() })
        .eq('reference_id', referenceId);

      const invoiceNumber = (rpcResult as { invoice_number?: string })?.invoice_number;
      console.log(`Subscription activated via callback. Invoice: ${invoiceNumber}`);

      return new Response(
        JSON.stringify({ received: true, action: 'activated', invoice: invoiceNumber }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, action: 'recorded', status: body.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('mtn-callback error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
