import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

// ==================== STUDENT PORTAL SERVICE ====================
// Self-service methods for student-facing pages.
// All methods scope data to the logged-in student only.

export const studentPortalService = {
  /** Get the student record for the logged-in user */
  async getMyProfile(schoolId: UUID, userId: UUID) {
    const { data, error } = await supabase
      .from('students')
      .select('*, guardians(*), classes:current_class_id(id, name, grade_level, section)')
      .eq('school_id', schoolId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  /** Get my current class info */
  async getMyClass(schoolId: UUID, classId: UUID) {
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_subjects(*, subjects(*))')
      .eq('school_id', schoolId)
      .eq('id', classId)
      .single();
    if (error) throw error;
    return data;
  },

  // ==================== GRADES ====================

  /** Get approved grades only (students must not see unapproved/draft grades) */
  async getMyGrades(schoolId: UUID, studentId: UUID) {
    // Fetch grades without embedded join to avoid PostgREST FK cache issues
    const { data: grades, error } = await supabase
      .from('grades')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('status', 'approved')
      .order('entered_at', { ascending: false });
    if (error) throw error;
    if (!grades || grades.length === 0) return [];

    // Fetch subjects for those grades separately
    const subjectIds = [...new Set(grades.map((g) => g.subject_id).filter(Boolean))];
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, code')
      .in('id', subjectIds);

    const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s]));
    return grades.map((g) => ({ ...g, subjects: subjectMap.get(g.subject_id) ?? null }));
  },

  /** Get my report cards */
  async getMyReportCards(_schoolId: UUID, studentId: UUID) {
    // report_cards has no school_id column — scope by student_id only
    const { data, error } = await supabase
      .from('report_cards')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Get my transcripts */
  async getMyTranscripts(_schoolId: UUID, studentId: UUID) {
    // transcripts has no school_id column — scope by student_id only
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ==================== ATTENDANCE ====================

  /** Get my attendance records */
  async getMyAttendance(_schoolId: UUID, studentId: UUID) {
    // attendance_records has no school_id — scope by student_id only
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', studentId)
      .order('attendance_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Get my attendance summary counts */
  async getMyAttendanceSummary(_schoolId: UUID, studentId: UUID) {
    // attendance_records has no school_id column — scope by student_id only
    const { data, error } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId);
    if (error) throw error;

    const records = data ?? [];
    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const excused = records.filter((r) => r.status === 'excused').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, late, excused, rate };
  },

  // ==================== FEES ====================

  /** Get my assigned fees */
  async getMyFees(_schoolId: UUID, studentId: UUID) {
    const { data, error } = await supabase
      .from('student_fees')
      .select(
        '*, fee_structures(fee_type, amount_usd, amount_lrd, academic_year, grade_level, due_date)',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Get my payment history */
  async getMyPayments(schoolId: UUID, studentId: UUID) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ==================== TIMETABLE ====================

  /** Get timetable for my class */
  async getMyTimetable(_schoolId: UUID, classId: UUID) {
    // timetables has no school_id column — scope by class_id only
    const { data, error } = await supabase
      .from('timetables')
      .select('*, subjects(name, code)')
      .eq('class_id', classId)
      .order('day_of_week')
      .order('start_time');
    if (error) throw error;
    return data ?? [];
  },

  // ==================== LIBRARY ====================

  /** Get my checked-out books */
  async getMyCheckouts(_schoolId: UUID, studentId: UUID) {
    const { data, error } = await supabase
      .from('book_checkouts')
      .select('*, book_copies(*, books(title, author, isbn, cover_url))')
      .eq('student_id', studentId) // no school_id column on this table
      .order('checkout_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Browse available books (read-only) */
  async browseBooks(schoolId: UUID, search?: string) {
    let query = supabase
      .from('books')
      .select('*, book_copies(id, status)')
      .eq('school_id', schoolId)
      .order('title');

    if (search) {
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  // ==================== ID CARD ====================

  /** Get my generated ID card */
  async getMyIDCard(schoolId: UUID, studentId: UUID) {
    const { data, error } = await supabase
      .from('nfc_cards')
      .select('*, id_card_designs(name, design_json)')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Get active card design for this school */
  async getActiveCardDesign(schoolId: UUID) {
    const { data, error } = await supabase
      .from('id_card_designs')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ==================== ANNOUNCEMENTS ====================

  /** Get announcements for the school */
  async getAnnouncements(schoolId: UUID) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },
};
