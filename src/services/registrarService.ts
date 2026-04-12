import { supabase } from '@/lib/supabase';
import type {
  StudentApplication,
  ApplicationFilterParams,
  SchoolSetting,
} from '@/types/application.types';

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

    // Count students ready to enroll (reg fee paid, no account yet)
    const readyToEnrollData = await supabase
      .rpc('list_ready_to_enroll', { p_school_id: schoolId })
      .catch(() => ({ data: [] }));

    return {
      totalApplications: totalApplications ?? 0,
      pendingReview: pendingReview ?? 0,
      accepted: accepted ?? 0,
      rejected: rejected ?? 0,
      totalStudents: totalStudents ?? 0,
      activeEnrollments: activeEnrollments ?? 0,
      readyToEnroll: (readyToEnrollData.data as unknown[])?.length ?? 0,
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
    documents?: Array<{ type: string; file_url: string; uploaded_at: string }>;
    classId?: string;
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
    return (Array.isArray(data) ? data[0] : data) as {
      flw_enabled: boolean;
      flw_public_key: string;
      flw_methods: string[];
      flw_currency: string;
      mtn_enabled: boolean;
      mtn_merchant_code: string;
      orange_enabled: boolean;
      orange_merchant_code: string;
      payment_title: string;
      payment_logo: string;
    };
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
