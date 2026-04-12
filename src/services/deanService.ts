import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

// ==================== TYPES ====================

export interface Incident {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  reported_by: UUID | null;
  incident_type: string;
  description: string;
  incident_date: string;
  action_taken: string;
  status: 'open' | 'under_review' | 'resolved';
  dean_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  students?: { first_name: string; last_name: string; registration_number: string; current_grade_level: string };
  users?: { full_name: string };
}

export interface TeacherReferral {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  teacher_id: UUID;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  dean_notes: string | null;
  incident_id: UUID | null;
  created_at: string;
  students?: { first_name: string; last_name: string; current_grade_level: string };
  users?: { full_name: string };
}

export interface Suspension {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  incident_id: UUID | null;
  issued_by: UUID | null;
  start_date: string;
  end_date: string;
  reason: string;
  parent_notified: boolean;
  parent_notified_at: string | null;
  reinstated_at: string | null;
  reinstatement_notes: string | null;
  status: 'active' | 'completed' | 'reinstated_early';
  created_at: string;
  students?: { first_name: string; last_name: string; registration_number: string; current_grade_level: string };
}

export interface ParentMeeting {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  dean_id: UUID | null;
  incident_id: UUID | null;
  scheduled_at: string;
  purpose: string;
  outcome: string | null;
  parent_attended: boolean;
  follow_up: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  created_at: string;
  students?: { first_name: string; last_name: string; current_grade_level: string };
}

export interface WelfareFlag {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  flagged_by: UUID | null;
  risk_type: string;
  notes: string;
  action_plan: string | null;
  review_date: string | null;
  status: 'active' | 'monitoring' | 'resolved';
  resolved_at: string | null;
  created_at: string;
  students?: { first_name: string; last_name: string; current_grade_level: string; registration_number: string };
}

export interface CounselorReferral {
  id: UUID;
  school_id: UUID;
  student_id: UUID;
  referred_by: UUID | null;
  incident_id: UUID | null;
  reason: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_session' | 'closed';
  counselor_outcome: string | null;
  created_at: string;
  students?: { first_name: string; last_name: string; current_grade_level: string };
}

export interface DeanDashboardStats {
  total_incidents_week: number;
  open_incidents: number;
  pending_referrals: number;
  active_suspensions: number;
  upcoming_meetings: number;
  welfare_flags: number;
  pending_counselor_referrals: number;
}

// ==================== INCIDENT SERVICE ====================

