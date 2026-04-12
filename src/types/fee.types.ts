// ============================================================
// FEE TYPES — Fee structures, student fees, payments, invoices
// ============================================================

import type {
  UUID, Timestamp, ISODate, Currency,
  SchoolScopedEntity, InvoiceStatus, StudentFeeStatus,
} from './common.types';

export type PaymentMethod = 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'refunded';
export type FeeType = 'tuition' | 'registration' | 'exam' | 'activity' | 'library' | 'transportation' | 'facility';

/** fee_structures table */
export interface FeeStructure extends SchoolScopedEntity {
  academic_year: string;
  grade_level: string;   // class name (e.g. "12A") — kept for display / legacy
  class_id: UUID | null; // FK → classes.id (set from migration 023 onward)
  fee_type: FeeType;
  amount_usd: number;
  amount_lrd: number;
  description: string | null;
  due_date: ISODate;
}

/** student_fees table — balance auto-synced by trigger (migration 006) */
export interface StudentFee {
  id: UUID;
  student_id: UUID;
  fee_structure_id: UUID;
  academic_year: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: StudentFeeStatus;
  due_date: ISODate;
  last_reminder_sent: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** payments table */
export interface Payment extends SchoolScopedEntity {
  student_id: UUID;
  student_fee_id: UUID;
  amount_usd: number;
  amount_lrd: number;
  currency_charged: Currency;
  payment_method: PaymentMethod;
  gateway_ref: string | null;
  status: PaymentStatus;
  recorded_by: UUID;
  payment_date: Timestamp;
}

/** invoices table */
export interface Invoice extends SchoolScopedEntity {
  student_id: UUID;
  invoice_number: string;
  total_amount: number;
  status: InvoiceStatus;
  due_date: ISODate;
  issued_date: ISODate;
  paid_at: Timestamp | null;
  pdf_url: string | null;
}

/** payment_receipts table */
export interface PaymentReceipt {
  id: UUID;
  payment_id: UUID;
  receipt_number: string;
  amount_received: number;
  received_from: string;
  received_by: UUID;
  issued_date: ISODate;
  pdf_url: string | null;
  created_at: Timestamp;
}

/** payment_history table */
export interface PaymentHistory {
  id: UUID;
  student_fee_id: UUID;
  previous_balance: number;
  payment_amount: number;
  new_balance: number;
  payment_date: Timestamp;
  payment_method: PaymentMethod;
}

/** expense_records table */
export interface ExpenseRecord extends SchoolScopedEntity {
  category: string;
  amount: number;
  receipt_url: string | null;
  recorded_by: UUID;
  recorded_date: ISODate;
}

/** financial_reports table */
export interface FinancialReport extends SchoolScopedEntity {
  report_type: string;
  period_start: ISODate;
  period_end: ISODate;
  data: Record<string, unknown>;
  generated_by: UUID;
  generated_at: Timestamp;
}

/** exchange_rates table */
export interface ExchangeRate {
  id: UUID;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: 'api' | 'manual';
  fetched_at: Timestamp;
}

// ==================== VIEW TYPES ====================

/** vw_financial_summary_by_class */
export interface FinancialSummaryByClass {
  class_id: UUID;
  school_id: UUID;
  class_name: string;
  total_students: number;
  total_fees_due: number;
  total_paid: number;
  outstanding_balance: number;
  collection_percentage: number;
}

/** vw_late_payments */
export interface LatePaymentSummary {
  school_id: UUID;
  school_name: string;
  students_with_late_fees: number;
  total_overdue: number;
}

/** vw_monthly_revenue_summary */
export interface MonthlyRevenueSummary {
  month: ISODate;
  school_id: UUID;
  school_name: string;
  transaction_count: number;
  total_revenue: number;
  average_transaction: number;
  students_paid: number;
}

// ==================== FORMS ====================

export interface CreateFeeStructureForm {
  academicYear: string;
  gradeLevel: string;
  feeType: FeeType;
  amountUsd: number;
  amountLrd: number;
  description?: string;
  dueDate: ISODate;
}

export interface RecordPaymentForm {
  studentFeeId: UUID;
  amountUsd: number;
  amountLrd: number;
  currencyCharged: Currency;
  paymentMethod: PaymentMethod;
  gatewayRef?: string;
}

export interface FeeFilterParams {
  academicYear?: string;
  gradeLevel?: string;
  feeType?: FeeType;
  status?: StudentFeeStatus;
  studentId?: UUID;
}