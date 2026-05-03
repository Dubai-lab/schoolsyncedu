import { supabase } from '@/lib/supabase';

export interface SubdomainPricing {
  monthly_price_usd: number;
  yearly_discount_percent: number;
}

export interface SubdomainPayment {
  id: string;
  school_id: string;
  amount_usd: number;
  plan: 'monthly' | 'yearly';
  gateway_ref: string | null;
  paid_at: string;
  paid_until: string;
}

const DEFAULT_PRICING: SubdomainPricing = {
  monthly_price_usd: 1.00,
  yearly_discount_percent: 20,
};

export const subdomainAddonService = {
  async getPricing(): Promise<SubdomainPricing> {
    const { data, error } = await supabase.rpc('get_subdomain_addon_pricing');
    if (error) return DEFAULT_PRICING;
    return (data as SubdomainPricing) ?? DEFAULT_PRICING;
  },

  async setPricing(monthlyPriceUsd: number, yearlyDiscountPercent: number): Promise<void> {
    const { error } = await supabase.rpc('set_subdomain_addon_pricing', {
      p_monthly_price_usd: monthlyPriceUsd,
      p_yearly_discount_percent: yearlyDiscountPercent,
    });
    if (error) throw error;
  },

  async getPaymentHistory(schoolId: string): Promise<SubdomainPayment[]> {
    const { data, error } = await supabase.rpc('get_subdomain_payment_history', { p_school_id: schoolId });
    if (error) throw error;
    return (data ?? []) as SubdomainPayment[];
  },

  async reactivate(schoolId: string): Promise<{ success: boolean; paid_until?: string; error?: string }> {
    const { data, error } = await supabase.rpc('reactivate_subdomain_addon', { p_school_id: schoolId });
    if (error) throw error;
    return data as { success: boolean; paid_until?: string; error?: string };
  },

  /** Calculates yearly price from monthly price and discount percent */
  calcYearlyPrice(monthlyPrice: number, discountPercent: number): number {
    return +(monthlyPrice * 12 * (1 - discountPercent / 100)).toFixed(2);
  },
};