export const incidentService = {
  async list(schoolId: UUID): Promise<Incident[]> {
    const { data, error } = await supabase
      .from('student_incidents')
      .select('*, students(first_name, last_name, registration_number, current_grade_level), users(full_name)')
      .eq('school_id', schoolId)
      .order('incident_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Incident[];
  },

  async create(schoolId: UUID, payload: {
    student_id: UUID; reported_by: UUID; incident_type: string;
    description: string; incident_date: string; action_taken: string;
  }): Promise<Incident> {
    const { data, error } = await supabase
      .from('student_incidents')
      .insert({ school_id: schoolId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as Incident;
  },

  async update(id: UUID, payload: Partial<Pick<Incident, 'status' | 'action_taken' | 'dean_notes' | 'resolved_at'>>): Promise<void> {
    const { error } = await supabase
      .from('student_incidents')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async resolve(id: UUID, notes: string): Promise<void> {
    const { error } = await supabase
      .from('student_incidents')
      .update({ status: 'resolved', dean_notes: notes, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: UUID): Promise<void> {
    const { error } = await supabase.from('student_incidents').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== TEACHER REFERRAL SERVICE ====================

export const referralService = {
  async list(schoolId: UUID): Promise<TeacherReferral[]> {
    const { data, error } = await supabase
      .from('teacher_referrals')
      .select('*, students(first_name, last_name, current_grade_level), users(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TeacherReferral[];
  },

  async updateStatus(id: UUID, status: TeacherReferral['status'], deanNotes?: string): Promise<void> {
    const { error } = await supabase
      .from('teacher_referrals')
      .update({ status, dean_notes: deanNotes, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async linkToIncident(id: UUID, incidentId: UUID): Promise<void> {
    const { error } = await supabase
      .from('teacher_referrals')
      .update({ incident_id: incidentId, status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== SUSPENSION SERVICE ====================

export const suspensionService = {
  async list(schoolId: UUID): Promise<Suspension[]> {
    const { data, error } = await supabase
      .from('suspensions')
      .select('*, students(first_name, last_name, registration_number, current_grade_level)')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Suspension[];
  },

  async create(schoolId: UUID, payload: {
    student_id: UUID; issued_by: UUID; start_date: string; end_date: string;
    reason: string; incident_id?: UUID; parent_notified: boolean;
  }): Promise<Suspension> {
    const { data, error } = await supabase
      .from('suspensions')
      .insert({ school_id: schoolId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as Suspension;
  },

  async reinstate(id: UUID, notes: string): Promise<void> {
    const { error } = await supabase
      .from('suspensions')
      .update({ status: 'reinstated_early', reinstated_at: new Date().toISOString(), reinstatement_notes: notes })
      .eq('id', id);
    if (error) throw error;
  },

  async markParentNotified(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('suspensions')
      .update({ parent_notified: true, parent_notified_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== PARENT MEETING SERVICE ====================

export const parentMeetingService = {
  async list(schoolId: UUID): Promise<ParentMeeting[]> {
    const { data, error } = await supabase
      .from('parent_meetings')
      .select('*, students(first_name, last_name, current_grade_level)')
      .eq('school_id', schoolId)
      .order('scheduled_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ParentMeeting[];
  },

  async create(schoolId: UUID, payload: {
    student_id: UUID; dean_id: UUID; scheduled_at: string;
    purpose: string; incident_id?: UUID;
  }): Promise<ParentMeeting> {
    const { data, error } = await supabase
      .from('parent_meetings')
      .insert({ school_id: schoolId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as ParentMeeting;
  },

  async complete(id: UUID, payload: { outcome: string; parent_attended: boolean; follow_up?: string }): Promise<void> {
    const { error } = await supabase
      .from('parent_meetings')
      .update({ ...payload, status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async updateStatus(id: UUID, status: ParentMeeting['status']): Promise<void> {
    const { error } = await supabase
      .from('parent_meetings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== WELFARE FLAG SERVICE ====================

export const welfareFlagService = {
  async list(schoolId: UUID): Promise<WelfareFlag[]> {
    const { data, error } = await supabase
      .from('student_welfare_flags')
      .select('*, students(first_name, last_name, current_grade_level, registration_number)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WelfareFlag[];
  },

  async create(schoolId: UUID, payload: {
    student_id: UUID; flagged_by: UUID; risk_type: string;
    notes: string; action_plan?: string; review_date?: string;
  }): Promise<WelfareFlag> {
    const { data, error } = await supabase
      .from('student_welfare_flags')
      .insert({ school_id: schoolId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as WelfareFlag;
  },

  async update(id: UUID, payload: Partial<Pick<WelfareFlag, 'status' | 'action_plan' | 'review_date' | 'notes'>>): Promise<void> {
    const { error } = await supabase
      .from('student_welfare_flags')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async resolve(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('student_welfare_flags')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== COUNSELOR REFERRAL SERVICE ====================

export const counselorReferralService = {
  async list(schoolId: UUID): Promise<CounselorReferral[]> {
    const { data, error } = await supabase
      .from('counselor_referrals')
      .select('*, students(first_name, last_name, current_grade_level)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CounselorReferral[];
  },

  async create(schoolId: UUID, payload: {
    student_id: UUID; referred_by: UUID; reason: string;
    urgency: CounselorReferral['urgency']; incident_id?: UUID;
  }): Promise<CounselorReferral> {
    const { data, error } = await supabase
      .from('counselor_referrals')
      .insert({ school_id: schoolId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as CounselorReferral;
  },

  async updateStatus(id: UUID, status: CounselorReferral['status'], outcome?: string): Promise<void> {
    const { error } = await supabase
      .from('counselor_referrals')
      .update({ status, counselor_outcome: outcome, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== DEAN DASHBOARD STATS ====================

export const deanStatsService = {
  async getStats(schoolId: UUID): Promise<DeanDashboardStats> {
    const { data, error } = await supabase.rpc('get_dean_dashboard_stats', { p_school_id: schoolId });
    if (error) throw error;
    return data as DeanDashboardStats;
  },
};

// ==================== STUDENT LIST (for dean selectors) ====================

export const deanStudentService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, current_grade_level')
      .eq('school_id', schoolId)
      .eq('status', 'enrolled')
      .order('last_name');
    if (error) throw error;
    return data ?? [];
  },
};
