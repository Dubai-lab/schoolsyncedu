import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  Student,
  Guardian,
  StudentEnrollment,
  StudentFilterParams,
  CreateStudentForm,
  UpdateStudentForm,
  CreateGuardianForm,
} from '@/types/student.types';

// ==================== STUDENTS ====================

export const studentService = {
  /** List students for a school with search/filter + pagination */
  async list(
    schoolId: UUID,
    params: StudentFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const { search, status, gradeLevel, classId, gender, page = 1, pageSize = 20 } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('students')
      .select('*, guardians(id, full_name, phone, relationship)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,registration_number.ilike.%${search}%`,
      );
    }
    if (status) query = query.eq('status', status);
    if (gradeLevel) query = query.eq('current_grade_level', gradeLevel);
    if (classId) query = query.eq('current_class_id', classId);
    if (gender) query = query.eq('gender', gender);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: (data ?? []) as (Student & { guardians: Pick<Guardian, 'id' | 'full_name' | 'phone' | 'relationship'>[] })[],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },

  /** Get single student with guardians */
  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('students')
      .select('*, guardians(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Student & { guardians: Guardian[] };
  },

  /** Find a student by UUID or registration number (e.g. "SEY-2026-0001") */
  async findByIdOrRegNumber(query: string): Promise<(Student & { guardians: Guardian[] }) | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.trim());
    const { data, error } = await supabase
      .from('students')
      .select('*, guardians(*)')
      .eq(isUuid ? 'id' : 'registration_number', isUuid ? query.trim() : query.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data as (Student & { guardians: Guardian[] }) | null;
  },

  /** Create a new student + guardian in one transaction-ish flow */
  async create(schoolId: UUID, form: CreateStudentForm) {
    // ── Enforce subscription student limit ────────────────────────────────
    // Get current active subscription plan limit for this school
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('subscription_plans(student_limit)')
      .eq('school_id', schoolId)
      .in('status', ['active', 'trial', 'grace'])
      .maybeSingle();

    const planLimit = (subData?.subscription_plans as { student_limit?: number } | null)?.student_limit ?? null;

    if (planLimit !== null) {
      const { count: currentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'enrolled');

      if ((currentCount ?? 0) >= planLimit) {
        throw new Error(
          `Student limit reached. Your current plan allows up to ${planLimit.toLocaleString()} enrolled students. ` +
          `Please upgrade your plan or contact SchoolSync support.`
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Insert student
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        first_name: form.firstName,
        last_name: form.lastName,
        date_of_birth: form.dateOfBirth,
        gender: form.gender,
        photo_url: form.photoUrl || null,
        enrollment_date: form.enrollmentDate,
        current_grade_level: form.currentGradeLevel,
        current_class_id: form.currentClassId || null,
        previous_school: form.previousSchool || null,
        emergency_contact_name: form.emergencyContactName || null,
        emergency_contact_phone: form.emergencyContactPhone || null,
        status: 'enrolled',
      })
      .select()
      .single();
    if (studentErr) throw studentErr;

    // Insert guardian
    if (form.guardian) {
      await guardianService.create((student as Student).id, form.guardian);
    }

    return student as Student;
  },

  /** Update student fields */
  async update(id: UUID, form: UpdateStudentForm) {
    const { data, error } = await supabase
      .from('students')
      .update({
        first_name: form.firstName,
        last_name: form.lastName,
        photo_url: form.photoUrl,
        current_grade_level: form.currentGradeLevel,
        current_class_id: form.currentClassId || null,
        emergency_contact_name: form.emergencyContactName,
        emergency_contact_phone: form.emergencyContactPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Student;
  },

  /** Change student status */
  async updateStatus(id: UUID, newStatus: Student['status'], reason?: string, changedBy?: UUID) {
    // Get current status
    const { data: current, error: fetchErr } = await supabase
      .from('students')
      .select('status')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // Update status
    const { error: updateErr } = await supabase
      .from('students')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) throw updateErr;

    // Insert history
    await supabase.from('student_status_history').insert({
      student_id: id,
      previous_status: (current as Pick<Student, 'status'>).status,
      new_status: newStatus,
      reason: reason || null,
      changed_by: changedBy || null,
    });
  },

  /** Delete (soft: change status to withdrawn) */
  async delete(id: UUID) {
    const { error } = await supabase
      .from('students')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== GUARDIANS ====================

export const guardianService = {
  async listByStudent(studentId: UUID) {
    const { data, error } = await supabase
      .from('guardians')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at');
    if (error) throw error;
    return data as Guardian[];
  },

  async create(studentId: UUID, form: CreateGuardianForm) {
    const { data, error } = await supabase
      .from('guardians')
      .insert({
        student_id: studentId,
        relationship: form.relationship,
        full_name: form.fullName,
        email: form.email || null,
        phone: form.phone,
        address: form.address || null,
        occupation: form.occupation || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Guardian;
  },

  async update(id: UUID, form: Partial<CreateGuardianForm>) {
    const { data, error } = await supabase
      .from('guardians')
      .update({
        relationship: form.relationship,
        full_name: form.fullName,
        email: form.email || null,
        phone: form.phone,
        address: form.address || null,
        occupation: form.occupation || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Guardian;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('guardians').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== ENROLLMENTS ====================

export const enrollmentService = {
  async listByStudent(studentId: UUID) {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select('*')
      .eq('student_id', studentId)
      .order('enrollment_date', { ascending: false });
    if (error) throw error;
    return data as StudentEnrollment[];
  },

  async create(enrollment: Omit<StudentEnrollment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('student_enrollments')
      .insert(enrollment)
      .select()
      .single();
    if (error) throw error;
    return data as StudentEnrollment;
  },
};