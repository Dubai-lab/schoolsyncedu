// ============================================================
// LIBRARY TYPES — Books, checkouts, returns, reports
// ============================================================

import type { UUID, Timestamp, ISODate, BaseEntity, SchoolScopedEntity, BookCopyStatus, BookCondition } from './common.types';

// ==================== ENTITIES ====================

/** books table */
export interface Book extends SchoolScopedEntity {
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  description: string | null;
  publisher: string | null;
  publication_year: number | null;
  total_copies: number;
  available_copies: number;
}

/** book_copies table */
export interface BookCopy extends BaseEntity {
  book_id: UUID;
  barcode: string;
  status: BookCopyStatus;
}

/** book_checkouts table */
export interface BookCheckout {
  id: UUID;
  student_id: UUID;
  book_copy_id: UUID;
  checkout_date: ISODate;
  due_date: ISODate;
  is_returned: boolean;
  checked_out_by: UUID | null;
}

/** book_returns table */
export interface BookReturn extends BaseEntity {
  book_copy_id: UUID;
  student_id: UUID;
  return_date: ISODate;
  condition: BookCondition | null;
  checked_in_by: UUID | null;
}

/** library_reports table */
export interface LibraryReport {
  id: UUID;
  school_id: UUID;
  report_type: string | null;
  period: string | null;
  data: Record<string, unknown> | null;
  generated_by: UUID | null;
  generated_at: Timestamp;
}

// ==================== VIEW TYPES ====================

/** overdue_books view */
export interface OverdueBookView {
  id: UUID;
  student_id: UUID;
  book_copy_id: UUID;
  due_date: ISODate;
  days_overdue: number;
  fine_amount: number;
  status: 'critical' | 'overdue' | 'due_soon';
  checkout_id: UUID;
}

/** vw_library_outstanding_items view */
export interface LibraryOutstandingItem {
  student_id: UUID;
  first_name: string;
  last_name: string;
  book_title: string;
  isbn: string | null;
  copy_number: string;
  checkout_date: ISODate;
  due_date: ISODate;
  days_overdue: number;
  status: 'overdue' | 'due_soon' | 'on_time';
}

// ==================== FORMS ====================

export interface CreateBookForm {
  title: string;
  author?: string;
  isbn?: string;
  category?: string;
  description?: string;
  publisher?: string;
  publicationYear?: number;
  totalCopies: number;
}

export interface CheckoutBookForm {
  studentId: UUID;
  bookCopyId: UUID;
  dueDate: ISODate;
}

export interface ReturnBookForm {
  bookCopyId: UUID;
  studentId: UUID;
  condition: BookCondition;
}

export interface BookFilterParams {
  category?: string;
  search?: string;
  available?: boolean;
}
