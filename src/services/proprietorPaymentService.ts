import { supabase } from '@/lib/supabase';

// ============================================================
// Liberia payment landscape:
//   - Flutterwave: cards only (Visa/MasterCard, USD) — does NOT
//     support LRD or Liberia mobile money.
//   - MTN MoMo: Lonestar Cell MTN "MoMo" — main local mobile money.
//   - Orange Money: second major Liberia mobile money provider.
// ============================================================

export interface PaymentConfig {
  id: string;
  school_id: string;
  // Flutterwave
  flw_public_key: string;
  flw_secret_key: string;
  flw_enabled: boolean;
  flw_methods: string[];
  flw_currency: string;
  // MTN MoMo
  mtn_merchant_code: string;
  mtn_api_key: string;
  mtn_enabled: boolean;
  // Orange Money
  orange_merchant_code: string;
  orange_api_key: string;
  orange_enabled: boolean;
  // Bank Transfer
  bank_enabled: boolean;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
  bank_routing_number: string;
  bank_swift_code: string;
  bank_instructions: string;
  // Branding
  payment_title: string;
  payment_logo: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentConfigPublic {
  flw_enabled: boolean;
  flw_public_key: string;
  flw_methods: string[];
  flw_currency: string;
  mtn_enabled: boolean;
  mtn_merchant_code: string;
  orange_enabled: boolean;
  orange_merchant_code: string;
  bank_enabled: boolean;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
  bank_routing_number: string;
  bank_swift_code: string;
  bank_instructions: string;
  payment_title: string;
  payment_logo: string;
}

// Flutterwave payment_options values (only the ones that actually work globally with USD)
export const FLW_METHODS = [
  {
    value: 'card',
    label: 'Debit / Credit Card',
    description: 'Visa, MasterCard, Verve — works globally including Liberia',
  },
  {
    value: 'banktransfer',
    label: 'Bank Transfer',
    description: 'Direct bank-to-bank transfer via Flutterwave',
  },
] as const;

export const proprietorPaymentService = {
  /** Fetch the full payment config (includes secret keys) — proprietor only */
  async getConfig(schoolId: string): Promise<PaymentConfig | null> {
    const { data, error } = await supabase
      .from('school_payment_configs')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error) throw error;
    return data as PaymentConfig | null;
  },

  /** Save (upsert) the full payment config */
  async saveConfig(schoolId: string, config: Omit<PaymentConfig,
    'id' | 'school_id' | 'created_at' | 'updated_at'>
  ): Promise<PaymentConfig> {
    const { data, error } = await supabase
      .from('school_payment_configs')
      .upsert(
        { school_id: schoolId, ...config, updated_at: new Date().toISOString() },
        { onConflict: 'school_id' },
      )
      .select()
      .single();
    if (error) throw error;
    return data as PaymentConfig;
  },

  /** Get public-safe config for the payment widget — any authenticated user */
  async getPublicConfig(schoolId: string): Promise<PaymentConfigPublic | null> {
    const { data, error } = await supabase.rpc('get_payment_config_public', {
      p_school_id: schoolId,
    });
    if (error) throw error;
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    return (Array.isArray(data) ? data[0] : data) as PaymentConfigPublic;
  },
};
