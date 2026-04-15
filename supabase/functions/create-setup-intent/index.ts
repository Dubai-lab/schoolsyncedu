// Supabase Edge Function: create-setup-intent
// Creates a Stripe SetupIntent to save a card without charging it.
// Required secrets: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno&no-check';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Payment service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { school_id } = await req.json() as { school_id?: string };
    if (!school_id) {
      return new Response(JSON.stringify({ error: 'school_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const setupIntent = await stripe.setupIntents.create({
      usage: 'off_session',
      metadata: { school_id },
    });

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret, setupIntentId: setupIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
