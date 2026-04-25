import { supabase } from '@/lib/supabase';

export type ExamEntryType = 'test' | 'exam';

export interface ExamTimetableEntry {
  id: string;
  school_id: string;
  class_id: string;
  academic_year: string;
  term_name: string;          // 'p1' through 'p6'
  period_number: number;      // 1–6
  semester_number: number;    // 1 or 2
  entry_type: ExamEntryType;
  subject_id: string | null;
  teacher_id: string | null;
  exam_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subjects?: { id: string; name: string; code: string } | null;
  users?: { id: string; first_name: string; last_name: string } | null;
  classes?: { id: string; name: string; grade_level: string } | null;
}

// Period metadata — matches the SEMESTER_PERIOD_TEMPLATE in classService
export const EXAM_PERIODS = [
  { term_name: 'p1', period_number: 1, semester_number: 1, label: 'Period 1', has_exam: false },
  { term_name: 'p2', period_number: 2, semester_number: 1, label: 'Period 2', has_exam: false },
  { term_name: 'p3', period_number: 3, semester_number: 1, label: 'Period 3', has_exam: true  },
  { term_name: 'p4', period_number: 4, semester_number: 2, label: 'Period 4', has_exam: false },
  { term_name: 'p5', period_number: 5, semester_number: 2, label: 'Period 5', has_exam: false },
  { term_name: 'p6', period_number: 6, semester_number: 2, label: 'Period 6', has_exam: true  },
] as const;

export const examTimetableService = {
  async listByClass(classId: string, academicYear: string): Promise<ExamTimetableEntry[]> {
    const { data, error } = await supabase
      .from('exam_timetables')
      .select('*, subjects(id, name, code), users:teacher_id(id, first_name, last_name)')
      .eq('class_id', classId)
      .eq('academic_year', academicYear)
      .order('period_number', { ascending: true })
      .order('exam_date',     { ascending: true, nullsFirst: false })
      .order('start_time',    { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as ExamTimetableEntry[];
  },

  async listByTeacher(
    teacherId: string,
    schoolId: string,
    academicYear: string,
  ): Promise<ExamTimetableEntry[]> {
    const { data, error } = await supabase
      .from('exam_timetables')
      .select('*, subjects(id, name, code), classes(id, name, grade_level)')
      .eq('teacher_id', teacherId)
      .eq('school_id',  schoolId)
      .eq('academic_year', academicYear)
      .order('period_number', { ascending: true })
      .order('exam_date',     { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as ExamTimetableEntry[];
  },

  async listBySchool(schoolId: string, academicYear: string): Promise<ExamTimetableEntry[]> {
    const { data, error } = await supabase
      .from('exam_timetables')
      .select('*, subjects(id, name, code), users:teacher_id(id, first_name, last_name), classes(id, name, grade_level)')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .order('period_number', { ascending: true })
      .order('exam_date',     { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as ExamTimetableEntry[];
  },

  async create(entry: {
    school_id: string;
    class_id: string;
    academic_year: string;
    term_name: string;
    period_number: number;
    semester_number: number;
    entry_type: ExamEntryType;
    subject_id: string;
    teacher_id?: string;
    exam_date?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    notes?: string;
  }): Promise<ExamTimetableEntry> {
    const { data, error } = await supabase
      .from('exam_timetables')
      .insert(entry)
      .select('*, subjects(id, name, code), users:teacher_id(id, first_name, last_name)')
      .single();
    if (error) throw error;
    return data as ExamTimetableEntry;
  },

  async update(
    id: string,
    entry: Partial<{
      entry_type: ExamEntryType;
      subject_id: string;
      teacher_id: string;
      exam_date: string;
      start_time: string;
      end_time: string;
      location: string;
      notes: string;
    }>,
  ): Promise<void> {
    const { error } = await supabase
      .from('exam_timetables')
      .update(entry)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('exam_timetables')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
