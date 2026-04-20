import { supabase } from '@/lib/supabase';
import type { UUID, ISODate } from '@/types/common.types';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceFilterParams,
  AttendanceEntry,
} from '@/types/attendance.types';

export const attendanceService = {
  /** List attendance records with filters + pagination */
  async list(
    schoolId: UUID,
    params: AttendanceFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const { classId, subjectId, studentId, dateFrom, dateTo, status, page = 1, pageSize = 50 } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('attendance_records')
      .select(
        '*, students!inner(id, first_name, last_name, registration_number, school_id), classes!inner(id, name), subjects(id, name)',
        { count: 'exact' },
      )
      .eq('students.school_id', schoolId)
      .order('attendance_date', { ascending: false })
      .range(from, to);

    if (classId) query = query.eq('class_id', classId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (studentId) query = query.eq('student_id', studentId);
    if (dateFrom) query = query.gte('attendance_date', dateFrom);
    if (dateTo) query = query.lte('attendance_date', dateTo);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },

  /** Get attendance for a specific class + subject on a specific date */
  async getByClassDate(classId: UUID, date: ISODate, subjectId?: UUID) {
    let query = supabase
      .from('attendance_records')
      .select('*, students(id, first_name, last_name, registration_number)')
      .eq('class_id', classId)
      .eq('attendance_date', date)
      .order('last_name', { referencedTable: 'students' });
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    } else {
      query = query.is('subject_id', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as (AttendanceRecord & {
      students: { id: string; first_name: string; last_name: string; registration_number: string };
    })[];
  },

  /** Get students in a class (for marking attendance) */
  async getClassStudents(classId: UUID) {
    const { data, error } = await supabase
      .from('class_assignments')
      .select('student_id, students!inner(id, first_name, last_name, registration_number, photo_url)')
      .eq('class_id', classId)
      .is('removed_at', null);
    if (error) throw error;
    const sorted = (data ?? []).sort((a, b) => {
      const sa = (a as Record<string, unknown>).students as { last_name?: string } | null;
      const sb = (b as Record<string, unknown>).students as { last_name?: string } | null;
      return (sa?.last_name ?? '').localeCompare(sb?.last_name ?? '');
    });
    return sorted
      .map((d) => (d as Record<string, unknown>).students)
      .filter(Boolean) as {
        id: string; first_name: string; last_name: string; registration_number: string; photo_url: string | null;
      }[];
  },

  /** Get list of classes for a school (for class picker) */
  async getClasses(schoolId: UUID) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, grade_level, section')
      .eq('school_id', schoolId)
      .order('grade_level')
      .order('name');
    if (error) throw error;
    return data as { id: string; name: string; grade_level: string; section: string }[];
  },

  /** Mark attendance — upsert records for a class + subject + date */
  async markAttendance(classId: UUID, date: ISODate, entries: AttendanceEntry[], markedBy: UUID, subjectId?: UUID) {
    const records = entries.map((e) => ({
      student_id:      e.studentId,
      class_id:        classId,
      subject_id:      subjectId ?? null,
      attendance_date: date,
      status:          e.status,
      marked_by:       markedBy,
      marked_at:       new Date().toISOString(),
      notes:           e.notes || null,
    }));

    const { error } = await supabase
      .from('attendance_records')
      .upsert(records, { onConflict: 'student_id,attendance_date,subject_id' });
    if (error) throw error;
  },

  /** Get subjects assigned to a class (for the subject picker in AttendanceMarking) */
  async getClassSubjects(classId: UUID) {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('subject_id, subjects(id, name, code)')
      .eq('class_id', classId);
    if (error) throw error;
    return (data ?? []).map((d) => {
      const s = (Array.isArray(d.subjects) ? d.subjects[0] : d.subjects) as { id: string; name: string; code: string | null } | null;
      return { subjectId: d.subject_id as string, name: s?.name ?? '', code: s?.code ?? null };
    });
  },

  /** Get attendance summary for a student */
  async getStudentSummary(studentId: UUID, academicYear?: string) {
    let query = supabase
      .from('attendance_summary')
      .select('*')
      .eq('student_id', studentId);
    if (academicYear) query = query.eq('academic_year', academicYear);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /** Get class-level attendance stats for a date range */
  async getClassStats(classId: UUID, dateFrom: ISODate, dateTo: ISODate) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('class_id', classId)
      .gte('attendance_date', dateFrom)
      .lte('attendance_date', dateTo);
    if (error) throw error;

    const records = data ?? [];
    const total = records.length;
    const counts: Record<AttendanceStatus, number> = {
      present: 0, absent: 0, late: 0, excused: 0, unexcused: 0, medical_leave: 0,
    };
    records.forEach((r) => counts[r.status as AttendanceStatus]++);
    const rate = total > 0 ? ((counts.present + counts.late) / total) * 100 : 0;

    return { total, ...counts, attendanceRate: Math.round(rate * 10) / 10 };
  },
};