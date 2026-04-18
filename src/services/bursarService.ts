import { supabase } from '@/lib/supabase';
import type { FeeStructure, FeeStructureInstallment, StudentFeeInstallment, Payment, ExchangeRate } from '@/types/fee.types';

/**
 * Bursar Dashboard Service — fee structures, payment tracking,
 * financial overview, and exchange rates.
 */
export const bursarService = {
  // ==================== DASHBOARD STATS ====================

  async getDashboardStats(schoolId: string) {
    const [
      { data: feeStructures },
      { count: totalStudentFees },
      _pendingFeesResult,
      _paidFeesResult,
      revenueResult,
    ] = await Promise.all([
      supabase.from('fee_structures').select('id').eq('school_id', schoolId),
      supabase
        .from('student_fees')
        .select('*, students!inner(school_id)', { count: 'exact', head: true })
        .eq('students.school_id', schoolId),
      supabase
        .from('student_fees')
        .select('balance, students!inner(school_id)')
        .eq('students.school_id', schoolId)
        .in('status', ['pending', 'partial', 'overdue']),
      supabase
        .from('student_fees')
        .select('amount_paid, students!inner(school_id)')
        .eq('students.school_id', schoolId)
        .eq('status', 'paid'),
      supabase
        .from('payments')
        .select('amount_usd')
        .eq('school_id', schoolId)
        .eq('status', 'success'),
    ]);

    const totalOutstanding = (_pendingFeesResult.data ?? []).reduce(
      (sum: number, f: Record<string, unknown>) => sum + (Number(f.balance) || 0),
      0,
    );
    const totalCollected = (revenueResult.data ?? []).reduce(
      (sum, p) => sum + (Number(p.amount_usd) || 0),
      0,
    );

    return {
      totalFeeStructures: feeStructures?.length ?? 0,
      totalStudentFees: totalStudentFees ?? 0,
      totalOutstanding,
      totalCollected,
    };
  },

  // ==================== FEE STRUCTURES ====================

  async listFeeStructures(schoolId: string, academicYear?: string) {
    let query = supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', schoolId)
      .order('grade_level')
      .order('fee_type');

    if (academicYear) query = query.eq('academic_year', academicYear);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FeeStructure[];
  },

  async createFeeStructure(
    schoolId: string,
    form: {
      academicYear: string;
      classId?: string | null; // null = school-wide (e.g. registration fee)
      className: string;       // display label stored in grade_level
      feeType: string;
      amountUsd: number;
      amountLrd: number;
      description?: string;
      dueDate: string;
    },
  ) {
    const { data, error } = await supabase
      .from('fee_structures')
      .insert({
        school_id:    schoolId,
        academic_year: form.academicYear,
        class_id:     form.classId ?? null,
        grade_level:  form.className,
        fee_type:     form.feeType,
        amount_usd:   form.amountUsd,
        amount_lrd:   form.amountLrd,
        description:  form.description ?? null,
        due_date:     form.dueDate,
      })
      .select()
      .single();
    if (error) throw error;

    // Only auto-assign to enrolled students when this is a class-specific fee.
    // School-wide fees (class_id IS NULL, e.g. registration) are assigned
    // individually during the promotion flow — not bulk-pushed to everyone.
    if (form.classId) {
      await supabase.rpc('auto_assign_fees_for_new_structure', {
        p_fee_structure_id: data.id,
      });
    }

    return data as FeeStructure;
  },

  async updateFeeStructure(
    id: string,
    updates: Partial<{
      amountUsd: number;
      amountLrd: number;
      description: string;
      dueDate: string;
    }>,
  ) {
    const mapped: Record<string, unknown> = {};
    if (updates.amountUsd !== undefined) mapped.amount_usd = updates.amountUsd;
    if (updates.amountLrd !== undefined) mapped.amount_lrd = updates.amountLrd;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;

    const { data, error } = await supabase
      .from('fee_structures')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FeeStructure;
  },

  async deleteFeeStructure(id: string) {
    const { error } = await supabase.from('fee_structures').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Copy all fee structures from fromYear to toYear, skipping any
   * (class_id, fee_type) pair that already exists in toYear.
   * Does NOT auto-assign to students — next year's students aren't
   * enrolled yet; assignment happens during the promotion flow.
   * Returns the count of structures copied.
   */
  async copyFeesToNextYear(schoolId: string, fromYear: string, toYear: string): Promise<number> {
    // Fetch source year fee structures
    const { data: source, error: fetchErr } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year', fromYear);
    if (fetchErr) throw fetchErr;
    if (!source || source.length === 0) return 0;

    // Fetch already-existing next year structures to avoid duplicates
    const { data: existing } = await supabase
      .from('fee_structures')
      .select('class_id, fee_type, grade_level')
      .eq('school_id', schoolId)
      .eq('academic_year', toYear);

    const existingKeys = new Set(
      (existing ?? []).map((e) => `${e.class_id ?? '__null__'}|${e.fee_type}|${e.grade_level}`)
    );

    const toInsert = source
      .filter((s) => !existingKeys.has(`${s.class_id ?? '__null__'}|${s.fee_type}|${s.grade_level}`))
      .map(({ id: _id, created_at: _c, updated_at: _u, has_installments: _h, ...rest }) => ({
        ...rest,
        academic_year: toYear,
      }));

    if (toInsert.length === 0) return 0;

    const { error: insertErr } = await supabase.from('fee_structures').insert(toInsert);
    if (insertErr) throw insertErr;

    return toInsert.length;
  },

  // ==================== STUDENT FEES ====================

  async listStudentFees(
    schoolId: string,
    filters?: {
      studentId?: string;
      status?: string;
      academicYear?: string;
    },
    page = 1,
    pageSize = 20,
  ) {
    let query = supabase
      .from('student_fees')
      .select(
        `
        *,
        students!inner(id, first_name, last_name, registration_number, school_id),
        fee_structures!inner(fee_type, grade_level, description, school_id)
      `,
        { count: 'exact' },
      )
      .eq('students.school_id', schoolId)
      .order('created_at', { ascending: false });

    if (filters?.studentId) query = query.eq('student_id', filters.studentId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.academicYear) query = query.eq('academic_year', filters.academicYear);

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },

  /** Assign fee structure to all students enrolled in a specific class */
  async bulkAssignFees(
    schoolId: string,
    feeStructureId: string,
    classId: string | null,
    gradeLevel: string,
    academicYear: string,
  ) {
    let studentIds: string[] = [];

    if (classId) {
      // Preferred path: resolve students via class_assignments (accurate)
      const { data: assignments, error: assignErr } = await supabase
        .from('class_assignments')
        .select('student_id, students!inner(id, school_id, status)')
        .eq('class_id', classId)
        .eq('students.school_id', schoolId)
        .eq('students.status', 'enrolled');
      if (assignErr) throw assignErr;
      studentIds = (assignments ?? []).map((a) => a.student_id as string);
    } else {
      // Fallback: match by grade_level string on students table (legacy behaviour)
      const { data: students, error: studentsErr } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('current_grade_level', gradeLevel)
        .eq('status', 'enrolled');
      if (studentsErr) throw studentsErr;
      studentIds = (students ?? []).map((s) => s.id as string);
    }

    // Get the fee structure amount
    const { data: fee, error: feeErr } = await supabase
      .from('fee_structures')
      .select('amount_usd, due_date')
      .eq('id', feeStructureId)
      .single();
    if (feeErr) throw feeErr;

    // Insert student_fees for each student (skip duplicates via upsert)
    const inserts = studentIds.map((sid) => ({
      school_id: schoolId, // required for RLS — do not remove
      student_id: sid,
      fee_structure_id: feeStructureId,
      academic_year: academicYear,
      amount_due: fee.amount_usd,
      amount_paid: 0,
      balance: fee.amount_usd,
      status: 'pending',
      due_date: fee.due_date,
    }));

    if (inserts.length === 0) return { assigned: 0 };

    // ignoreDuplicates: true → ON CONFLICT DO NOTHING — never re-charges paid students
    const { error } = await supabase
      .from('student_fees')
      .upsert(inserts, { onConflict: 'student_id,fee_structure_id', ignoreDuplicates: true });
    if (error) throw error;
    return { assigned: inserts.length };
  },

  // ==================== PAYMENTS ====================

  async listPayments(schoolId: string, page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase
      .from('payments')
      .select(
        `
        *,
        students!inner(first_name, last_name, registration_number)
      `,
        { count: 'exact' },
      )
      .eq('school_id', schoolId)
      .order('payment_date', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },

  async recordPayment(
    schoolId: string,
    form: {
      studentId: string;
      studentFeeId: string;
      amountUsd: number;
      amountLrd: number;
      currencyCharged: string;
      paymentMethod: string;
      gatewayRef?: string;
    },
  ) {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id: form.studentId,
        student_fee_id: form.studentFeeId,
        amount_usd: form.amountUsd,
        amount_lrd: form.amountLrd,
        currency_charged: form.currencyCharged,
        payment_method: form.paymentMethod,
        gateway_ref: form.gatewayRef ?? null,
        status: 'success',
        payment_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // Update student_fees balance
    const { data: currentFee } = await supabase
      .from('student_fees')
      .select('amount_paid, amount_due')
      .eq('id', form.studentFeeId)
      .single();

    if (currentFee) {
      const newPaid = Number(currentFee.amount_paid) + form.amountUsd;
      const newBalance = Number(currentFee.amount_due) - newPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      await supabase
        .from('student_fees')
        .update({
          amount_paid: newPaid,
          balance: newBalance < 0 ? 0 : newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.studentFeeId);

      // If this was a registration fee and it is now fully paid,
      // activate the student's enrollment (pending_payment → active)
      if (newStatus === 'paid') {
        const { data: feeRow } = await supabase
          .from('student_fees')
          .select('fee_structures!inner(fee_type, academic_year)')
          .eq('id', form.studentFeeId)
          .single();

        const structure = (feeRow as Record<string, unknown> | null)?.fee_structures as
          | Record<string, string>
          | undefined;

        if (structure?.fee_type === 'registration') {
          await supabase.rpc('activate_student_enrollment', {
            p_student_id: form.studentId,
            p_academic_year: structure.academic_year,
          });
        }
      }
    }

    return data as Payment;
  },

  /**
   * Activate a student's enrollment after their registration fee is fully paid.
   * Calls the activate_student_enrollment RPC (migration 025).
   */
  async activateEnrollment(studentId: string, academicYear: string) {
    const { data, error } = await supabase.rpc('activate_student_enrollment', {
      p_student_id: studentId,
      p_academic_year: academicYear,
    });
    if (error) throw error;
    return data as { success: boolean; message: string };
  },

  // ==================== EXCHANGE RATES ====================

  async getLatestRate() {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', 'USD')
      .eq('to_currency', 'LRD')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as ExchangeRate | null;
  },

  async setExchangeRate(rate: number, source: 'api' | 'manual' = 'manual') {
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert(
        {
          from_currency: 'USD',
          to_currency: 'LRD',
          rate,
          source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'from_currency,to_currency' },
      )
      .select()
      .single();
    if (error) throw error;
    return data as ExchangeRate;
  },
};

// ==================== FEE INSTALLMENTS ====================
// Term-based splitting of annual fee structures.
// Bursar defines splits at the fee structure level; per-student records are
// auto-generated by the create_fee_installments RPC (migration 061).

export const feeInstallmentService = {
  /** List the term split definition for a fee structure (structure-level) */
  async getForFeeStructure(feeStructureId: string): Promise<FeeStructureInstallment[]> {
    const { data, error } = await supabase
      .from('fee_structure_installments')
      .select('*')
      .eq('fee_structure_id', feeStructureId)
      .order('term_order');
    if (error) throw error;
    return (data ?? []) as FeeStructureInstallment[];
  },

  /**
   * Save term installments for a fee structure.
   * Creates fee_structure_installments and auto-generates student_fee_installments
   * for every student who already has a student_fees record for this structure.
   */
  async create(
    feeStructureId: string,
    schoolId: string,
    installments: Array<{ term_name: string; term_order: number; amount_usd: number; due_date: string }>,
  ): Promise<void> {
    const { error } = await supabase.rpc('create_fee_installments', {
      p_fee_structure_id: feeStructureId,
      p_school_id:        schoolId,
      p_installments:     installments,
    });
    if (error) throw error;
  },

  /** Remove all installment splits for a fee structure */
  async remove(feeStructureId: string): Promise<void> {
    const { error } = await supabase
      .from('fee_structure_installments')
      .delete()
      .eq('fee_structure_id', feeStructureId);
    if (error) throw error;
    await supabase
      .from('fee_structures')
      .update({ has_installments: false })
      .eq('id', feeStructureId);
  },

  /** List installments for a specific student fee record (student-level view) */
  async getForStudentFee(studentFeeId: string): Promise<StudentFeeInstallment[]> {
    const { data, error } = await supabase
      .from('student_fee_installments')
      .select('*')
      .eq('student_fee_id', studentFeeId)
      .order('term_order');
    if (error) throw error;
    return (data ?? []) as StudentFeeInstallment[];
  },
};

// ==================== BURSAR IMPORT WORKFLOW ====================

export const bursarImportService = {
  /** List bulk-imported students still awaiting Bursar reg fee confirmation */
  async getPendingImportStudents(schoolId: string) {
    const { data, error } = await supabase.rpc('list_pending_import_students', {
      p_school_id: schoolId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      registration_number: string;
      class_name: string;
      reg_fee_paid: boolean;
      reg_fee_amount: number;
      imported_at: string;
    }>;
  },

  /** Bursar confirms that a student's registration fee has been paid */
  async confirmRegFee(studentId: string) {
    const { data, error } = await supabase.rpc('bursar_confirm_reg_fee', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data as { success: boolean; amount: number; message: string };
  },

  /** Search students by name for fee correction */
  async searchStudents(schoolId: string, query: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, current_grade_level, current_class_id, classes:current_class_id(name)')
      .eq('school_id', schoolId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,registration_number.ilike.%${query}%`)
      .limit(10);
    if (error) throw error;
    return (data ?? []) as unknown as Array<{
      id: string;
      first_name: string;
      last_name: string;
      registration_number: string;
      current_grade_level: string;
      classes: { name: string } | null;
    }>;
  },

  /** Get all fee records for a student (for correction page) */
  async getStudentFees(studentId: string) {
    const { data, error } = await supabase
      .from('student_fees')
      .select('*, fee_structures(fee_type, academic_year, grade_level)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      student_id: string;
      school_id: string;
      fee_structure_id: string;
      academic_year: string;
      amount_due: number;
      amount_paid: number;
      balance: number;
      status: string;
      fee_structures: {
        fee_type: string;
        academic_year: string;
        grade_level: string;
      } | null;
    }>;
  },

  /** Bursar corrects a student fee paid amount — creates audit payment record */
  async correctFee(studentFeeId: string, paidAmount: number, reason: string) {
    const { data, error } = await supabase.rpc('bursar_correct_fee', {
      p_student_fee_id: studentFeeId,
      p_paid_amount:    paidAmount,
      p_reason:         reason,
    });
    if (error) throw error;
    return data as {
      success: boolean;
      old_paid: number;
      new_paid: number;
      new_balance: number;
      new_status: string;
      message: string;
    };
  },
};
