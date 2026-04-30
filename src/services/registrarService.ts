import { supabase } from '@/lib/supabase';
import type {
  StudentApplication,
  ApplicationFilterParams,
  SchoolSetting,
} from '@/types/application.types';
import type { PaymentConfigPublic } from '@/services/proprietorPaymentService';

/**
 * Registrar Service — handles applications, student enrollment,
 * document review, acceptance letters, and registration numbers.
 */
export const registrarService = {
  // ==================== APPLICATIONS ====================

  /** List all applications for the school */
  async listApplications(
    schoolId: string,
    filters?: ApplicationFilterParams,
    page = 1,
    pageSize = 20,
  ) {
    let query = supabase
      .from('student_applications')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      // Registrar only sees applications whose fee has been cleared by finance
      .eq('application_fee_paid', true)
      .order('submitted_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.academicYear) query = query.eq('academic_year', filters.academicYear);
    if (filters?.gradeLevel) query = query.eq('grade_level_applied', filters.gradeLevel);
    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,application_number.ilike.%${filters.search}%,guardian_full_name.ilike.%${filters.search}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as StudentApplication[],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },

  /** Get a single application by ID */
  async getApplication(id: string) {
    const { data, error } = await supabase
      .from('student_applications')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as StudentApplication;
  },

  /** Update application status (under_review, documents_requested, rejected, waitlisted) */
  async updateApplicationStatus(id: string, status: string, reviewNotes?: string) {
    const { data, error } = await supabase
      .from('student_applications')
      .update({
        status,
        review_notes: reviewNotes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as StudentApplication;
  },

  /** Accept application — creates student, guardian, enrollment via RPC */
  async acceptApplication(applicationId: string, reviewNotes?: string, classId?: string) {
    const { data, error } = await supabase.rpc('accept_student_application', {
      p_application_id: applicationId,
      p_review_notes: reviewNotes ?? null,
      p_class_id: classId ?? null,
    });
    if (error) throw error;
    return data as {
      success: boolean;
      student_id: string;
      registration_number: string;
      guardian_id: string;
      class_id: string | null;
      reg_fee_assigned: boolean;
      message: string;
    };
  },

  /** Reject application */
  async rejectApplication(id: string, reviewNotes?: string) {
    return this.updateApplicationStatus(id, 'rejected', reviewNotes);
  },

  /** Get enrollment status for an accepted application */
  async getEnrollmentStatus(applicationId: string) {
    const { data, error } = await supabase.rpc('get_application_enrollment_status', {
      p_application_id: applicationId,
    });
    if (error) throw error;
    return data as {
      accepted: boolean;
      student_id: string | null;
      reg_fee_paid: boolean;
      reg_fee_amount: number;
      account_exists: boolean;
      enrollment_status: string | null;
    };
  },

  /** Enroll student after registration fee payment — creates login account */
  async enrollStudent(studentId: string) {
    const { data, error } = await supabase.rpc('enroll_student_after_payment', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data as {
      success: boolean;
      already_exists: boolean;
      student_id: string;
      registration_number: string;
      message: string;
    };
  },

  /** List bulk-imported students still awaiting Bursar fee clearance + Registrar confirmation */
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

  /** Registrar confirms enrollment for a bulk-imported student (fee must be paid first) */
  async confirmImportEnrollment(studentId: string) {
    const { data, error } = await supabase.rpc('confirm_import_enrollment', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data as { success: boolean; student_id: string; registration_number: string; message: string };
  },

  /** List students whose reg fee is paid but account not yet created */
  async listReadyToEnroll(schoolId: string) {
    const { data, error } = await supabase.rpc('list_ready_to_enroll', {
      p_school_id: schoolId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{
      application_id: string;
      student_id: string;
      first_name: string;
      last_name: string;
      registration_number: string;
      class_name: string;
      reg_fee_paid_at: string;
    }>;
  },

  // ==================== DASHBOARD STATS ====================

  /** Get registrar dashboard statistics */
  async getDashboardStats(schoolId: string) {
    const [
      { count: totalApplications },
      { count: pendingReview },
      { count: accepted },
      { count: rejected },
      { count: totalStudents },
      { count: activeEnrollments },
    ] = await Promise.all([
      supabase
        .from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId),
      supabase
        .from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .in('status', ['submitted', 'under_review']),
      supabase
        .from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'accepted'),
      supabase
        .from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'rejected'),
      supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId),
      supabase
        .from('student_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'active'),
    ]);

    // Count students ready to enroll from applications (reg fee paid, no account yet)
    let readyToEnrollData: { data: unknown[] } = { data: [] };
    try {
      const r = await supabase.rpc('list_ready_to_enroll', { p_school_id: schoolId });
      readyToEnrollData = { data: r.data ?? [] };
    } catch {
      // non-critical — dashboard still loads
    }

    // Count bulk-imported students still pending Bursar clearance
    let pendingImportData: { data: unknown[] } = { data: [] };
    try {
      const r = await supabase.rpc('list_pending_import_students', { p_school_id: schoolId });
      pendingImportData = { data: r.data ?? [] };
    } catch {
      // non-critical
    }

    return {
      totalApplications: totalApplications ?? 0,
      pendingReview: pendingReview ?? 0,
      accepted: accepted ?? 0,
      rejected: rejected ?? 0,
      totalStudents: totalStudents ?? 0,
      activeEnrollments: activeEnrollments ?? 0,
      readyToEnroll: (readyToEnrollData.data as unknown[])?.length ?? 0,
      pendingImportEnrollments: (pendingImportData.data as unknown[])?.length ?? 0,
    };
  },

  /** List applications that have NOT yet had their fee paid — for finance/bursar use */
  async listUnpaidApplications(schoolId: string, search?: string) {
    let query = supabase
      .from('student_applications')
      .select('*')
      .eq('school_id', schoolId)
      .eq('application_fee_paid', false)
      .order('submitted_at', { ascending: false });

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,application_number.ilike.%${search}%,guardian_full_name.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as StudentApplication[];
  },

  /** Mark application fee as paid (cash payment recorded by finance) */
  async markApplicationFeePaid(applicationId: string, notes?: string) {
    const { data, error } = await supabase
      .from('student_applications')
      .update({
        application_fee_paid: true,
        review_notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .select()
      .single();
    if (error) throw error;
    return data as StudentApplication;
  },

  /** Get recent applications */
  async getRecentApplications(schoolId: string, limit = 10) {
    const { data, error } = await supabase
      .from('student_applications')
      .select('*')
      .eq('school_id', schoolId)
      .order('submitted_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as StudentApplication[];
  },

  // ==================== LETTERS (Registrar-specific) ====================

  /** Get letter templates usable by registrar */
  async getRegistrarLetterTemplates(schoolId: string) {
    const { data, error } = await supabase
      .from('letter_templates')
      .select('*')
      .eq('school_id', schoolId)
      .in('category', ['admissions', 'administrative']);
    if (error) throw error;
    return data ?? [];
  },

  // ==================== SCHOOL SETTINGS ====================

  /** Get a school setting */
  async getSetting(schoolId: string, key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('school_settings')
      .select('setting_value')
      .eq('school_id', schoolId)
      .eq('setting_key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.setting_value ?? null;
  },

  /** Get all school settings */
  async getAllSettings(schoolId: string) {
    const { data, error } = await supabase
      .from('school_settings')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return (data ?? []) as SchoolSetting[];
  },

  /** Upsert a school setting */
  async upsertSetting(schoolId: string, key: string, value: string) {
    const { data, error } = await supabase
      .from('school_settings')
      .upsert(
        {
          school_id: schoolId,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_id,setting_key' },
      )
      .select()
      .single();
    if (error) throw error;
    return data as SchoolSetting;
  },
};

// ============================================================
// STUDENT IMPORT SERVICE
// ============================================================

export interface ImportStudentRow {
  // Required
  first_name: string;
  last_name: string;
  class_name: string;
  guardian_name: string;
  guardian_phone: string;
  // Optional — student
  date_of_birth: string;
  gender: string;
  blood_type: string;
  phone: string;
  address: string;
  city: string;
  // Optional — guardian
  guardian_relationship: string;
  guardian_email: string;
  guardian_address: string;
  // Optional — emergency contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
}

export interface ImportRowResult {
  row_number: number;
  success: boolean;
  first_name: string;
  last_name: string;
  class_name: string;
  registration_number?: string;
  login_email?: string;
  default_password?: string;
  error?: string;
}

export const studentImportService = {
  /** CSV template content — download this, fill in, then upload */
  getTemplateCsv(): string {
    const header = [
      // Required
      'first_name', 'last_name', 'class_name', 'guardian_name', 'guardian_phone',
      // Optional — student
      'date_of_birth', 'gender', 'blood_type', 'phone', 'address', 'city',
      // Optional — guardian
      'guardian_relationship', 'guardian_email', 'guardian_address',
      // Optional — emergency contact
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    ].join(',');

    const row1 = [
      'John', 'Doe', '12A', 'James Doe', '0770123456',
      '2007-01-15', 'Male', 'O+', '', '', '',
      'father', 'james.doe@email.com', '',
      'Mary Doe', '0770654321', 'mother',
    ].join(',');

    const row2 = [
      'Mary', 'Johnson', '10B', 'Sarah Johnson', '0880234567',
      '2008-03-20', 'Female', '', '', '', '',
      'mother', '', '',
      '', '', '',
    ].join(',');

    const row3 = [
      'James', 'Smith', '11A', 'Robert Smith', '0770987654',
      '2006-11-03', 'Male', 'A+', '0880111222', 'Monrovia', 'Monrovia',
      'father', 'robert.smith@email.com', '12 Broad St',
      'Linda Smith', '0880333444', 'mother',
    ].join(',');

    return [header, row1, row2, row3].join('\n');
  },

  /** Parse a CSV file into ImportStudentRow objects (client-side, no library needed) */
  parseCsv(text: string): { rows: ImportStudentRow[]; errors: string[] } {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
    if (lines.length < 2) return { rows: [], errors: ['File appears empty or has no data rows.'] };

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/[^a-z_]/g, ''));
    const required = ['first_name', 'last_name', 'class_name', 'guardian_name', 'guardian_phone'];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length > 0) {
      return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}. Download the template and use it.`] };
    }

    const col = (row: string[], name: string) => {
      const i = header.indexOf(name);
      return i >= 0 ? (row[i] ?? '').trim() : '';
    };

    const rows: ImportStudentRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle quoted fields (simple implementation)
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.every((p) => !p)) continue; // skip blank rows
      rows.push({
        first_name:                     col(parts, 'first_name'),
        last_name:                      col(parts, 'last_name'),
        class_name:                     col(parts, 'class_name'),
        guardian_name:                  col(parts, 'guardian_name'),
        guardian_phone:                 col(parts, 'guardian_phone'),
        date_of_birth:                  col(parts, 'date_of_birth'),
        gender:                         col(parts, 'gender'),
        blood_type:                     col(parts, 'blood_type'),
        phone:                          col(parts, 'phone'),
        address:                        col(parts, 'address'),
        city:                           col(parts, 'city'),
        guardian_relationship:          col(parts, 'guardian_relationship'),
        guardian_email:                 col(parts, 'guardian_email'),
        guardian_address:               col(parts, 'guardian_address'),
        emergency_contact_name:         col(parts, 'emergency_contact_name'),
        emergency_contact_phone:        col(parts, 'emergency_contact_phone'),
        emergency_contact_relationship: col(parts, 'emergency_contact_relationship'),
      });
    }

    return { rows, errors };
  },

  /** Normalize a date string to YYYY-MM-DD regardless of input format.
   *  Handles: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, D/M/YYYY */
  normalizeDate(raw: string): string | null {
    if (!raw?.trim()) return null;
    const s = raw.trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // YYYY/MM/DD
    const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (ymdSlash) {
      const [, y, m, d] = ymdSlash;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD/MM/YYYY — Excel default in most regions outside US
    const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
      const [, d, m, y] = dmySlash;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD-MM-YYYY
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
      const [, d, m, y] = dmyDash;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return null; // unrecognized format
  },

  /** Client-side validation of parsed rows against available class names */
  validateRows(
    rows: ImportStudentRow[],
    availableClasses: string[],
  ): Array<ImportStudentRow & { _valid: boolean; _errors: string[] }> {
    const classSet = new Set(availableClasses.map((c) => c.toLowerCase()));
    return rows.map((row) => {
      const errs: string[] = [];
      if (!row.first_name.trim()) errs.push('First name required');
      if (!row.last_name.trim())  errs.push('Last name required');
      if (!row.class_name.trim()) errs.push('Class name required');
      else if (!classSet.has(row.class_name.toLowerCase())) errs.push(`Class "${row.class_name}" not found`);
      if (!row.guardian_name.trim())  errs.push('Guardian name required');
      if (!row.guardian_phone.trim()) errs.push('Guardian phone required');

      // Normalize date to YYYY-MM-DD — accepts DD/MM/YYYY, YYYY/MM/DD, etc.
      let normalizedDob = row.date_of_birth;
      if (row.date_of_birth?.trim()) {
        const normalized = studentImportService.normalizeDate(row.date_of_birth);
        if (!normalized) {
          errs.push('Date of birth format not recognized — use YYYY-MM-DD (e.g. 2007-01-15)');
        } else {
          normalizedDob = normalized;
        }
      }

      return { ...row, date_of_birth: normalizedDob, _valid: errs.length === 0, _errors: errs };
    });
  },

  /**
   * Send validated rows to the DB for processing.
   * Batches in groups of 50 to avoid timeouts.
   * Returns combined results from all batches.
   *
   * @param defaultPassword - IT Admin's default student password (from school settings).
   *   When provided, accounts are created with this password instead of the registration number.
   */
  async importStudents(
    schoolId: string,
    academicYear: string,
    rows: ImportStudentRow[],
    onProgress?: (done: number, total: number) => void,
    defaultPassword?: string,
  ): Promise<ImportRowResult[]> {
    const BATCH_SIZE = 50;
    const results: ImportRowResult[] = [];
    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const rpcParams: Record<string, unknown> = {
        p_school_id:      schoolId,
        p_academic_year:  academicYear,
        p_students:       batch as unknown,
      };
      if (defaultPassword) {
        rpcParams.p_default_password = defaultPassword;
      }
      const { data, error } = await supabase.rpc('bulk_import_students', rpcParams as Parameters<typeof supabase.rpc>[1]);
      if (error) throw error;
      const batchResults = (data as ImportRowResult[]) ?? [];
      // Re-number rows relative to the full dataset
      batchResults.forEach((r, idx) => {
        r.row_number = i + idx + 1;
      });
      results.push(...batchResults);
      processed += batch.length;
      onProgress?.(processed, rows.length);
    }

    return results;
  },
};

/**
 * Public Application Service — for anonymous users on school site.
 * Uses the public client (no auth session).
 */
export const publicApplicationService = {
  /** Submit an application from the public school site */
  async submitApplication(params: {
    schoolId: string;
    academicYear: string;
    gradeLevel: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
    bloodType?: string;
    studentPhone?: string;
    studentAddress?: string;
    studentCity?: string;
    previousSchool?: string;
    previousGrade?: string;
    guardianFullName: string;
    guardianRelationship?: string;
    guardianEmail?: string;
    guardianPhone: string;
    guardianAddress?: string;
    guardianOccupation?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    documents?: Array<{ type: string; file_url: string; uploaded_at: string }>;
    classId?: string;
    photoUrl?: string;
  }) {
    // Use the public client import for anon RPC calls
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    let _publicClient: ReturnType<typeof createClient> | null = null;
    if (!_publicClient) {
      _publicClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: 'sb-application-token',
        },
      });
    }

    const { data, error } = await _publicClient.rpc('submit_student_application', {
      p_school_id: params.schoolId,
      p_academic_year: params.academicYear,
      p_grade_level: params.gradeLevel,
      p_first_name: params.firstName,
      p_last_name: params.lastName,
      p_date_of_birth: params.dateOfBirth,
      p_gender: params.gender ?? null,
      p_previous_school: params.previousSchool ?? null,
      p_previous_grade: params.previousGrade ?? null,
      p_guardian_full_name: params.guardianFullName,
      p_guardian_relationship: params.guardianRelationship ?? null,
      p_guardian_email: params.guardianEmail ?? null,
      p_guardian_phone: params.guardianPhone,
      p_guardian_address: params.guardianAddress ?? null,
      p_guardian_occupation: params.guardianOccupation ?? null,
      p_emergency_contact_name: params.emergencyContactName ?? null,
      p_emergency_contact_phone: params.emergencyContactPhone ?? null,
      p_documents: (params.documents ?? []) as unknown,
      p_class_id: params.classId ?? null,
      p_emergency_contact_relationship: params.emergencyContactRelationship ?? null,
      p_photo_url: params.photoUrl ?? null,
      p_blood_type: params.bloodType ?? null,
      p_phone: params.studentPhone ?? null,
      p_address: params.studentAddress ?? null,
      p_city: params.studentCity ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) throw error;
    return data as {
      success: boolean;
      application_id: string;
      application_number: string;
      application_fee: number;
      message: string;
    };
  },

  /** Get public school settings (application fee, etc.) */
  async getPublicSettings(schoolId: string) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-settings-token' },
    });

    const { data, error } = await client
      .from('school_settings')
      .select('setting_key, setting_value')
      .eq('school_id', schoolId)
      .in('setting_key', [
        'application_fee_usd',
        'application_fee_lrd',
        'accepting_applications',
        'current_academic_year',
      ]);
    if (error) throw error;

    const settings: Record<string, string> = {};
    (data ?? []).forEach((s: { setting_key: string; setting_value: string }) => {
      settings[s.setting_key] = s.setting_value;
    });
    return settings;
  },

  /** Get the school's public payment config (anon-safe) */
  async getPublicPaymentConfig(schoolId: string) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-payconf-token' },
    });
    const { data, error } = await client.rpc('get_payment_config_public', {
      p_school_id: schoolId,
    });
    if (error) return null;
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    return (Array.isArray(data) ? data[0] : data) as PaymentConfigPublic;
  },

  /** Record an online payment for an application fee (anon-safe, SECURITY DEFINER) */
  async recordOnlinePayment(applicationNumber: string, gatewayRef: string, method: string) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-apppay-token' },
    });
    const { data, error } = await client.rpc('record_application_online_payment', {
      p_application_number: applicationNumber,
      p_gateway_ref: gatewayRef,
      p_payment_method: method,
    });
    if (error) throw error;
    return data as { success: boolean; message: string };
  },

  /** Check application status (public — uses anon client) */
  async checkStatus(applicationNumber: string, dateOfBirth: string) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-status-token' },
    });

    const { data, error } = await client.rpc('check_application_status', {
      p_application_number: applicationNumber,
      p_date_of_birth: dateOfBirth,
    });
    if (error) throw error;
    return data as {
      found: boolean;
      message?: string;
      application_number?: string;
      student_name?: string;
      grade_level?: string;
      academic_year?: string;
      status?: string;
      submitted_at?: string;
      reviewed_at?: string;
      review_notes?: string;
      application_fee_amount?: number;
      application_fee_paid?: boolean;
      registration_number?: string;
    };
  },
};
