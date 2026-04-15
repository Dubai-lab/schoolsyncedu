import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { School } from '@/types/school.types';
import type {
  Subscription,
  SubscriptionPlan,
  BillingInvoice,
  PlatformPayment,
  PaymentMethodRecord,
  SubscriptionHistory,
} from '@/types/report.types';

// ==================== SCHOOL PROFILE ====================

export const proprietorSchoolService = {
  /** Get the proprietor's school */
  async getSchool(schoolId: UUID) {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    if (error) throw error;
    return data as School;
  },

  /** Update school profile fields */
  async updateSchool(schoolId: UUID, payload: Partial<School>) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', schoolId)
      .select()
      .single();
    if (error) throw error;
    return data as School;
  },
};

// ==================== SUBSCRIPTION ====================

export const proprietorSubscriptionService = {
  /** Get school's current subscription with plan details */
  async getSubscription(schoolId: UUID) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as (Subscription & { plan: SubscriptionPlan }) | null;
  },

  /** Get subscription status history */
  async getHistory(subscriptionId: UUID) {
    const { data, error } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return data as SubscriptionHistory[];
  },

  /** Get available plans for upgrade/change */
  async getAvailablePlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('is_visible', true)
      .order('price_usd');
    if (error) throw error;
    return data as SubscriptionPlan[];
  },

  /** Change plan (upgrade/downgrade) */
  async changePlan(subscriptionId: UUID, newPlanId: UUID) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ plan_id: newPlanId })
      .eq('id', subscriptionId)
      .select()
      .single();
    if (error) throw error;
    return data as Subscription;
  },

  /** Toggle auto-renew */
  async toggleAutoRenew(subscriptionId: UUID, autoRenew: boolean) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ auto_renew: autoRenew })
      .eq('id', subscriptionId)
      .select()
      .single();
    if (error) throw error;
    return data as Subscription;
  },
};

// ==================== BILLING & INVOICES ====================

export const proprietorBillingService = {
  /** Get all invoices for the school */
  async getInvoices(schoolId: UUID) {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as BillingInvoice[];
  },

  /** Get all platform payments for the school */
  async getPayments(schoolId: UUID) {
    const { data, error } = await supabase
      .from('platform_payments')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as PlatformPayment[];
  },

  /** Get payment methods */
  async getPaymentMethods(schoolId: UUID) {
    const { data, error } = await supabase
      .from('payment_method_records')
      .select('*')
      .eq('school_id', schoolId)
      .order('is_default', { ascending: false });
    if (error) throw error;
    return data as PaymentMethodRecord[];
  },
};

// ==================== AUDIT TRAIL ====================

export const proprietorAuditService = {
  /** Get audit logs for the school */
  async getAuditLogs(schoolId: UUID, limit = 200) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as AuditLog[];
  },
};

// ==================== DASHBOARD STATS ====================

export const proprietorDashboardService = {
  async getStudentCount(schoolId: UUID) {
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId);
    if (error) throw error;
    return count ?? 0;
  },

  async getStaffCount(schoolId: UUID) {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .neq('role', 'student')
      .neq('role', 'parent');
    if (error) throw error;
    return count ?? 0;
  },

  async getSchoolRevenue(schoolId: UUID) {
    const { data, error } = await supabase
      .from('payments')
      .select('amount_usd')
      .eq('school_id', schoolId)
      .eq('status', 'success');
    if (error) throw error;
    return (data ?? []).reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);
  },

  async getRecentAuditLogs(schoolId: UUID, limit = 5) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as AuditLog[];
  },
};

// ==================== IT ADMIN MANAGEMENT ====================

export const proprietorITAdminService = {
  /** Get all IT admins for the school */
  async getITAdmins(schoolId: UUID) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('school_id', schoolId)
      .eq('role', 'it_admin')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as import('@/types/user.types').User[];
  },

  /** Create a new IT admin account for the school */
  async createITAdmin(schoolId: UUID, payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }) {
    // Single RPC creates auth user + public user in one atomic transaction
    const { data, error } = await supabase.rpc('create_school_user', {
      p_school_id: schoolId,
      p_email: payload.email,
      p_password: payload.password,
      p_first_name: payload.first_name,
      p_last_name: payload.last_name,
      p_phone: payload.phone ?? '',
      p_role: 'it_admin',
    });
    if (error) throw error;
    return data as unknown as import('@/types/user.types').User;
  },

  /** Update an IT admin's details */
  async updateITAdmin(userId: UUID, payload: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) {
    const updates: Record<string, unknown> = { ...payload };
    if (payload.first_name || payload.last_name) {
      const { data: current } = await supabase.from('users').select('first_name, last_name').eq('id', userId).single();
      updates.full_name = `${payload.first_name ?? current?.first_name} ${payload.last_name ?? current?.last_name}`;
    }
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as import('@/types/user.types').User;
  },

  /** Deactivate an IT admin */
  async deactivateITAdmin(userId: UUID) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as import('@/types/user.types').User;
  },

  /** Reactivate an IT admin */
  async activateITAdmin(userId: UUID) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as import('@/types/user.types').User;
  },

  /** Check if school has an active IT admin set up */
  async hasITAdmin(schoolId: UUID) {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'it_admin')
      .eq('is_active', true);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};

// ==================== LOCAL TYPES ====================

export interface AuditLog {
  id: string;
  school_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ==================== SAVED PAYMENT TOKENS ====================

export type SavedPaymentToken = {
  id: string;
  school_id: string;
  provider: string;
  card_last4: string | null;
  card_type: string | null;
  card_expiry: string | null;
  card_name: string | null;
  email: string | null;
  flw_token: string;
  is_default: boolean;
  created_at: string;
};

export const savedCardsService = {
  async list(schoolId: UUID): Promise<SavedPaymentToken[]> {
    // Use Edge Function (service role) to bypass RLS on saved_payment_tokens
    const { data, error } = await supabase.functions.invoke('get-saved-cards', {
      body: { school_id: schoolId },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    return (data ?? []) as SavedPaymentToken[];
  },

  async save(schoolId: UUID, token: Omit<SavedPaymentToken, 'id' | 'school_id' | 'created_at'>): Promise<SavedPaymentToken> {
    const { data, error } = await supabase
      .from('saved_payment_tokens')
      .insert({ ...token, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as SavedPaymentToken;
  },

  async setDefault(id: string, schoolId: UUID): Promise<void> {
    // Clear all defaults first
    await supabase
      .from('saved_payment_tokens')
      .update({ is_default: false })
      .eq('school_id', schoolId);
    // Set new default
    const { error } = await supabase
      .from('saved_payment_tokens')
      .update({ is_default: true })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('saved_payment_tokens')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async hasDefault(schoolId: UUID): Promise<boolean> {
    const { count } = await supabase
      .from('saved_payment_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_default', true);
    return (count ?? 0) > 0;
  },
};
