import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  Class,
  ClassAssignment,
  Subject,
  ClassSubject,
  TimetableEntry,
  AcademicCalendar,
} from '@/types/school.types';
import type { DayOfWeek } from '@/types/common.types';

// ==================== CLASSES ====================

export const classService = {
  async list(schoolId: UUID, gradeLevel?: string) {
    let query = supabase
      .from('classes')
      .select('*, users!classes_class_teacher_id_fkey(id, first_name, last_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('grade_level')
      .order('name');
    if (gradeLevel) query = query.eq('grade_level', gradeLevel);
    const { data, count, error } = await query;
    if (error) throw error;
    return {
      data: data as (Class & { users: Record<string, string> | null })[],
      count: count ?? 0,
    };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('classes')
      .select('*, users!classes_class_teacher_id_fkey(id, first_name, last_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Class & { users: Record<string, string> | null };
  },

  async create(schoolId: UUID, entry: {
    name: string; grade_level: string; section?: string;
    class_teacher_id?: UUID; capacity: number;
  }) {
    const { data, error } = await supabase
      .from('classes')
      .insert({ school_id: schoolId, ...entry })
      .select()
      .single();
    if (error) throw error;
    return data as Class;
  },

  async update(id: UUID, entry: Partial<{
    name: string; grade_level: string; section: string;
    class_teacher_id: UUID; capacity: number;
  }>) {
    const { data, error } = await supabase
      .from('classes')
      .update({ ...entry, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Class;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },

  async getGradeLevels(schoolId: UUID) {
    const { data, error } = await supabase
      .from('classes')
      .select('grade_level')
      .eq('school_id', schoolId)
      .not('grade_level', 'is', null);
    if (error) throw error;
    return [...new Set((data ?? []).map((d) => d.grade_level as string))].sort();
  },

};

// ==================== CLASS ASSIGNMENTS ====================

export const classAssignmentService = {
  async listByClass(classId: UUID, academicYear?: string) {
    let query = supabase
      .from('class_assignments')
      .select('*, students!inner(id, first_name, last_name, registration_number)')
      .eq('class_id', classId)
      .is('removed_at', null)
      .order('assigned_at', { ascending: false });
    if (academicYear) query = query.eq('academic_year', academicYear);
    const { data, error } = await query;
    if (error) throw error;
    return data as (ClassAssignment & { students: Record<string, string> })[]; 
  },

  async assign(classId: UUID, studentId: UUID, academicYear: string) {
    const { data, error } = await supabase
      .from('class_assignments')
      .insert({ class_id: classId, student_id: studentId, academic_year: academicYear })
      .select()
      .single();
    if (error) throw error;
    return data as ClassAssignment;
  },

  async remove(id: UUID) {
    const { error } = await supabase
      .from('class_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async getCount(classId: UUID) {
    const { count, error } = await supabase
      .from('class_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .is('removed_at', null);
    if (error) throw error;
    return count ?? 0;
  },
};

// ==================== SUBJECTS ====================

export const subjectService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('subjects')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('name');
    if (error) throw error;
    return { data: data as Subject[], count: (data ?? []).length };
  },

  async create(schoolId: UUID, entry: { name: string; code: string; description?: string }) {
    const { data, error } = await supabase
      .from('subjects')
      .insert({ school_id: schoolId, ...entry })
      .select()
      .single();
    if (error) throw error;
    return data as Subject;
  },

  async update(id: UUID, entry: Partial<{ name: string; code: string; description: string }>) {
    const { data, error } = await supabase
      .from('subjects')
      .update(entry)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Subject;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== CLASS SUBJECTS ====================

export const classSubjectService = {
  async listByClass(classId: UUID, academicYear?: string) {
    let query = supabase
      .from('class_subjects')
      .select('*, subjects(id, name, code), users:teacher_id(id, first_name, last_name)')
      .eq('class_id', classId);
    if (academicYear) query = query.eq('academic_year', academicYear);
    const { data, error } = await query;
    if (error) throw error;
    return data as (ClassSubject & { subjects: Record<string, string>; users: Record<string, string> | null })[];
  },

  async assign(entry: { class_id: UUID; subject_id: UUID; teacher_id: UUID; academic_year: string }) {
    const { data, error } = await supabase
      .from('class_subjects')
      .insert(entry)
      .select()
      .single();
    if (error) throw error;
    return data as ClassSubject;
  },

  async remove(id: UUID) {
    const { error } = await supabase.from('class_subjects').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== TIMETABLE ====================

export const timetableService = {
  async listByClass(classId: UUID, academicYear?: string) {
    let query = supabase
      .from('timetables')
      .select('*, subjects(id, name, code), users:teacher_id(id, first_name, last_name)')
      .eq('class_id', classId)
      .order('day_of_week')
      .order('start_time');
    if (academicYear) query = query.eq('academic_year', academicYear);
    const { data, error } = await query;
    if (error) throw error;
    return data as (TimetableEntry & { subjects: Record<string, string> | null; users: Record<string, string> | null })[];
  },

  async create(entry: {
    class_id: UUID; academic_year: string; day_of_week: DayOfWeek;
    start_time: string; end_time: string; subject_id: UUID; teacher_id: UUID; location?: string;
  }) {
    const { data, error } = await supabase
      .from('timetables')
      .insert(entry)
      .select()
      .single();
    if (error) throw error;
    return data as TimetableEntry;
  },

  async update(id: UUID, entry: Partial<{
    day_of_week: DayOfWeek; start_time: string; end_time: string;
    subject_id: UUID; teacher_id: UUID; location: string;
  }>) {
    const { data, error } = await supabase
      .from('timetables')
      .update(entry)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TimetableEntry;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('timetables').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== ACADEMIC CALENDAR ====================

// Semester + period definitions for the Liberian 2-semester / 6-period system
const SEMESTER_PERIOD_TEMPLATE = [
  { term_name: 'semester_1', period_type: 'semester',        period_number: 1, semester_number: null },
  { term_name: 'p1',         period_type: 'marking_period',  period_number: 1, semester_number: 1 },
  { term_name: 'p2',         period_type: 'marking_period',  period_number: 2, semester_number: 1 },
  { term_name: 'p3',         period_type: 'marking_period',  period_number: 3, semester_number: 1 },
  { term_name: 'semester_2', period_type: 'semester',        period_number: 2, semester_number: null },
  { term_name: 'p4',         period_type: 'marking_period',  period_number: 4, semester_number: 2 },
  { term_name: 'p5',         period_type: 'marking_period',  period_number: 5, semester_number: 2 },
  { term_name: 'p6',         period_type: 'marking_period',  period_number: 6, semester_number: 2 },
] as const;

export const academicCalendarService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false })
      .order('period_number');
    if (error) throw error;
    return data as AcademicCalendar[];
  },

  /** Get only marking periods (p1–p6) for a given year — used by grade entry */
  async listPeriods(schoolId: UUID, academicYear: string) {
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .eq('period_type', 'marking_period')
      .order('period_number');
    if (error) throw error;
    return data as AcademicCalendar[];
  },

  /**
   * Auto-initialize 2 semesters + 6 marking periods for the given academic year.
   * Skips rows that already exist (upsert on school_id + academic_year + term_name).
   */
  async initializeForYear(schoolId: UUID, academicYear: string) {
    const rows = SEMESTER_PERIOD_TEMPLATE.map((t) => ({
      school_id:       schoolId,
      academic_year:   academicYear,
      term_name:       t.term_name,
      period_type:     t.period_type,
      period_number:   t.period_number,
      semester_number: t.semester_number,
      start_date:      null,
      end_date:        null,
      holidays:        [],
    }));

    const { error } = await supabase
      .from('academic_calendar')
      .upsert(rows, { onConflict: 'school_id,academic_year,term_name', ignoreDuplicates: true });
    if (error) throw error;
  },

  /** Update start/end dates for a semester or marking period row */
  async updateDates(id: UUID, startDate: string | null, endDate: string | null) {
    const { data, error } = await supabase
      .from('academic_calendar')
      .update({ start_date: startDate, end_date: endDate })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AcademicCalendar;
  },

  async create(schoolId: UUID, entry: {
    academic_year: string;
    term_name: string;
    start_date: string;
    end_date: string;
    period_type?: string;
    period_number?: number;
    semester_number?: number | null;
    holidays?: Record<string, unknown>[];
  }) {
    const { data, error } = await supabase
      .from('academic_calendar')
      .insert({
        school_id:       schoolId,
        ...entry,
        period_type:     entry.period_type     ?? 'marking_period',
        period_number:   entry.period_number   ?? null,
        semester_number: entry.semester_number ?? null,
        holidays:        entry.holidays        ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return data as AcademicCalendar;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('academic_calendar').delete().eq('id', id);
    if (error) throw error;
  },
};
