import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { School } from '@/types/school.types';
import type { AuditLog, SystemLog } from '@/types/user.types';

// ==================== SCHOOL SETTINGS ====================

export const schoolSettingsService = {
  async get(schoolId: UUID) {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    if (error) throw error;
    return data as School;
  },

  async update(schoolId: UUID, payload: Partial<Omit<School, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', schoolId)
      .select()
      .single();
    if (error) throw error;
    return data as School;
  },
};

// ==================== USER PREFERENCES ====================

export const userPreferencesService = {
  async getProfile(userId: UUID) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, profile_photo_url, is_active, last_login')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: UUID, payload: { first_name?: string; last_name?: string; phone?: string; profile_photo_url?: string }) {
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ==================== AUDIT LOGS ====================

export const auditLogService = {
  async list(schoolId: UUID, page = 1, pageSize = 25) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: data as AuditLog[], total: count ?? 0 };
  },
};

// ==================== SYSTEM CONFIG ====================

export const systemConfigService = {
  async getSystemLogs(limit = 50) {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as SystemLog[];
  },
};
