import { supabase } from '@/lib/supabase';

const FLW_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY as string;

export interface FlutterwavePaymentConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: {
    email: string;
    name: string;
    phone_number: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
  meta: Record<string, string>;
}

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

/** Fetch payment page data via SECURITY DEFINER RPC (works without auth) */
export async function fetchPaymentInfo(schoolId: string, email: string): Promise<PaymentPageData> {
  const { data, error } = await supabase.rpc('get_payment_info', {
    p_school_id: schoolId,
    p_email: email,
  });
  if (error) throw error;
  return data as unknown as PaymentPageData;
}

/** Build the config object consumed by Flutterwave's React SDK */
export function buildFlutterwaveConfig(opts: {
  amount: number;
  email: string;
  name: string;
  phone: string;
  planName: string;
  schoolId: string;
  subscriptionId: string;
}): FlutterwavePaymentConfig {
  const txRef = `SCHOOLSYNC-${opts.schoolId.slice(0, 8)}-${Date.now()}`;
  return {
    public_key: FLW_PUBLIC_KEY,
    tx_ref: txRef,
    amount: opts.amount,
    currency: 'USD',
    payment_options: 'card,banktransfer,mobilemoney',
    customer: {
      email: opts.email,
      name: opts.name,
      phone_number: opts.phone,
    },
    customizations: {
      title: 'SchoolSync Subscription',
      description: `Payment for ${opts.planName} plan`,
      logo: `${window.location.origin}/SchoolSync_logo.png`,
    },
    meta: {
      school_id: opts.schoolId,
      subscription_id: opts.subscriptionId,
      tx_ref: txRef,
    },
  };
}

/** Record payment via SECURITY DEFINER RPC (works without auth) */
export async function recordSubscriptionPayment(opts: {
  schoolId: string;
  subscriptionId: string;
  amountUsd: number;
  gatewayRef: string;
  txRef: string;
  paymentMethod: 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
}): Promise<{ success: boolean; invoiceNumber: string }> {
  const { data, error } = await supabase.rpc('record_subscription_payment', {
    p_school_id: opts.schoolId,
    p_subscription_id: opts.subscriptionId,
    p_amount_usd: opts.amountUsd,
    p_gateway_ref: opts.gatewayRef,
    p_tx_ref: opts.txRef,
    p_payment_method: opts.paymentMethod,
  });
  if (error) throw error;
  const result = data as unknown as { success: boolean; invoice_number: string };
  return { success: result.success, invoiceNumber: result.invoice_number };
}

/** Upgrade/change subscription plan with payment via SECURITY DEFINER RPC */
export async function upgradeSubscriptionPlan(opts: {
  schoolId: string;
  subscriptionId: string;
  newPlanId: string;
  amountUsd: number;
  gatewayRef: string;
  txRef: string;
  paymentMethod: 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
}): Promise<{ success: boolean; invoiceNumber: string; newPlan: string }> {
  const { data, error } = await supabase.rpc('upgrade_subscription', {
    p_school_id: opts.schoolId,
    p_subscription_id: opts.subscriptionId,
    p_new_plan_id: opts.newPlanId,
    p_amount_usd: opts.amountUsd,
    p_gateway_ref: opts.gatewayRef,
    p_tx_ref: opts.txRef,
    p_payment_method: opts.paymentMethod,
  });
  if (error) throw error;
  const result = data as unknown as { success: boolean; invoice_number: string; new_plan: string };
  return { success: result.success, invoiceNumber: result.invoice_number, newPlan: result.new_plan };
}

/** Derive a simplified payment method from the Flutterwave response */
export function mapFlutterwaveMethod(flwMethod?: string): 'visa' | 'mtn' | 'orange' | 'bank' | 'manual' {
  if (!flwMethod) return 'visa';
  const m = flwMethod.toLowerCase();
  if (m.includes('card')) return 'visa';
  if (m.includes('mtn') || m.includes('momo')) return 'mtn';
  if (m.includes('orange')) return 'orange';
  if (m.includes('bank') || m.includes('transfer')) return 'bank';
  return 'visa';
}
