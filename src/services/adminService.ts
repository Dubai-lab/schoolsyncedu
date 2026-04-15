import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { School } from '@/types/school.types';
import type { PlatformAdminUser, SystemLog } from '@/types/user.types';
import type {
  SubscriptionPlan,
  Subscription,
  SubscriptionWithSchool,
  Discount,
  BillingInvoice,
  ActiveSubscription,
  PlatformPayment,
  EnterpriseInquiry,
} from '@/types/report.types';

// ==================== SYSTEM EVENT LOGGING ====================

/** Log a platform-level event to system_logs via the log_system_event RPC. Fire-and-forget — never throws. */
export async function logSystemEvent(
  level: 'info' | 'warn' | 'error' | 'debug',
  module: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('log_system_event', {
      p_level: level,
      p_module: module,
      p_message: message,
      p_metadata: metadata ?? null,
    });
  } catch {
    // Logging must never break the calling action
  }
}

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

  async getSubscriptionStatusCounts() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status');
    if (error) throw error;
    const counts = { trial: 0, active: 0, grace: 0, suspended: 0, expired: 0 };
    for (const row of (data ?? [])) {
      const s = row.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  },

  async getEnterpriseInquiryCount() {
    const { count, error } = await supabase
      .from('enterprise_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    if (error) throw error;
    return count ?? 0;
  },

  async getNotificationStats() {
    // Emails sent in the last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { count, error } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', since.toISOString());
    if (error) throw error;
    return { sent_last_30_days: count ?? 0 };
  },

  async getRecentNotifications(limit = 8) {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('id, event_type, recipient_email, sent_at, metadata, schools(name)')
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
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
    // Use Edge Function so the delete runs with service role (bypasses RLS)
    // and also removes Supabase Auth accounts for all school users.
    const { data, error } = await supabase.functions.invoke('delete-school', {
      body: { school_id: id },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
  },

  /** Toggle a school online or offline manually */
  async toggleOnline(id: UUID, isOnline: boolean) {
    const { data, error } = await supabase
      .from('schools')
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as School;
  },

  /** Suspend a school (set offline + update subscription status) */
  async suspendSchool(schoolId: UUID, reason = 'Manually suspended by admin') {
    const { error } = await supabase.rpc('suspend_school', {
      p_school_id: schoolId,
      p_reason: reason,
    });
    if (error) throw error;
  },

  /** Reactivate a school + grant grace days */
  async reactivateSchool(schoolId: UUID, graceDays = 7) {
    const { error } = await supabase.rpc('reactivate_school', {
      p_school_id: schoolId,
      p_grace_days: graceDays,
    });
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
    logSystemEvent('info', 'plans', `Pricing plan created: ${payload.name}`, { plan_id: (data as SubscriptionPlan).id });
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
    logSystemEvent('info', 'plans', `Pricing plan updated: ${id}`, { plan_id: id, changes: Object.keys(payload) });
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

  /** List subscriptions joined with school name and plan name */
  async listSubscriptionsWithDetails() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, schools(name), subscription_plans(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        ...(r as unknown as Subscription),
        school_name: (r.schools as { name: string } | null)?.name ?? 'Unknown',
        plan_name: (r.subscription_plans as { name: string } | null)?.name ?? 'Unknown',
      };
    }) as SubscriptionWithSchool[];
  },

  /** Extend subscription grace period without fully reactivating */
  async extendGracePeriod(subscriptionId: UUID, days: number) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        grace_days_remaining: days,
        status: 'grace',
      })
      .eq('id', subscriptionId);
    if (error) throw error;
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

  /** Validate a coupon code for a given plan. Returns the discount if valid, null otherwise. */
  async validateCoupon(couponCode: string, planId: UUID): Promise<Discount | null> {
    const today = new Date().toISOString().split('T')[0];
    // Note: applicable_plans is JSONB — PostgREST array operators are unreliable
    // for JSONB. Fetch candidates by code + active + date, then filter in code.
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('coupon_code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`);
    if (error || !data || data.length === 0) return null;

    // Check applicable_plans in code:
    // empty array / null = applies to all plans; otherwise must include planId
    const match = data.find((row) => {
      const plans = row.applicable_plans as string[] | null;
      return !plans || plans.length === 0 || plans.includes(planId);
    });
    if (!match) return null;

    const d = match as Discount;
    if (d.max_uses !== null && d.current_uses >= d.max_uses) return null;
    return d;
  },

  /** Increment uses after applying a discount (fetch current value then +1) */
  async incrementCouponUses(id: UUID) {
    const { data } = await supabase.from('discounts').select('current_uses').eq('id', id).single();
    if (!data) return;
    await supabase
      .from('discounts')
      .update({ current_uses: (data.current_uses as number) + 1 })
      .eq('id', id);
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

// ==================== ENTERPRISE INQUIRIES ====================

export const enterpriseService = {
  /** List all inquiries (super admin only) */
  async list(): Promise<EnterpriseInquiry[]> {
    const { data, error } = await supabase
      .from('enterprise_inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as EnterpriseInquiry[];
  },

  /** Update status / notes on an inquiry */
  async updateStatus(id: string, status: EnterpriseInquiry['status'], notes?: string): Promise<void> {
    const payload: Partial<EnterpriseInquiry> = { status };
    if (notes !== undefined) payload.notes = notes;
    const { error } = await supabase.from('enterprise_inquiries').update(payload).eq('id', id);
    if (error) throw error;
  },

  /** Submit a new inquiry (public, no auth required) */
  async submitInquiry(payload: {
    school_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    student_count?: string;
    modules_needed?: string;
    message?: string;
  }): Promise<void> {
    const { data, error } = await supabase.functions.invoke('send-enterprise-inquiry', {
      body: payload,
    });
    if (error) throw new Error((error as { message?: string }).message || 'Failed to submit inquiry');
    if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
  },
};

// ==================== PLATFORM SOCIAL LINKS ====================

export interface PlatformSocialLinks {
  social_x:         string | null;
  social_facebook:  string | null;
  social_youtube:   string | null;
  social_instagram: string | null;
  social_tiktok:    string | null;
}

export const socialLinksService = {
  async get(): Promise<PlatformSocialLinks> {
    const { data, error } = await supabase
      .from('platform_config')
      .select('social_x, social_facebook, social_youtube, social_instagram, social_tiktok')
      .eq('id', 'singleton')
      .single();
    if (error) throw error;
    return (data ?? {
      social_x: null, social_facebook: null, social_youtube: null,
      social_instagram: null, social_tiktok: null,
    }) as PlatformSocialLinks;
  },

  async update(links: Partial<PlatformSocialLinks>): Promise<void> {
    const { error } = await supabase
      .from('platform_config')
      .update({ ...links, updated_at: new Date().toISOString() })
      .eq('id', 'singleton');
    if (error) throw error;
  },
};
