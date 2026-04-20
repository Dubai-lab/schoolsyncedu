import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  Grade,
  ReportCard,
  Transcript,
  GradeFilterParams,
  GradeReportSummary,
} from '@/types/grade.types';
import { GRADE_SCALE } from '@/utils/constants';

// ==================== HELPERS ====================

/** Derive letter_grade + gpa_points from a numeric score via GRADE_SCALE */
function deriveGrade(score: number): { letter_grade: string; gpa_points: number } {
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (score >= range.min && score <= range.max) {
      return { letter_grade: letter, gpa_points: range.gpa };
    }
  }
  return { letter_grade: 'F', gpa_points: 0 };
}

// ==================== GRADE SERVICE ====================

export const gradeService = {
  /** List grades with filters + pagination */
  async list(
    schoolId: UUID,
    params: GradeFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 25, studentId, classId, subjectId, academicYear, semester } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('grades')
      .select(
        `*, students!inner(id, first_name, last_name, registration_number), subjects!inner(id, name, code)`,
        { count: 'exact' },
      )
      .eq('school_id', schoolId)
      .order('entered_at', { ascending: false })
      .range(from, to);

    if (studentId) query = query.eq('student_id', studentId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (academicYear) query = query.eq('academic_year', academicYear);
    if (semester) query = query.eq('semester', semester);

    // classId filter: get student IDs in class first, then filter
    if (classId) {
      const { data: assignments } = await supabase
        .from('class_assignments')
        .select('student_id')
        .eq('class_id', classId)
        .is('removed_at', null);
      const studentIds = (assignments ?? []).map((a) => a.student_id);
      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      } else {
        return { data: [], count: 0 };
      }
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (Grade & { students: Record<string, unknown>; subjects: Record<string, unknown> })[], count: count ?? 0 };
  },

  /** Get a single grade by ID */
  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('grades')
      .select(`*, students(id, first_name, last_name), subjects(id, name, code)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Grade & { students: Record<string, unknown>; subjects: Record<string, unknown> };
  },

  /** Get subjects for a school */
  async getSubjects(schoolId: UUID) {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, code')
      .eq('school_id', schoolId)
      .order('name');
    if (error) throw error;
    return data as { id: string; name: string; code: string | null }[];
  },

  /** Get subjects assigned to a specific class */
  async getClassSubjects(classId: UUID) {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('id, subject_id, subjects(id, name, code)')
      .eq('class_id', classId);
    if (error) throw error;
    return (data ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      subject_id: d.subject_id as string,
      subjects: (Array.isArray(d.subjects) ? d.subjects[0] : d.subjects) as { id: string; name: string; code: string | null },
    }));
  },

  /** Get classes for a school (reuse from attendance) */
  async getClasses(schoolId: UUID) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade_level, section')
      .eq('school_id', schoolId)
      .order('grade_level')
      .order('name');
    if (error) throw error;
    return data as { id: string; name: string; grade_level: string | null; section: string | null }[];
  },

  /** Get students in a class */
  async getClassStudents(classId: UUID) {
    const { data, error } = await supabase
      .from('class_assignments')
      .select('student_id, students!inner(id, first_name, last_name, registration_number)')
      .eq('class_id', classId)
      .is('removed_at', null);
    if (error) throw error;
    return (data ?? [])
      .map((d: Record<string, unknown>) => ({
        student_id: d.student_id as string,
        students: (Array.isArray(d.students) ? d.students[0] : d.students) as { id: string; first_name: string; last_name: string; registration_number: string | null },
      }))
      .filter((r) => r.students != null);
  },

  /** Search students for transcript lookup (all enrolled students) */
  async searchStudents(schoolId: UUID, q: string) {
    let query = supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, date_of_birth, gender, enrollment_date, status')
      .eq('school_id', schoolId)
      .order('last_name');
    if (q.trim()) {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,registration_number.ilike.%${q}%`);
    }
    const { data, error } = await query.limit(60);
    if (error) throw error;
    return (data ?? []) as {
      id: string; first_name: string; last_name: string;
      registration_number: string | null; date_of_birth: string | null;
      gender: string | null; enrollment_date: string | null; status: string;
    }[];
  },

  /** Get academic years + grade levels a student was enrolled in (via class_assignments) */
  async getStudentAcademicYears(studentId: UUID) {
    const { data, error } = await supabase
      .from('class_assignments')
      .select('academic_year, classes!inner(name, grade_level)')
      .eq('student_id', studentId)
      .is('removed_at', null)
      .order('academic_year');
    if (error) throw error;
    return (data ?? []).map((item) => {
      const cls = Array.isArray((item as Record<string, unknown>).classes)
        ? ((item as Record<string, unknown>).classes as Record<string, string>[])[0]
        : (item as Record<string, unknown>).classes as Record<string, string> | null;
      return {
        academic_year: item.academic_year as string,
        grade_level: cls?.grade_level ?? cls?.name ?? null,
        class_name: cls?.name ?? null,
      };
    });
  },

  /** Enter / update a single grade */
  async upsertGrade(
    schoolId: UUID,
    entry: { student_id: UUID; subject_id: UUID; academic_year: string; semester: string; score: number; entered_by: UUID },
  ) {
    const { letter_grade, gpa_points } = deriveGrade(entry.score);

    const { data, error } = await supabase
      .from('grades')
      .upsert(
        {
          school_id: schoolId,
          student_id: entry.student_id,
          subject_id: entry.subject_id,
          academic_year: entry.academic_year,
          semester: entry.semester,
          score: entry.score,
          letter_grade,
          gpa_points,
          entered_by: entry.entered_by,
          entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_id,student_id,subject_id,academic_year,semester', ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw error;
    return data as Grade;
  },

  /** Bulk enter grades for a class + subject — accepts component scores,
   *  computes the final total automatically. */
  async bulkUpsertGrades(
    schoolId: UUID,
    _classId: UUID,
    subjectId: UUID,
    academicYear: string,
    semester: string,
    grades: {
      studentId: UUID;
      assignmentScore: number | null;
      quizScore: number | null;
      testScore: number | null;
      examScore: number | null;
      attendanceScore: number | null;
    }[],
    enteredBy: UUID,
  ) {
    // P3/P6: Assignment/20 + Quiz/20 + Test/50 + Attendance/10 + Exam/100 = 200 max
    // P1/P2/P4/P5: Assignment/20 + Quiz/20 + Test/50 + Attendance/10 = 100 max
    const EXAM_PERIODS = new Set(['p3', 'p6']);
    const isExam = EXAM_PERIODS.has(semester);
    const maxScore = isExam ? 200 : 100;

    const rows = grades
      .filter((g) =>
        g.assignmentScore !== null ||
        g.quizScore !== null ||
        g.testScore !== null ||
        g.attendanceScore !== null ||
        (isExam && g.examScore !== null),
      )
      .map((g) => {
        const total =
          (g.assignmentScore ?? 0) +
          (g.quizScore ?? 0) +
          (g.testScore ?? 0) +
          (g.attendanceScore ?? 0) +
          (isExam ? (g.examScore ?? 0) : 0);
        // Letter grade based on percentage of the period maximum
        const pct = maxScore > 0 ? (total / maxScore) * 100 : 0;
        const { letter_grade, gpa_points } = deriveGrade(pct);
        return {
          school_id:        schoolId,
          student_id:       g.studentId,
          subject_id:       subjectId,
          academic_year:    academicYear,
          semester:         semester,
          assignment_score: g.assignmentScore,
          quiz_score:       g.quizScore,
          test_score:       g.testScore,
          exam_score:       isExam ? g.examScore : null,
          attendance_score: g.attendanceScore, // always saved for all periods
          score:            total,
          letter_grade,
          gpa_points,
          status:           'draft',
          entered_by:       enteredBy,
          entered_at:       new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        };
      });

    if (rows.length === 0) return [];

    const { data, error } = await supabase
      .from('grades')
      .upsert(rows, { onConflict: 'school_id,student_id,subject_id,academic_year,semester', ignoreDuplicates: false })
      .select();
    if (error) throw error;
    return data as Grade[];
  },

  /** Get existing grades for a class + subject + term (for pre-filling the entry form) */
  async getClassGrades(classId: UUID, subjectId: UUID, academicYear: string, semester: string) {
    // First get students in the class
    const { data: assignments } = await supabase
      .from('class_assignments')
      .select('student_id')
      .eq('class_id', classId)
      .is('removed_at', null);
    const studentIds = (assignments ?? []).map((a) => a.student_id);
    if (studentIds.length === 0) return [];

    const { data, error } = await supabase
      .from('grades')
      .select('id, student_id, score, assignment_score, quiz_score, test_score, exam_score, attendance_score, status')
      .eq('subject_id', subjectId)
      .eq('academic_year', academicYear)
      .eq('semester', semester)
      .in('student_id', studentIds);
    if (error) throw error;
    return data as Pick<Grade, 'id' | 'student_id' | 'score' | 'assignment_score' | 'quiz_score' | 'test_score' | 'exam_score' | 'attendance_score' | 'status'>[];
  },

  /** Get grade report summary view */
  async getReportSummary(schoolId: UUID, params: { studentId?: UUID; classId?: UUID; academicYear?: string } = {}) {
    let query = supabase
      .from('vw_grade_report_summary')
      .select('*')
      .eq('school_id', schoolId);

    if (params.studentId) query = query.eq('student_id', params.studentId);
    if (params.classId) query = query.eq('class_id', params.classId);

    const { data, error } = await query;
    if (error) throw error;
    return data as GradeReportSummary[];
  },

  /**
   * Compute attendance score /10 for each student in a class over a date range.
   * present/late/excused/medical_leave = counted present; absent/unexcused = penalised.
   * Returns map of studentId → score (null if no records exist for that student).
   */
  async getClassAttendanceScores(classId: UUID, subjectId: UUID, dateFrom: string, dateTo: string): Promise<Record<string, number | null>> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .gte('attendance_date', dateFrom)
      .lte('attendance_date', dateTo);
    if (error) throw error;

    const map = new Map<string, { present: number; total: number }>();
    for (const rec of (data ?? [])) {
      if (!map.has(rec.student_id)) map.set(rec.student_id, { present: 0, total: 0 });
      const s = map.get(rec.student_id)!;
      s.total++;
      if (['present', 'late', 'excused', 'medical_leave'].includes(rec.status)) s.present++;
    }

    const scores: Record<string, number | null> = {};
    for (const [studentId, { present, total }] of map) {
      scores[studentId] = total > 0 ? Math.round((present / total) * 10 * 10) / 10 : null;
    }
    return scores;
  },

  /** Get student's grades for all subjects in a term (for report card) */
  async getStudentTermGrades(studentId: UUID, academicYear: string, semester: string) {
    const { data, error } = await supabase
      .from('grades')
      .select('*, subjects(id, name, code)')
      .eq('student_id', studentId)
      .eq('academic_year', academicYear)
      .eq('semester', semester)
      .order('subjects(name)');
    if (error) throw error;
    return data as (Grade & { subjects: { id: string; name: string; code: string | null } })[];
  },

  /** List report cards */
  async listReportCards(studentId: UUID) {
    const { data, error } = await supabase
      .from('report_cards')
      .select('*, students(id, first_name, last_name)')
      .eq('student_id', studentId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return data as (ReportCard & { students: Record<string, unknown> })[];
  },

  /** Generate / save a report card record */
  async generateReportCard(entry: { student_id: UUID; academic_year: string; semester: string; generated_by: UUID }) {
    const { data, error } = await supabase
      .from('report_cards')
      .insert({
        student_id: entry.student_id,
        academic_year: entry.academic_year,
        semester: entry.semester,
        generated_by: entry.generated_by,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as ReportCard;
  },

  /** List transcripts for a student */
  async listTranscripts(studentId: UUID) {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('student_id', studentId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return data as Transcript[];
  },

  /** Generate a transcript */
  async generateTranscript(entry: { student_id: UUID; academic_record: Record<string, unknown>; overall_gpa: number; generated_by: UUID }) {
    const { data, error } = await supabase
      .from('transcripts')
      .insert({
        student_id: entry.student_id,
        academic_record: entry.academic_record,
        overall_gpa: entry.overall_gpa,
        generated_by: entry.generated_by,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as Transcript;
  },

  // ==================== GRADE APPROVAL ====================

  /** Submit grades for principal approval (teacher action) */
  async submitGradesForApproval(gradeIds: UUID[]) {
    const { data, error } = await supabase.rpc('submit_grades_for_approval', {
      p_grade_ids: gradeIds,
    });
    if (error) throw error;
    return data;
  },

  /** List grades pending approval (principal view) */
  async listPendingApproval(schoolId: UUID, params: { classId?: UUID; subjectId?: UUID; academicYear?: string } = {}) {
    let query = supabase
      .from('grades')
      .select('*, students!inner(id, first_name, last_name, registration_number), subjects!inner(id, name, code), entered_user:entered_by(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('status', 'submitted')
      .order('entered_at', { ascending: false });

    if (params.subjectId) query = query.eq('subject_id', params.subjectId);
    if (params.academicYear) query = query.eq('academic_year', params.academicYear);

    if (params.classId) {
      const { data: assignments } = await supabase
        .from('class_assignments')
        .select('student_id')
        .eq('class_id', params.classId)
        .is('removed_at', null);
      const studentIds = (assignments ?? []).map((a) => a.student_id);
      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      } else {
        return [];
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as (Grade & { students: Record<string, unknown>; subjects: Record<string, unknown>; entered_user: Record<string, unknown> | null })[];
  },

  /** Approve grades (principal action) */
  async approveGrades(gradeIds: UUID[], approvedBy: UUID) {
    const { data, error } = await supabase.rpc('approve_grades', {
      p_grade_ids:   gradeIds,
      p_approved_by: approvedBy,
    });
    if (error) throw error;
    return data;
  },

  /** Reject grades with reason (principal action) */
  async rejectGrades(gradeIds: UUID[], approvedBy: UUID, reason: string) {
    const { data, error } = await supabase.rpc('reject_grades', {
      p_grade_ids:   gradeIds,
      p_approved_by: approvedBy,
      p_reason:      reason,
    });
    if (error) throw error;
    return data;
  },
};