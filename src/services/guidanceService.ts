import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  CounselingSession,
  StudentIncident,
  IncidentAction,
  ParentMeeting,
} from '@/types/report.types';

// ==================== COUNSELING SESSIONS ====================

export const counselingService = {
  async list(filters?: { counselor_id?: UUID; student_id?: UUID }) {
    let query = supabase
      .from('counseling_sessions')
      .select('*, students:student_id(id, first_name, last_name, registration_number), users:counselor_id(id, first_name, last_name)', { count: 'exact' })
      .order('session_date', { ascending: false });
    if (filters?.counselor_id) query = query.eq('counselor_id', filters.counselor_id);
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (CounselingSession & { students: Record<string, string>; users: Record<string, string> })[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('counseling_sessions')
      .select('*, students:student_id(id, first_name, last_name, registration_number), users:counselor_id(id, first_name, last_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as CounselingSession & { students: Record<string, string>; users: Record<string, string> };
  },

  async create(session: {
    student_id: UUID; counselor_id: UUID; session_date: string;
    session_time?: string; duration_minutes?: number; notes?: string;
    issues_discussed?: string[]; action_items?: Record<string, unknown>[];
  }) {
    const { data, error } = await supabase
      .from('counseling_sessions')
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    return data as CounselingSession;
  },

  async update(id: UUID, updates: Partial<{
    session_date: string; session_time: string; duration_minutes: number;
    notes: string; issues_discussed: string[]; action_items: Record<string, unknown>[];
  }>) {
    const { data, error } = await supabase
      .from('counseling_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CounselingSession;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('counseling_sessions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== STUDENT INCIDENTS ====================

export const incidentService = {
  async list(filters?: { student_id?: UUID; severity?: string }) {
    let query = supabase
      .from('student_incidents')
      .select('*, students:student_id(id, first_name, last_name, registration_number), users:reported_by(id, first_name, last_name)', { count: 'exact' })
      .order('incident_date', { ascending: false });
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (StudentIncident & { students: Record<string, string>; users: Record<string, string> })[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('student_incidents')
      .select('*, students:student_id(id, first_name, last_name, registration_number), users:reported_by(id, first_name, last_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as StudentIncident & { students: Record<string, string>; users: Record<string, string> };
  },

  async create(incident: {
    student_id: UUID; incident_date: string; incident_type: string;
    description: string; severity: string; reported_by: UUID;
  }) {
    const { data, error } = await supabase
      .from('student_incidents')
      .insert(incident)
      .select()
      .single();
    if (error) throw error;
    return data as StudentIncident;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('student_incidents').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== INCIDENT ACTIONS ====================

export const incidentActionService = {
  async listByIncident(incidentId: UUID) {
    const { data, error } = await supabase
      .from('incident_actions')
      .select('*, users:approved_by(id, first_name, last_name)')
      .eq('incident_id', incidentId)
      .order('action_date');
    if (error) throw error;
    return data as (IncidentAction & { users: Record<string, string> | null })[];
  },

  async create(action: {
    incident_id: UUID; action_type: string; description?: string;
    approved_by?: UUID; action_date: string;
  }) {
    const { data, error } = await supabase
      .from('incident_actions')
      .insert(action)
      .select()
      .single();
    if (error) throw error;
    return data as IncidentAction;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('incident_actions').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== PARENT MEETINGS ====================

export const parentMeetingService = {
  async list(filters?: { student_id?: UUID; staff_member_id?: UUID }) {
    let query = supabase
      .from('parent_meetings')
      .select('*, students:student_id(id, first_name, last_name, registration_number), guardians:parent_id(id, first_name, last_name), users:staff_member_id(id, first_name, last_name)', { count: 'exact' })
      .order('meeting_date', { ascending: false });
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    if (filters?.staff_member_id) query = query.eq('staff_member_id', filters.staff_member_id);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (ParentMeeting & { students: Record<string, string>; guardians: Record<string, string>; users: Record<string, string> | null })[], count: count ?? 0 };
  },

  async create(meeting: {
    student_id: UUID; parent_id: UUID; staff_member_id?: UUID;
    meeting_date: string; meeting_time?: string; topics?: string;
    notes?: string; action_items?: Record<string, unknown>[];
  }) {
    const { data, error } = await supabase
      .from('parent_meetings')
      .insert(meeting)
      .select()
      .single();
    if (error) throw error;
    return data as ParentMeeting;
  },

  async update(id: UUID, updates: Partial<{
    meeting_date: string; meeting_time: string; topics: string;
    notes: string; action_items: Record<string, unknown>[];
  }>) {
    const { data, error } = await supabase
      .from('parent_meetings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ParentMeeting;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('parent_meetings').delete().eq('id', id);
    if (error) throw error;
  },
};
