import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

const PASS_MARK = 50;

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

export interface PromotedPendingAssignment {
  student_id: UUID;
  first_name: string;
  last_name: string;
  registration_number: string;
  from_grade_level: string;
  next_year: string;
  outcome: 'promoted' | 'retained';
  reg_fee_paid: boolean;
  reg_fee_amount: number;
  promoted_at: string;
}

// ==================== SERVICE ====================

export const promotionService = {

  /** Get all enrolled students with their grade summary for a given academic year.
   *  Suggested outcome is computed from grades — the Registrar can override any decision. */
  async getStudentsWithGrades(schoolId: UUID, academicYear: string): Promise<StudentGradeSummary[]> {
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, current_grade_level')
      .eq('school_id', schoolId)
      .eq('status', 'enrolled')
      .order('current_grade_level')
      .order('last_name');
    if (sErr) throw sErr;
    if (!students || students.length === 0) return [];

    const { data: grades, error: gErr } = await supabase
      .from('grades')
      .select('student_id, score')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .eq('status', 'approved');
    if (gErr) throw gErr;

    // Exclude students already processed for this year
    const { data: existing } = await supabase
      .from('student_promotions')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear);
    const promotedIds = new Set((existing ?? []).map((p) => p.student_id));

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
      .filter((s) => !promotedIds.has(s.id))
      .map((s) => {
        const g = gradeMap.get(s.id);
        const avg = g && g.total > 0 ? Math.round((g.sum / g.total) * 10) / 10 : null;

        // Suggest based on grades only — the Registrar decides who graduates manually
        let suggested: PromotionOutcome;
        if (avg !== null && avg < PASS_MARK) {
          suggested = 'retained';
        } else {
          suggested = 'promoted';
        }

        return {
          student_id:        s.id,
          first_name:        s.first_name,
          last_name:         s.last_name,
          registration_number: s.registration_number,
          current_grade_level: s.current_grade_level ?? '',
          subject_count:     g ? g.total : 0,
          subjects_passed:   g ? g.passed : 0,
          average_score:     avg,
          suggested_outcome: suggested,
        };
      });
  },

  /** Process year-end promotion via server-side RPC.
   *  Creates next-year enrollments for promoted students, sets graduated status,
   *  and assigns the school-wide registration fee for the next year if one exists. */
  async processPromotion(
    schoolId: UUID,
    academicYear: string,
    nextYear: string,
    decisions: PromotionDecision[],
    processedBy: UUID,
  ): Promise<{ promoted: number; retained: number; graduated: number; message: string }> {
    if (decisions.length === 0) throw new Error('No decisions provided');

    const { data, error } = await supabase.rpc('process_year_end_promotion', {
      p_school_id:     schoolId,
      p_academic_year: academicYear,
      p_next_year:     nextYear,
      p_decisions:     decisions.map((d) => ({
        student_id: d.student_id,
        outcome:    d.outcome,
        notes:      d.notes || '',
      })),
      p_processed_by:  processedBy,
    });
    if (error) throw new Error(error.message);
    return data as { promoted: number; retained: number; graduated: number; message: string };
  },

  /** List promoted students whose next-year enrollment is still pending_payment
   *  (i.e. they are waiting for class assignment by the Registrar). */
  async listPendingAssignment(schoolId: UUID): Promise<PromotedPendingAssignment[]> {
    const { data, error } = await supabase.rpc('list_promoted_pending_assignment', {
      p_school_id: schoolId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as PromotedPendingAssignment[];
  },

  /** Assign a promoted student to a class for the new year.
   *  Updates grade level, creates class assignment, assigns all class fees,
   *  and activates the next-year enrollment. */
  async assignToClass(
    studentId: UUID,
    classId: UUID | null,  // null = retained student, uses current class
    nextYear: string,
  ): Promise<{ class_name: string; grade_level: string; fees_assigned: number; message: string }> {
    const { data, error } = await supabase.rpc('assign_promoted_student_to_class', {
      p_student_id: studentId,
      p_class_id:   classId,
      p_next_year:  nextYear,
    });
    if (error) throw new Error(error.message);
    return data as { class_name: string; grade_level: string; fees_assigned: number; message: string };
  },

  /** List promotion history for a school. */
  async listHistory(schoolId: UUID): Promise<StudentPromotion[]> {
    const { data, error } = await supabase
      .from('student_promotions')
      .select('*, students(first_name, last_name, registration_number, current_grade_level), users(full_name)')
      .eq('school_id', schoolId)
      .order('processed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StudentPromotion[];
  },

  /** Academic years available for promotion (from approved grades + current setting). */
  async getAcademicYearsWithGrades(schoolId: UUID): Promise<string[]> {
    const { data: gradesData } = await supabase
      .from('grades')
      .select('academic_year')
      .eq('school_id', schoolId)
      .eq('status', 'approved');

    const { data: settingData } = await supabase
      .from('school_settings')
      .select('setting_value')
      .eq('school_id', schoolId)
      .eq('setting_key', 'current_academic_year')
      .maybeSingle();

    const fromGrades = (gradesData ?? []).map((g) => g.academic_year as string).filter(Boolean);
    const currentYear = settingData?.setting_value ?? null;

    const allYears = new Set(fromGrades);
    if (currentYear) allYears.add(currentYear);

    return [...allYears].sort().reverse();
  },

  /** Read the next_academic_year setting (IT Admin can configure this). */
  async getNextAcademicYear(schoolId: UUID): Promise<string | null> {
    const { data } = await supabase
      .from('school_settings')
      .select('setting_value')
      .eq('school_id', schoolId)
      .eq('setting_key', 'next_academic_year')
      .maybeSingle();
    return data?.setting_value ?? null;
  },
};
