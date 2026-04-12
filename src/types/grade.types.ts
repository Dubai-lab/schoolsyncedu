// ============================================================
// GRADE TYPES — Grades, report cards, transcripts, promotions
// ============================================================

import type { UUID, Timestamp, ISODate, SchoolScopedEntity } from './common.types';

/** grades table */
export interface Grade extends SchoolScopedEntity {
  student_id: UUID;
  subject_id: UUID;
  academic_year: string;
  semester: string;
  // Component scores (Liberian grading: Assignment/20 + Quiz/20 + Test/20 + Exam/40 = 100)
  assignment_score: number | null;
  quiz_score:       number | null;
  test_score:       number | null;
  exam_score:       number | null;
  // Final computed total (sum of components, out of 100)
  score: number;
  letter_grade: string;
  gpa_points: number;
  entered_by: UUID;
  entered_at: Timestamp;
  updated_at: Timestamp;
  status: GradeStatus;
  approved_by: UUID | null;
  approved_at: Timestamp | null;
  rejection_reason: string | null;
}

export type GradeStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/** report_cards table */
export interface ReportCard {
  id: UUID;
  student_id: UUID;
  academic_year: string;
  semester: string;
  generated_by: UUID;
  pdf_url: string | null;
  generated_at: Timestamp;
}

/** transcripts table */
export interface Transcript {
  id: UUID;
  student_id: UUID;
  academic_record: Record<string, unknown>;
  overall_gpa: number;
  generated_by: UUID;
  generated_at: Timestamp;
}

/** promotion_records table */
export interface PromotionRecord {
  id: UUID;
  student_id: UUID;
  from_grade: string;
  to_grade: string;
  academic_year: string;
  promotion_date: ISODate;
  approved_by: UUID;
}

// ==================== VIEW TYPES ====================

/** vw_grade_report_summary */
export interface GradeReportSummary {
  student_id: UUID;
  school_id: UUID;
  first_name: string;
  last_name: string;
  class_id: UUID | null;
  class_name: string | null;
  term_name: string | null;
  subject_count: number;
  average_gpa: number | null;
  highest_grade: number | null;
  lowest_grade: number | null;
  term_start: ISODate | null;
  term_end: ISODate | null;
  generated_at: Timestamp;
}

// ==================== FORMS ====================

export interface EnterGradeForm {
  studentId: UUID;
  subjectId: UUID;
  academicYear: string;
  semester: string;
  score: number;
}

export interface BulkGradeEntry {
  classId: UUID;
  subjectId: UUID;
  academicYear: string;
  semester: string;
  grades: { studentId: UUID; score: number }[];
}

export interface GradeFilterParams {
  studentId?: UUID;
  classId?: UUID;
  subjectId?: UUID;
  academicYear?: string;
  semester?: string;
}