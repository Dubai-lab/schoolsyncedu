import { supabase } from '@/lib/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface MtnPayRequest {
  school_id:       string;
  subscription_id: string;
  amount:          number;
  phone:           string;
}

export interface MtnPayResponse {
  success:      boolean;
  reference_id: string;
  message:      string;
}

export interface MtnStatusResponse {
  status:         'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount:         string;
  currency:       string;
  reference_id:   string;
  activated:      boolean;
  invoice_number: string | null;
  reason:         { code: string; message: string } | null;
  debug?:         { mtn_raw: unknown };
}

/** Initiate an MTN MoMo payment request */
export async function mtnInitiatePayment(payload: MtnPayRequest): Promise<MtnPayResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${FUNCTIONS_URL}/mtn-pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? json.detail ?? 'Failed to initiate MTN payment');
  }
  return json as MtnPayResponse;
}

/** Poll MTN payment status by reference_id */
export async function mtnGetStatus(referenceId: string): Promise<MtnStatusResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const url = `${FUNCTIONS_URL}/mtn-status?reference_id=${encodeURIComponent(referenceId)}`;
  const res = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to check MTN payment status');
  }
  return json as MtnStatusResponse;
}
