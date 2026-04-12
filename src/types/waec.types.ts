// ============================================================
// WAEC TYPES — Exam registration for LJHSCE (Grade 9) & WASSCE (Grade 12)
// ============================================================

import type { UUID, Timestamp, ISODate } from './common.types';

/** WAEC exam types administered in Liberia */
export type WaecExamType = 'LJHSCE' | 'WASSCE';

/** Registration status lifecycle */
export type RegistrationStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_confirmed'
  | 'submitted'
  | 'confirmed'
  | 'rejected';

/** WAEC standard subjects for Liberia */
export type WaecSubjectCategory = 'core' | 'elective';

// ==================== TABLE TYPES ====================

/** waec_exam_sessions table */
export interface WaecExamSession {
  id: UUID;
  school_id: UUID;
  exam_type: WaecExamType;
  academic_year: string;
  exam_year: number;
  registration_deadline: ISODate;
  exam_start_date: ISODate | null;
  exam_end_date: ISODate | null;
  fee_per_candidate_usd: number;
  fee_per_subject_usd: number;
  is_active: boolean;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** waec_candidates table */
export interface WaecCandidate {
  id: UUID;
  school_id: UUID;
  session_id: UUID;
  student_id: UUID;
  candidate_number: string | null;
  exam_type: WaecExamType;
  grade_level: string;
  status: RegistrationStatus;
  registration_fee_paid: boolean;
  registered_by: UUID;
  submitted_at: Timestamp | null;
  confirmed_at: Timestamp | null;
  rejection_reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** waec_candidate_subjects table */
export interface WaecCandidateSubject {
  id: UUID;
  candidate_id: UUID;
  subject_name: string;
  subject_code: string;
  category: WaecSubjectCategory;
  created_at: Timestamp;
}

// ==================== VIEW / JOIN TYPES ====================

/** Candidate with student details (joined) */
export interface WaecCandidateWithStudent extends WaecCandidate {
  first_name: string;
  last_name: string;
  class_name: string | null;
  subject_count: number;
}

// ==================== FORMS ====================

export interface CreateExamSessionForm {
  examType: WaecExamType;
  academicYear: string;
  examYear: number;
  registrationDeadline: string;
  examStartDate?: string;
  examEndDate?: string;
  feePerCandidateUsd: number;
  feePerSubjectUsd: number;
  notes?: string;
}

export interface RegisterCandidateForm {
  sessionId: UUID;
  studentId: UUID;
  examType: WaecExamType;
  gradeLevel: string;
  subjects: { subjectName: string; subjectCode: string; category: WaecSubjectCategory }[];
}

// ==================== CONSTANTS ====================

export const WAEC_EXAM_LABELS: Record<WaecExamType, string> = {
  LJHSCE: 'Liberia Junior High School Certificate Examination (Grade 9)',
  WASSCE: 'West African Senior School Certificate Examination (Grade 12)',
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  payment_confirmed: 'Payment Confirmed',
  submitted: 'Submitted to WAEC',
  confirmed: 'Confirmed by WAEC',
  rejected: 'Rejected',
};

/** Common WASSCE subjects offered in Liberia */
export const WASSCE_SUBJECTS = [
  { code: 'ENG', name: 'English Language', category: 'core' as const },
  { code: 'MTH', name: 'Mathematics', category: 'core' as const },
  { code: 'INT', name: 'Integrated Science', category: 'core' as const },
  { code: 'SST', name: 'Social Studies', category: 'core' as const },
  { code: 'BIO', name: 'Biology', category: 'elective' as const },
  { code: 'CHM', name: 'Chemistry', category: 'elective' as const },
  { code: 'PHY', name: 'Physics', category: 'elective' as const },
  { code: 'ECO', name: 'Economics', category: 'elective' as const },
  { code: 'GOV', name: 'Government', category: 'elective' as const },
  { code: 'LIT', name: 'Literature in English', category: 'elective' as const },
  { code: 'GEO', name: 'Geography', category: 'elective' as const },
  { code: 'ACC', name: 'Accounting', category: 'elective' as const },
  { code: 'AGR', name: 'Agricultural Science', category: 'elective' as const },
  { code: 'FRN', name: 'French', category: 'elective' as const },
  { code: 'CRK', name: 'Christian Religious Knowledge', category: 'elective' as const },
  { code: 'HIS', name: 'History', category: 'elective' as const },
];

/** Common LJHSCE subjects for Grade 9 */
export const LJHSCE_SUBJECTS = [
  { code: 'ENG', name: 'English Language', category: 'core' as const },
  { code: 'MTH', name: 'Mathematics', category: 'core' as const },
  { code: 'GEN', name: 'General Science', category: 'core' as const },
  { code: 'SST', name: 'Social Studies', category: 'core' as const },
  { code: 'CIV', name: 'Civics', category: 'elective' as const },
  { code: 'AGR', name: 'Agricultural Science', category: 'elective' as const },
  { code: 'HEC', name: 'Home Economics', category: 'elective' as const },
  { code: 'FRN', name: 'French', category: 'elective' as const },
  { code: 'ART', name: 'Fine Arts', category: 'elective' as const },
];
