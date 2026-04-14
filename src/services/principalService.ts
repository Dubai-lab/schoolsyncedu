import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

export interface PrincipalStats {
  studentCount: number;
  staffCount: number;
  classCount: number;
  pendingGradeApprovals: number;
  pendingLetterApprovals: number;
  presentToday: number;
  absentToday: number;
}

export const principalService = {
  async getStats(schoolId: UUID): Promise<PrincipalStats> {
    const today = new Date().toISOString().split('T')[0];

    const [
      studentsRes,
      staffRes,
      classesRes,
      gradesRes,
      lettersRes,
      attendanceRes,
    ] = await Promise.all([
      supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId),

      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .neq('role', 'student')
        .neq('role', 'parent'),

      supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId),

      supabase
        .from('grades')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'submitted'),

      supabase.rpc('list_pending_approval_letters', { p_school_id: schoolId }),

      supabase
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId)
        .eq('date', today),
    ]);

    const attendance = (attendanceRes.data ?? []) as { status: string }[];
    const presentToday = attendance.filter((a) => a.status === 'present').length;
    const absentToday = attendance.filter((a) => a.status === 'absent').length;

    return {
      studentCount: studentsRes.count ?? 0,
      staffCount: staffRes.count ?? 0,
      classCount: classesRes.count ?? 0,
      pendingGradeApprovals: gradesRes.count ?? 0,
      pendingLetterApprovals: Array.isArray(lettersRes.data) ? lettersRes.data.length : 0,
      presentToday,
      absentToday,
    };
  },
};
