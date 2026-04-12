import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  WaecExamSession,
  WaecCandidate,
  WaecCandidateSubject,
  WaecCandidateWithStudent,
  WaecExamType,
  RegistrationStatus,
  CreateExamSessionForm,
  RegisterCandidateForm,
} from '@/types/waec.types';

// ==================== EXAM SESSIONS ====================

export const waecSessionService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('waec_exam_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .order('exam_year', { ascending: false })
      .order('exam_type');
    if (error) throw error;
    return data as WaecExamSession[];
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('waec_exam_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as WaecExamSession;
  },

  async create(schoolId: UUID, form: CreateExamSessionForm) {
    const { data, error } = await supabase
      .from('waec_exam_sessions')
      .insert({
        school_id: schoolId,
        exam_type: form.examType,
        academic_year: form.academicYear,
        exam_year: form.examYear,
        registration_deadline: form.registrationDeadline,
        exam_start_date: form.examStartDate || null,
        exam_end_date: form.examEndDate || null,
        fee_per_candidate_usd: form.feePerCandidateUsd,
        fee_per_subject_usd: form.feePerSubjectUsd,
        notes: form.notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as WaecExamSession;
  },

  async update(id: UUID, form: Partial<CreateExamSessionForm>) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (form.examType !== undefined) payload.exam_type = form.examType;
    if (form.academicYear !== undefined) payload.academic_year = form.academicYear;
    if (form.examYear !== undefined) payload.exam_year = form.examYear;
    if (form.registrationDeadline !== undefined) payload.registration_deadline = form.registrationDeadline;
    if (form.examStartDate !== undefined) payload.exam_start_date = form.examStartDate || null;
    if (form.examEndDate !== undefined) payload.exam_end_date = form.examEndDate || null;
    if (form.feePerCandidateUsd !== undefined) payload.fee_per_candidate_usd = form.feePerCandidateUsd;
    if (form.feePerSubjectUsd !== undefined) payload.fee_per_subject_usd = form.feePerSubjectUsd;
    if (form.notes !== undefined) payload.notes = form.notes || null;

    const { data, error } = await supabase
      .from('waec_exam_sessions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as WaecExamSession;
  },

  async toggleActive(id: UUID, isActive: boolean) {
    const { error } = await supabase
      .from('waec_exam_sessions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== CANDIDATES ====================

export const waecCandidateService = {
  async list(sessionId: UUID) {
    const { data, error } = await supabase
      .from('waec_candidates_with_students')
      .select('*')
      .eq('session_id', sessionId)
      .order('last_name')
      .order('first_name');
    if (error) throw error;
    return data as WaecCandidateWithStudent[];
  },

  async listBySchool(schoolId: UUID, filters?: { examType?: WaecExamType; status?: RegistrationStatus }) {
    let query = supabase
      .from('waec_candidates_with_students')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (filters?.examType) query = query.eq('exam_type', filters.examType);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data as WaecCandidateWithStudent[];
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('waec_candidates')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as WaecCandidate;
  },

  async register(schoolId: UUID, form: RegisterCandidateForm, registeredBy: UUID) {
    // Insert candidate row
    const { data: candidate, error: candidateErr } = await supabase
      .from('waec_candidates')
      .insert({
        school_id: schoolId,
        session_id: form.sessionId,
        student_id: form.studentId,
        exam_type: form.examType,
        grade_level: form.gradeLevel,
        status: 'draft',
        registered_by: registeredBy,
      })
      .select()
      .single();
    if (candidateErr) throw candidateErr;

    // Insert subjects
    if (form.subjects.length > 0) {
      const subjects = form.subjects.map((s) => ({
        candidate_id: (candidate as WaecCandidate).id,
        subject_name: s.subjectName,
        subject_code: s.subjectCode,
        category: s.category,
      }));
      const { error: subErr } = await supabase.from('waec_candidate_subjects').insert(subjects);
      if (subErr) throw subErr;
    }

    return candidate as WaecCandidate;
  },

  async updateStatus(id: UUID, status: RegistrationStatus, extra?: { rejectionReason?: string }) {
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'submitted') payload.submitted_at = new Date().toISOString();
    if (status === 'confirmed') payload.confirmed_at = new Date().toISOString();
    if (status === 'rejected' && extra?.rejectionReason) {
      payload.rejection_reason = extra.rejectionReason;
    }

    const { data, error } = await supabase
      .from('waec_candidates')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as WaecCandidate;
  },

  async markFeePaid(id: UUID) {
    const { error } = await supabase
      .from('waec_candidates')
      .update({ registration_fee_paid: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('waec_candidates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== CANDIDATE SUBJECTS ====================

export const waecSubjectService = {
  async listByCandidate(candidateId: UUID) {
    const { data, error } = await supabase
      .from('waec_candidate_subjects')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('category')
      .order('subject_name');
    if (error) throw error;
    return data as WaecCandidateSubject[];
  },

  async add(candidateId: UUID, subjects: { subjectName: string; subjectCode: string; category: 'core' | 'elective' }[]) {
    const rows = subjects.map((s) => ({
      candidate_id: candidateId,
      subject_name: s.subjectName,
      subject_code: s.subjectCode,
      category: s.category,
    }));
    const { error } = await supabase.from('waec_candidate_subjects').insert(rows);
    if (error) throw error;
  },

  async remove(id: UUID) {
    const { error } = await supabase.from('waec_candidate_subjects').delete().eq('id', id);
    if (error) throw error;
  },
};
