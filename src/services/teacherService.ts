import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

// ==================== TEACHER SERVICE ====================
// School-scoped — all queries filter by school_id via joins/tables

export const teacherService = {
  /**
   * Get classes where this teacher is:
   * - the homeroom/class teacher (classes.class_teacher_id), OR
   * - a subject teacher  (class_subjects.teacher_id)
   * Returns unique classes.
   */
  async getMyClasses(schoolId: UUID, teacherId: UUID) {
    // 1. Homeroom classes
    const { data: homeroom, error: e1 } = await supabase
      .from('classes')
      .select('id, name, grade_level, section, capacity')
      .eq('school_id', schoolId)
      .eq('class_teacher_id', teacherId);
    if (e1) throw e1;

    // 2. Classes where teacher teaches a subject
    const { data: subjectClasses, error: e2 } = await supabase
      .from('class_subjects')
      .select('class_id, classes!inner(id, name, grade_level, section, capacity)')
      .eq('teacher_id', teacherId)
      .eq('classes.school_id', schoolId);
    if (e2) throw e2;

    // Merge & deduplicate
    const classMap = new Map<string, { id: string; name: string; grade_level: string; section: string; capacity: number; isHomeroom: boolean }>();

    (homeroom ?? []).forEach((c) => {
      classMap.set(c.id, { ...c, isHomeroom: true });
    });

    (subjectClasses ?? []).forEach((row) => {
      const c = (row as Record<string, unknown>).classes as {
        id: string; name: string; grade_level: string; section: string; capacity: number;
      };
      if (!classMap.has(c.id)) {
        classMap.set(c.id, { ...c, isHomeroom: false });
      }
    });

    return Array.from(classMap.values()).sort((a, b) =>
      (a.grade_level ?? '').localeCompare(b.grade_level ?? '') || a.name.localeCompare(b.name),
    );
  },

  /** Get subjects the teacher teaches (with class info) */
  async getMySubjects(schoolId: UUID, teacherId: UUID) {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('id, academic_year, classes!inner(id, name, grade_level, section, school_id), subjects!inner(id, name, code)')
      .eq('teacher_id', teacherId)
      .eq('classes.school_id', schoolId);
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const cls = r.classes as { id: string; name: string; grade_level: string; section: string };
      const sub = r.subjects as { id: string; name: string; code: string };
      return {
        id: r.id as string,
        academic_year: r.academic_year as string,
        class_id: cls.id,
        class_name: cls.name,
        grade_level: cls.grade_level,
        subject_id: sub.id,
        subject_name: sub.name,
        subject_code: sub.code,
      };
    });
  },

  /** Get teacher's timetable (all periods across all classes) */
  async getMySchedule(schoolId: UUID, teacherId: UUID) {
    const { data, error } = await supabase
      .from('timetables')
      .select('*, classes!inner(id, name, grade_level, school_id), subjects(id, name, code)')
      .eq('teacher_id', teacherId)
      .eq('classes.school_id', schoolId)
      .order('day_of_week')
      .order('start_time');
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const cls = r.classes as { id: string; name: string; grade_level: string };
      const sub = r.subjects as { id: string; name: string; code: string } | null;
      return {
        id: r.id as string,
        day_of_week: r.day_of_week as string,
        start_time: r.start_time as string,
        end_time: r.end_time as string,
        class_id: cls.id,
        class_name: cls.name,
        grade_level: cls.grade_level,
        subject_name: sub?.name ?? '',
        subject_code: sub?.code ?? '',
        location: r.location as string | null,
      };
    });
  },

  /** Get student count for each of the teacher's classes */
  async getClassStudentCounts(classIds: string[]) {
    if (!classIds.length) return {};
    const { data, error } = await supabase
      .from('class_assignments')
      .select('class_id')
      .in('class_id', classIds)
      .is('removed_at', null);
    if (error) throw error;

    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      counts[row.class_id] = (counts[row.class_id] || 0) + 1;
    });
    return counts;
  },

  /** Get teacher dashboard stats */
  async getDashboardStats(schoolId: UUID, teacherId: UUID) {
    const today = new Date().toISOString().split('T')[0];

    // Get teacher's classes first
    const myClasses = await this.getMyClasses(schoolId, teacherId);
    const classIds = myClasses.map((c) => c.id);

    // Count students across all teacher's classes
    const studentCounts = await this.getClassStudentCounts(classIds);
    const totalStudents = Object.values(studentCounts).reduce((a, b) => a + b, 0);

    // Today's attendance marked by this teacher
    const { count: todayAttendance } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('marked_by', teacherId)
      .eq('attendance_date', today);

    // Get subjects
    const mySubjects = await this.getMySubjects(schoolId, teacherId);

    return {
      myClasses: myClasses.length,
      myStudents: totalStudents,
      mySubjects: mySubjects.length,
      todayAttendance: todayAttendance ?? 0,
      classes: myClasses,
      studentCounts,
    };
  },
};
