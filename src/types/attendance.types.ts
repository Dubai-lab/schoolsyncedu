// ============================================================
// ATTENDANCE TYPES — Attendance records & summaries
// ============================================================

import type { UUID, Timestamp, ISODate } from './common.types';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unexcused' | 'medical_leave';

/** attendance_records table */
export interface AttendanceRecord {
  id: UUID;
  student_id: UUID;
  class_id: UUID;
  subject_id: UUID | null;
  attendance_date: ISODate;
  status: AttendanceStatus;
  marked_by: UUID;
  marked_at: Timestamp;
  notes: string | null;
}

/** attendance_summary view (migration 006 converted from table) */
export interface AttendanceSummary {
  student_id: UUID;
  academic_year: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  excused_days: number;
  attendance_percentage: number;
  last_updated: Timestamp | null;
}

// ==================== VIEW TYPES ====================

/** vw_attendance_summary_by_class */
export interface AttendanceSummaryByClass {
  class_id: UUID;
  school_id: UUID;
  class_name: string;
  term_id: UUID;
  term_name: string;
  total_students: number;
  total_attendance_records: number;
  attendance_percentage: number;
}

// ==================== FORMS ====================

export interface MarkAttendanceForm {
  classId: UUID;
  attendanceDate: ISODate;
  records: AttendanceEntry[];
}

export interface AttendanceEntry {
  studentId: UUID;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceFilterParams {
  classId?: UUID;
  subjectId?: UUID;
  studentId?: UUID;
  dateFrom?: ISODate;
  dateTo?: ISODate;
  status?: AttendanceStatus;
}