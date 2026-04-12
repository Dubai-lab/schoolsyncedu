// ============================================================
// COMMON TYPES — Shared across all modules
// ============================================================

/** UUID string type alias */
export type UUID = string;

/** ISO timestamp string */
export type Timestamp = string;

/** ISO date string (YYYY-MM-DD) */
export type ISODate = string;

/** Time string (HH:mm:ss) */
export type TimeString = string;

// ==================== DATABASE ROW HELPERS ====================

/** Base fields present on most DB tables */
export interface BaseEntity {
  id: UUID;
  created_at: Timestamp;
}

/** Tables with updated_at */
export interface TimestampedEntity extends BaseEntity {
  updated_at: Timestamp;
}

/** Tables scoped to a school (multi-tenancy) */
export interface SchoolScopedEntity extends BaseEntity {
  school_id: UUID;
}

// ==================== PAGINATION ====================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== SORTING & FILTERING ====================

export type SortDirection = 'asc' | 'desc';

export interface SortParams {
  column: string;
  direction: SortDirection;
}

export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

// ==================== FORM & UI ====================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

export interface TableColumn<T = unknown> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

// ==================== DASHBOARD ====================

export interface StatCard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ==================== ENUMS FROM DB ====================

export type Gender = 'male' | 'female' | 'other';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type Currency = 'USD' | 'LRD';
export type NotificationChannel = 'email' | 'sms' | 'in_app' | 'push';
export type NotificationFrequency = 'immediate' | 'daily' | 'weekly' | 'never';
export type BookCopyStatus = 'available' | 'checked_out' | 'lost' | 'damaged';
export type BookCondition = 'good' | 'fair' | 'damaged';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type WebhookStatus = 'pending' | 'processed' | 'failed';
export type ExchangeRateSource = 'api' | 'manual';
export type TemplateVersionStatus = 'draft' | 'active' | 'archived';
export type RecallActionType = 'recall' | 'void';
export type RecallReason = 'sent_in_error' | 'wrong_recipient' | 'incorrect_info' | 'other';
export type NfcAssignmentMethod = 'external_reader' | 'pwa_scan' | 'manual';
export type IdCardGenerationStatus = 'in_progress' | 'completed' | 'failed';
export type SmsStatus = 'sent' | 'delivered' | 'failed';
export type NfcScanStatus = 'success' | 'failed' | 'invalid';
export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn';
export type PassFailStatus = 'pass' | 'fail';
export type StudentFeeStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type PlatformAdminRole = 'super_admin' | 'billing' | 'support' | 'technical' | 'sales';
export type DiscountType = 'percentage' | 'fixed' | 'coupon' | 'school_specific' | 'bulk' | 'seasonal' | 'referral' | 'loyalty';