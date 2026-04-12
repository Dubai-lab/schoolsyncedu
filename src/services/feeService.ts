import { supabase } from '@/lib/supabase';
import type { UUID, ISODate, StudentFeeStatus } from '@/types/common.types';
import type {
  FeeStructure,
  StudentFee,
  Payment,
  Invoice,
  FeeFilterParams,
  FeeType,
  PaymentMethod,
  FinancialSummaryByClass,
  MonthlyRevenueSummary,
} from '@/types/fee.types';

// ==================== FEE STRUCTURES ====================

export const feeStructureService = {
  async list(schoolId: UUID, academicYear?: string) {
    let query = supabase
      .from('fee_structures')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('grade_level')
      .order('fee_type');
    if (academicYear) query = query.eq('academic_year', academicYear);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as FeeStructure[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase.from('fee_structures').select('*').eq('id', id).single();
    if (error) throw error;
    return data as FeeStructure;
  },

  async create(schoolId: UUID, entry: {
    academic_year: string; grade_level: string; fee_type: FeeType;
    amount_usd: number; amount_lrd: number; description?: string; due_date: ISODate;
  }) {
    const { data, error } = await supabase
      .from('fee_structures')
      .insert({ school_id: schoolId, ...entry })
      .select()
      .single();
    if (error) throw error;
    return data as FeeStructure;
  },

  async update(id: UUID, entry: Partial<{
    academic_year: string; grade_level: string; fee_type: FeeType;
    amount_usd: number; amount_lrd: number; description: string; due_date: ISODate;
  }>) {
    const { data, error } = await supabase
      .from('fee_structures')
      .update(entry)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FeeStructure;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('fee_structures').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== STUDENT FEES ====================

export const studentFeeService = {
  async list(
    schoolId: UUID,
    params: FeeFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 25, academicYear, gradeLevel, feeType, status, studentId } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('student_fees')
      .select(
        `*, students!inner(id, first_name, last_name, registration_number, school_id), fee_structures!inner(id, fee_type, grade_level, amount_usd, amount_lrd, description)`,
        { count: 'exact' },
      )
      .eq('students.school_id', schoolId)
      .order('due_date', { ascending: true })
      .range(from, to);

    if (studentId) query = query.eq('student_id', studentId);
    if (academicYear) query = query.eq('academic_year', academicYear);
    if (gradeLevel) query = query.eq('fee_structures.grade_level', gradeLevel);
    if (feeType) query = query.eq('fee_structures.fee_type', feeType);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (StudentFee & { students: Record<string, unknown>; fee_structures: Record<string, unknown> })[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('student_fees')
      .select(`*, students(id, first_name, last_name, registration_number), fee_structures(*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as StudentFee & { students: Record<string, unknown>; fee_structures: Record<string, unknown> };
  },

  /** Assign a fee structure to a student */
  async assign(entry: {
    student_id: UUID; fee_structure_id: UUID; academic_year: string;
    amount_due: number; due_date: ISODate;
  }) {
    const { data, error } = await supabase
      .from('student_fees')
      .insert({
        ...entry,
        amount_paid: 0,
        balance: entry.amount_due,
        status: 'pending' as StudentFeeStatus,
      })
      .select()
      .single();
    if (error) throw error;
    return data as StudentFee;
  },

  /** Bulk assign fee structure to all students in a grade level */
  async bulkAssign(schoolId: UUID, feeStructureId: UUID, academicYear: string, gradeLevel: string) {
    // Get students in this grade level via classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel);

    if (!classes || classes.length === 0) return [];

    const classIds = classes.map((c) => c.id);
    const { data: assignments } = await supabase
      .from('class_assignments')
      .select('student_id')
      .in('class_id', classIds)
      .is('removed_at', null);

    if (!assignments || assignments.length === 0) return [];

    // Get fee structure details
    const feeStructure = await feeStructureService.getById(feeStructureId);

    const rows = [...new Set(assignments.map((a) => a.student_id))].map((studentId) => ({
      student_id: studentId,
      fee_structure_id: feeStructureId,
      academic_year: academicYear,
      amount_due: feeStructure.amount_usd,
      amount_paid: 0,
      balance: feeStructure.amount_usd,
      status: 'pending' as StudentFeeStatus,
      due_date: feeStructure.due_date,
    }));

    const { data, error } = await supabase
      .from('student_fees')
      .upsert(rows, { onConflict: 'student_id,fee_structure_id', ignoreDuplicates: true })
      .select();
    if (error) throw error;
    return data as StudentFee[];
  },
};

// ==================== PAYMENTS ====================

export const paymentService = {
  async list(
    schoolId: UUID,
    params: { page?: number; pageSize?: number; studentId?: UUID; status?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    const { page = 1, pageSize = 25, studentId, status, dateFrom, dateTo } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('payments')
      .select(
        `*, students!inner(id, first_name, last_name, registration_number)`,
        { count: 'exact' },
      )
      .eq('school_id', schoolId)
      .order('payment_date', { ascending: false })
      .range(from, to);

    if (studentId) query = query.eq('student_id', studentId);
    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('payment_date', dateFrom);
    if (dateTo) query = query.lte('payment_date', dateTo);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (Payment & { students: Record<string, unknown> })[], count: count ?? 0 };
  },

  /** Record a payment against a student fee via SECURITY DEFINER RPC.
   *  This bypasses RLS, atomically updates amount_paid + balance + status,
   *  and returns the created payment record.
   */
  async recordPayment(
    schoolId: UUID,
    entry: {
      student_id: UUID; student_fee_id: UUID;
      amount_usd: number; amount_lrd: number;
      currency_charged: 'USD' | 'LRD'; payment_method: PaymentMethod;
      gateway_ref?: string; recorded_by: UUID;
    },
  ) {
    const { data, error } = await supabase.rpc('record_fee_payment', {
      p_school_id:        schoolId,
      p_student_id:       entry.student_id,
      p_student_fee_id:   entry.student_fee_id,
      p_amount_usd:       entry.amount_usd,
      p_amount_lrd:       entry.amount_lrd,
      p_currency_charged: entry.currency_charged,
      p_payment_method:   entry.payment_method,
      p_gateway_ref:      entry.gateway_ref ?? null,
      p_recorded_by:      entry.recorded_by,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      payment_id: string;
      payment: Payment;
      new_paid: number;
      new_balance: number;
      new_status: StudentFeeStatus;
    };

    if (!result.success) throw new Error('Payment recording failed');

    return result.payment as Payment;
  },

  /** Get payment history for a student fee */
  async getHistory(studentFeeId: UUID) {
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('student_fee_id', studentFeeId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ==================== INVOICES ====================

export const invoiceService = {
  async list(schoolId: UUID, params: { studentId?: UUID; status?: string } = {}) {
    let query = supabase
      .from('invoices')
      .select(`*, students!inner(id, first_name, last_name)`, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('issued_date', { ascending: false });
    if (params.studentId) query = query.eq('student_id', params.studentId);
    if (params.status) query = query.eq('status', params.status);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (Invoice & { students: Record<string, unknown> })[], count: count ?? 0 };
  },

  async generate(schoolId: UUID, entry: {
    student_id: UUID; total_amount: number; due_date: ISODate;
  }) {
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        school_id: schoolId,
        student_id: entry.student_id,
        invoice_number: invoiceNumber,
        total_amount: entry.total_amount,
        status: 'sent',
        due_date: entry.due_date,
        issued_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  },
};

// ==================== FINANCIAL REPORTS ====================

export const financialReportService = {
  async getClassSummary(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_financial_summary_by_class')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as FinancialSummaryByClass[];
  },

  async getMonthlyRevenue(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_monthly_revenue_summary')
      .select('*')
      .eq('school_id', schoolId)
      .order('month', { ascending: false })
      .limit(12);
    if (error) throw error;
    return data as MonthlyRevenueSummary[];
  },

  async getLatePayments(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_late_payments')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data;
  },
};