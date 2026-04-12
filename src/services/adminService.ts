import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { School } from '@/types/school.types';
import type { PlatformAdminUser, SystemLog } from '@/types/user.types';
import type {
  SubscriptionPlan,
  Subscription,
  Discount,
  BillingInvoice,
  ActiveSubscription,
  PlatformPayment,
} from '@/types/report.types';

// ==================== PLATFORM DASHBOARD ====================

export const adminDashboardService = {
  async getSchoolCount() {
    const { count, error } = await supabase
      .from('schools')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  },

  async getActiveSubscriptions() {
    const { data, error } = await supabase
      .from('vw_active_subscriptions')
      .select('*');
    if (error) throw error;
    return data as ActiveSubscription[];
  },

  async getRecentSystemLogs(limit = 10) {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as SystemLog[];
  },

  async getTotalRevenue() {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('amount_usd')
      .eq('status', 'paid');
    if (error) throw error;
    return (data ?? []).reduce((sum, i) => sum + i.amount_usd, 0);
  },

  async getDiscountCount() {
    const { count, error } = await supabase
      .from('discounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw error;
    return count ?? 0;
  },
};

// ==================== SCHOOL MANAGEMENT ====================

export const schoolManagementService = {
  async list() {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');
    if (error) throw error;
    return data as School[];
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as School;
  },

  async update(id: UUID, payload: Partial<School>) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as School;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== PRICING PLANS ====================

export const pricingPlanService = {
  async list() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_usd');
    if (error) throw error;
    return data as SubscriptionPlan[];
  },

  async create(payload: Omit<SubscriptionPlan, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as SubscriptionPlan;
  },

  async update(id: UUID, payload: Partial<SubscriptionPlan>) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SubscriptionPlan;
  },

  async toggleVisibility(id: UUID, isVisible: boolean) {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_visible: isVisible })
      .eq('id', id);
    if (error) throw error;
  },

  async toggleActive(id: UUID, isActive: boolean) {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== BILLING ====================

export const billingService = {
  async listSubscriptions() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Subscription[];
  },

  async listInvoices() {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as BillingInvoice[];
  },

  async updateInvoiceStatus(id: UUID, status: BillingInvoice['status']) {
    const update: Record<string, unknown> = { status };
    if (status === 'paid') update.paid_at = new Date().toISOString();
    const { error } = await supabase
      .from('billing_invoices')
      .update(update)
      .eq('id', id);
    if (error) throw error;
  },

  async voidInvoice(id: UUID) {
    const { error } = await supabase
      .from('billing_invoices')
      .update({ status: 'void' })
      .eq('id', id);
    if (error) throw error;
  },

  async listPlatformPayments() {
    const { data, error } = await supabase
      .from('platform_payments')
      .select('*, schools(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as (PlatformPayment & { schools?: { name: string } })[];
  },
};

// ==================== DISCOUNTS ====================

export const discountService = {
  async list() {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Discount[];
  },

  async create(payload: Omit<Discount, 'id' | 'current_uses' | 'created_at'>) {
    const { data, error } = await supabase
      .from('discounts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Discount;
  },

  async update(id: UUID, payload: Partial<Discount>) {
    const { data, error } = await supabase
      .from('discounts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Discount;
  },

  async toggleActive(id: UUID, isActive: boolean) {
    const { error } = await supabase
      .from('discounts')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('discounts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== SYSTEM HEALTH ====================

export const systemHealthService = {
  async getLogs(limit = 100) {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as SystemLog[];
  },

  async getFilteredLogs(filters: { level?: string; module?: string; limit?: number }) {
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100);
    if (filters.level) query = query.eq('log_level', filters.level);
    if (filters.module) query = query.eq('module', filters.module);
    const { data, error } = await query;
    if (error) throw error;
    return data as SystemLog[];
  },

  async getPlatformAdmins() {
    const { data, error } = await supabase
      .from('platform_admin_users')
      .select('*')
      .order('name');
    if (error) throw error;
    return data as PlatformAdminUser[];
  },
};
