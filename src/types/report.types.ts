// ============================================================
// REPORT TYPES — Library, communication, subscriptions, platform
// ============================================================

import type { UUID, Timestamp, ISODate, SchoolScopedEntity, SmsStatus, DiscountType } from './common.types';
import type { PaymentMethod, PaymentStatus } from './fee.types';

// ==================== COMMUNICATION ====================

/** announcements table */
export interface Announcement extends SchoolScopedEntity {
  title: string;
  content: string;
  created_by: UUID;
  recipient_group: string;
  is_published: boolean;
  published_at: Timestamp | null;
  expires_at: Timestamp | null;
}

/** messages table */
export interface Message extends SchoolScopedEntity {
  sender_id: UUID;
  recipient_id: UUID;
  subject: string;
  body: string;
  is_read: boolean;
  read_at: Timestamp | null;
}

/** notifications table */
export interface Notification extends SchoolScopedEntity {
  user_id: UUID;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: Timestamp | null;
  data: Record<string, unknown> | null;
}

/** notification_preferences table */
export interface NotificationPreference {
  id: UUID;
  user_id: UUID;
  channel: 'email' | 'sms' | 'in_app' | 'push';
  notification_type: string;
  is_enabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  created_at: Timestamp;
}

/** sms_logs table */
export interface SmsLog extends SchoolScopedEntity {
  recipient_phone: string;
  message_content: string;
  gateway: string;
  gateway_ref: string | null;
  status: SmsStatus;
}

// ==================== GUIDANCE & COUNSELING ====================

/** counseling_sessions table */
export interface CounselingSession {
  id: UUID;
  student_id: UUID;
  counselor_id: UUID;
  session_date: ISODate;
  session_time: string;
  duration_minutes: number;
  notes: string | null;
  issues_discussed: string[];
  action_items: Record<string, unknown>[];
  created_at: Timestamp;
}

/** student_incidents table */
export interface StudentIncident {
  id: UUID;
  student_id: UUID;
  incident_date: ISODate;
  incident_type: string;
  description: string;
  severity: string;
  reported_by: UUID;
  created_at: Timestamp;
}

/** incident_actions table */
export interface IncidentAction {
  id: UUID;
  incident_id: UUID;
  action_type: string;
  description: string | null;
  approved_by: UUID | null;
  action_date: ISODate;
}

/** parent_meetings table */
export interface ParentMeeting {
  id: UUID;
  student_id: UUID;
  parent_id: UUID;
  staff_member_id: UUID;
  meeting_date: ISODate;
  meeting_time: string;
  topics: string | null;
  notes: string | null;
  action_items: Record<string, unknown>[] | null;
  created_at: Timestamp;
}

// ==================== SUBSCRIPTIONS & BILLING ====================

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'suspended' | 'archived' | 'cancelled' | 'premier';
export type BillingCycle = 'monthly' | 'yearly' | 'custom' | 'lifetime';

/** subscription_plans table */
export interface SubscriptionPlan {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  price_usd: number;
  billing_cycle: BillingCycle;
  student_limit: number;
  features: Record<string, boolean>;
  is_active: boolean;
  is_visible: boolean;
  /** When true: no fixed price — shown as a "Contact Sales" enterprise tier */
  is_enterprise: boolean;
  trial_days: number;
  grace_days: number;
  /** Text shown on the CTA button on the public pricing page (e.g. "Start Free Trial", "Get Basic") */
  cta_button_text: string;
  /** Discount percentage shown when billing cycle toggled to Yearly (0–100) */
  yearly_discount_percent: number;
  /** Per-plan notification schedule config (day arrays for each reminder type) */
  notification_config: Record<string, unknown> | null;
  created_at: Timestamp;
}

/** enterprise_inquiries table */
export interface EnterpriseInquiry {
  id: UUID;
  school_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  student_count: string | null;
  modules_needed: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'closed';
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** subscriptions table */
export interface Subscription {
  id: UUID;
  school_id: UUID;
  plan_id: UUID;
  status: SubscriptionStatus;
  started_at: Timestamp;
  expires_at: Timestamp;
  cancelled_at: Timestamp | null;
  payment_method: PaymentMethod | null;
  auto_renew: boolean;
  discount_id: UUID | null;
  grace_days_remaining: number;
  suspended_at: Timestamp | null;
  suspension_reason: string | null;
  created_at: Timestamp;
}

/** Subscription joined with school name for admin views */
export interface SubscriptionWithSchool extends Subscription {
  school_name: string;
  plan_name: string;
  owner_email?: string;
  owner_name?: string;
}

/** discounts table */
export interface Discount {
  id: UUID;
  name: string;
  type: DiscountType;
  value: number;
  coupon_code: string | null;
  start_date: ISODate | null;
  end_date: ISODate | null;
  applicable_plans: UUID[];
  max_uses: number | null;
  current_uses: number;
  stackable: boolean;
  is_active: boolean;
  created_at: Timestamp;
}

/** billing_invoices table */
export interface BillingInvoice {
  id: UUID;
  school_id: UUID;
  subscription_id: UUID;
  invoice_number: string;
  amount_usd: number;
  amount_lrd: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  due_date: ISODate;
  paid_at: Timestamp | null;
  pdf_url: string | null;
  created_at: Timestamp;
}

/** payment_method_records table */
export interface PaymentMethodRecord extends SchoolScopedEntity {
  method_type: PaymentMethod;
  last_four: string | null;
  is_default: boolean;
}

/** platform_payments table */
export interface PlatformPayment extends SchoolScopedEntity {
  subscription_id: UUID;
  amount_usd: number;
  amount_lrd: number;
  currency_charged: 'USD' | 'LRD';
  payment_method: PaymentMethod;
  gateway_ref: string | null;
  status: PaymentStatus;
  recorded_by: UUID | null;
}

/** subscription_history table */
export interface SubscriptionHistory {
  id: UUID;
  subscription_id: UUID;
  previous_status: SubscriptionStatus;
  new_status: SubscriptionStatus;
  reason: string | null;
  changed_by: UUID | null;
  changed_at: Timestamp;
}

/** platform_notifications_log table (migration 006) */
export interface PlatformNotificationLog {
  id: UUID;
  school_id: UUID | null;
  type: string;
  channel: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  sent_at: Timestamp | null;
  created_at: Timestamp;
}

// ==================== VIEW TYPES ====================

/** vw_active_subscriptions */
export interface ActiveSubscription {
  id: UUID;
  school_id: UUID;
  school_name: string;
  plan_name: string;
  student_limit: number;
  started_at: Timestamp;
  expires_at: Timestamp;
  display_status: string;
  time_remaining: string;
}