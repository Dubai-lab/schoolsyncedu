import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

const PASS_MARK = 50; // scores below this are considered failing

// ==================== TYPES ====================

export type PromotionOutcome = 'promoted' | 'retained' | 'graduated';

export interface StudentGradeSummary {
  student_id: UUID;
  first_name: string;
  last_name: string;
  registration_number: string;
  current_grade_level: string;
  subject_count: number;
  subjects_passed: number;
  average_score: number | null;
  suggested_outcome: PromotionOutcome;
}

export interface PromotionDecision {
  student_id: UUID;
  outcome: PromotionOutcome;
  notes: string;
}

export interface StudentPromotion {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  academic_year: string;
  from_grade_level: string;
  to_grade_level: string | null;
  outcome: PromotionOutcome;
  grade_average: number | null;
  notes: string | null;
  processed_at: string;
  students?: { first_name: string; last_name: string; registration_number: string; current_grade_level: string };
  users?: { full_name: string };
}

// Grade levels in order — used to compute "next grade"
const GRADE_ORDER = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
];

export function getNextGradeLevel(current: string): string | null {
  const idx = GRADE_ORDER.findIndex((g) => g.toLowerCase() === current.toLowerCase());
  if (idx === -1 || idx === GRADE_ORDER.length - 1) return null; // last grade → graduates
  return GRADE_ORDER[idx + 1];
}

export function isFinalGrade(grade: string): boolean {
  return getNextGradeLevel(grade) === null;
}

// ==================== SERVICE ====================

export const promotionService = {

  /** Get all students with their grade summary for a given academic year */
  async getStudentsWithGrades(schoolId: UUID, academicYear: string): Promise<StudentGradeSummary[]> {
    // Fetch enrolled students
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, current_grade_level')
      .eq('school_id', schoolId)
      .eq('status', 'enrolled')
      .order('current_grade_level')
      .order('last_name');
    if (sErr) throw sErr;
    if (!students || students.length === 0) return [];

    // Fetch approved grades for this academic year
    const { data: grades, error: gErr } = await supabase
      .from('grades')
      .select('student_id, score')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .eq('status', 'approved');
    if (gErr) throw gErr;

    // Check if promotion already ran for this year
    const { data: existing } = await supabase
      .from('student_promotions')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear);
    const promotedIds = new Set((existing ?? []).map((p) => p.student_id));

    // Build per-student grade aggregates
    const gradeMap = new Map<string, { total: number; sum: number; passed: number }>();
    for (const g of grades ?? []) {
      if (!gradeMap.has(g.student_id)) gradeMap.set(g.student_id, { total: 0, sum: 0, passed: 0 });
      const entry = gradeMap.get(g.student_id)!;
      if (g.score !== null) {
        entry.total++;
        entry.sum += g.score;
        if (g.score >= PASS_MARK) entry.passed++;
      }
    }

    return students
      .filter((s) => !promotedIds.has(s.id)) // exclude already-processed
      .map((s) => {
        const g = gradeMap.get(s.id);
        const avg = g && g.total > 0 ? Math.round((g.sum / g.total) * 10) / 10 : null;
        const passed = g ? g.passed : 0;
        const total = g ? g.total : 0;
        const final = isFinalGrade(s.current_grade_level ?? '');

        let suggested: PromotionOutcome;
        if (final) {
          suggested = 'graduated';
        } else if (avg !== null && avg < PASS_MARK) {
          suggested = 'retained';
        } else {
          suggested = 'promoted';
        }

        return {
          student_id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          registration_number: s.registration_number,
          current_grade_level: s.current_grade_level ?? '',
          subject_count: total,
          subjects_passed: passed,
          average_score: avg,
          suggested_outcome: suggested,
        };
      });
  },

  /** Save promotion decisions and update student grade levels */
  async savePromotions(
    schoolId: UUID,
    academicYear: string,
    decisions: PromotionDecision[],
    processedBy: UUID,
  ): Promise<void> {
    if (decisions.length === 0) return;

    // Fetch current grade levels for all students
    const ids = decisions.map((d) => d.student_id);
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, current_grade_level')
      .in('id', ids);
    if (sErr) throw sErr;

    const gradeMap = new Map((students ?? []).map((s) => [s.id, s.current_grade_level ?? '']));

    // Build promotion records
    const records = decisions.map((d) => {
      const fromGrade = gradeMap.get(d.student_id) ?? '';
      const toGrade = d.outcome === 'graduated' ? null : d.outcome === 'retained' ? fromGrade : getNextGradeLevel(fromGrade);
      return {
        school_id: schoolId,
        student_id: d.student_id,
        academic_year: academicYear,
        from_grade_level: fromGrade,
        to_grade_level: toGrade,
        outcome: d.outcome,
        notes: d.notes || null,
        processed_by: processedBy,
      };
    });

    // Insert promotion records
    const { error: iErr } = await supabase.from('student_promotions').insert(records);
    if (iErr) throw iErr;

    // Update each student's grade level and status
    for (const d of decisions) {
      const fromGrade = gradeMap.get(d.student_id) ?? '';
      const toGrade = d.outcome === 'graduated' ? null : d.outcome === 'retained' ? fromGrade : getNextGradeLevel(fromGrade);
      const newStatus = d.outcome === 'graduated' ? 'graduated' : 'enrolled';

      const update: Record<string, unknown> = { status: newStatus };
      if (toGrade) update.current_grade_level = toGrade;

      await supabase.from('students').update(update).eq('id', d.student_id);
    }
  },

  /** List all promotion records for a school (history view) */
  async listHistory(schoolId: UUID): Promise<StudentPromotion[]> {
    const { data, error } = await supabase
      .from('student_promotions')
      .select('*, students(first_name, last_name, registration_number, current_grade_level), users(full_name)')
      .eq('school_id', schoolId)
      .order('processed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StudentPromotion[];
  },

  /** Get unique academic years that have grades */
  async getAcademicYearsWithGrades(schoolId: UUID): Promise<string[]> {
    const { data, error } = await supabase
      .from('grades')
      .select('academic_year')
      .eq('school_id', schoolId)
      .eq('status', 'approved');
    if (error) throw error;
    const years = [...new Set((data ?? []).map((g) => g.academic_year as string))].sort().reverse();
    return years;
  },
};
