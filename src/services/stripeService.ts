import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/lib/supabase';

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string;

// Lazy-load Stripe.js (singleton — avoids loading it multiple times)
let stripePromise: ReturnType<typeof loadStripe> | null = null;
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLIC_KEY);
  }
  return stripePromise;
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface PaymentPageData {
  school: { id: string; name: string };
  owner: { email: string; name: string; phone: string };
  subscription: { id: string; status: string; plan_id: string };
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_usd: number;
    billing_cycle: string;
    student_limit: number;
    features: Record<string, boolean>;
    trial_days: number;
  };
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  txRef: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a unique, traceable transaction reference */
export function generateTxRef(schoolId: string): string {
  return `SCHOOLSYNC-${schoolId.slice(0, 8)}-${Date.now()}`;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch payment page data via SECURITY DEFINER RPC (works without auth) */
export async function fetchPaymentInfo(
  schoolId: string,
  email: string,
): Promise<PaymentPageData> {
  const { data, error } = await supabase.rpc('get_payment_info', {
    p_school_id: schoolId,
    p_email: email,
  });
  if (error) throw error;
  return data as unknown as PaymentPageData;
}

/** Create a PaymentIntent server-side via Supabase Edge Function.
 *  The Stripe secret key stays in Deno env and never touches the browser. */
export async function createPaymentIntent(opts: {
  amountUsd: number;
  schoolId: string;
  subscriptionId: string;
  planName: string;
  txRef: string;
}): Promise<CreatePaymentIntentResult> {
  const { data, error } = await supabase.functions.invoke(
    'create-stripe-payment-intent',
    {
      body: {
        amount_usd:      opts.amountUsd,
        school_id:       opts.schoolId,
        subscription_id: opts.subscriptionId,
        plan_name:       opts.planName,
        tx_ref:          opts.txRef,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data as CreatePaymentIntentResult;
}

/** Record a completed subscription payment via SECURITY DEFINER RPC */
export async function recordSubscriptionPayment(opts: {
  schoolId: string;
  subscriptionId: string;
  amountUsd: number;
  gatewayRef: string;
  txRef: string;
  paymentMethod?: 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
}): Promise<{ success: boolean; invoiceNumber: string }> {
  const { data, error } = await supabase.rpc('record_subscription_payment', {
    p_school_id:       opts.schoolId,
    p_subscription_id: opts.subscriptionId,
    p_amount_usd:      opts.amountUsd,
    p_gateway_ref:     opts.gatewayRef,
    p_tx_ref:          opts.txRef,
    p_payment_method:  opts.paymentMethod ?? 'visa',
  });
  if (error) throw new Error(error.message);
  const result = data as unknown as { success: boolean; invoice_number: string };
  return { success: result.success, invoiceNumber: result.invoice_number };
}

/** Save card details after payment (client-side complement to the webhook) */
export async function savePaymentCard(opts: {
  paymentIntentId: string;
  schoolId: string;
}): Promise<void> {
  // Non-throwing — card saving is best-effort, never block the payment flow
  try {
    await supabase.functions.invoke('save-payment-card', {
      body: { payment_intent_id: opts.paymentIntentId, school_id: opts.schoolId },
    });
  } catch {
    // Silently ignore — webhook will handle it as a fallback
  }
}

/** Create a SetupIntent to save a card without charging it */
export async function createSetupIntent(schoolId: string): Promise<{ clientSecret: string; setupIntentId: string }> {
  const { data, error } = await supabase.functions.invoke('create-setup-intent', {
    body: { school_id: schoolId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { clientSecret: string; setupIntentId: string };
}

/** Save card details from a SetupIntent after confirmation */
export async function saveCardFromSetupIntent(opts: {
  setupIntentId: string;
  schoolId: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('save-payment-card', {
    body: { setup_intent_id: opts.setupIntentId, school_id: opts.schoolId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

/** Upgrade / change plan with payment via SECURITY DEFINER RPC */
export async function upgradeSubscriptionPlan(opts: {
  schoolId: string;
  subscriptionId: string;
  newPlanId: string;
  amountUsd: number;
  gatewayRef: string;
  txRef: string;
  paymentMethod?: 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
}): Promise<{ success: boolean; invoiceNumber: string; newPlan: string }> {
  const { data, error } = await supabase.rpc('upgrade_subscription', {
    p_school_id:       opts.schoolId,
    p_subscription_id: opts.subscriptionId,
    p_new_plan_id:     opts.newPlanId,
    p_amount_usd:      opts.amountUsd,
    p_gateway_ref:     opts.gatewayRef,
    p_tx_ref:          opts.txRef,
    p_payment_method:  opts.paymentMethod ?? 'visa',
  });
  if (error) throw new Error(error.message);
  const result = data as unknown as {
    success: boolean;
    invoice_number: string;
    new_plan: string;
  };
  return {
    success:       result.success,
    invoiceNumber: result.invoice_number,
    newPlan:       result.new_plan,
  };
}
