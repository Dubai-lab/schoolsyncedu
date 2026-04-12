import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { User } from '@/types/user.types';
import type { School } from '@/types/school.types';
import type { UserRole } from '@/utils/constants';

// ==================== DASHBOARD STATS ====================

export const itAdminDashboardService = {
  async getStats(schoolId: UUID) {
    const [students, staff, activeUsers, recentLogins] = await Promise.all([
      supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .not('role', 'in', '("student","parent")'),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true),
      supabase
        .from('users')
        .select('id, first_name, last_name, email, role, last_login')
        .eq('school_id', schoolId)
        .not('last_login', 'is', null)
        .order('last_login', { ascending: false })
        .limit(10),
    ]);

    return {
      studentCount: students.count ?? 0,
      staffCount: staff.count ?? 0,
      activeUserCount: activeUsers.count ?? 0,
      recentLogins: (recentLogins.data ?? []) as Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'role' | 'last_login'>[],
    };
  },

  async getRecentAuditLogs(schoolId: UUID, limit = 10) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};

// ==================== USER MANAGEMENT ====================

export const itAdminUserService = {
  async listUsers(schoolId: UUID, filters?: {
    role?: UserRole;
    is_active?: boolean;
    search?: string;
  }) {
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .not('role', 'in', '("student","parent","proprietor","super_admin")')
      .order('role')
      .order('last_name');
    if (filters?.role) query = query.eq('role', filters.role);
    if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      );
    }
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as User[], count: count ?? 0 };
  },

  async getUser(id: UUID) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as User;
  },

  async createUser(schoolId: UUID, payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: UserRole;
  }) {
    // Single RPC creates auth user + public user in one atomic transaction
    const { data, error } = await supabase.rpc('create_school_user', {
      p_school_id: schoolId,
      p_email: payload.email,
      p_password: payload.password,
      p_first_name: payload.first_name,
      p_last_name: payload.last_name,
      p_phone: payload.phone ?? '',
      p_role: payload.role,
    });
    if (error) throw error;
    return data as unknown as User;
  },

  async updateUser(id: UUID, updates: Partial<{
    first_name: string;
    last_name: string;
    phone: string;
    role: UserRole;
    is_active: boolean;
  }>) {
    const payload: Record<string, unknown> = { ...updates };
    if (updates.first_name || updates.last_name) {
      const { data: current } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', id)
        .single();
      payload.full_name = `${updates.first_name ?? current?.first_name} ${updates.last_name ?? current?.last_name}`;
    }
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  },

  async deactivateUser(id: UUID) {
    return itAdminUserService.updateUser(id, { is_active: false });
  },

  async activateUser(id: UUID) {
    return itAdminUserService.updateUser(id, { is_active: true });
  },

  async resetPassword(userId: UUID) {
    // Get user email first, then trigger Supabase password reset
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    if (fetchError) throw fetchError;

    const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
    return { success: true, message: 'Password reset email sent' };
  },
};

// ==================== STUDENT ACCOUNT PROVISIONING ====================

export interface StudentWithoutAccount {
  id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  current_grade_level: string;
  status: string;
  enrollment_date: string | null;
}

export const itAdminStudentService = {
  async listStudentsWithoutAccounts(schoolId: UUID): Promise<StudentWithoutAccount[]> {
    const { data, error } = await supabase
      .rpc('list_students_without_accounts', { p_school_id: schoolId });
    if (error) throw error;
    return (data ?? []) as StudentWithoutAccount[];
  },

  async provisionStudentAccount(schoolId: UUID, registrationNumber: string, password: string) {
    const { data, error } = await supabase.rpc('provision_student_account', {
      p_school_id: schoolId,
      p_registration_number: registrationNumber,
      p_password: password,
    });
    if (error) throw error;
    return data as { success: boolean; student_id: string; user_id: string; registration_number: string; message: string };
  },
};

// ==================== SCHOOL SITE MANAGEMENT ====================

export const itAdminSiteService = {
  async getSchool(schoolId: UUID) {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    if (error) throw error;
    return data as School;
  },

  async updateSchool(schoolId: UUID, payload: Partial<School>) {
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

// ==================== SYSTEM OVERVIEW ====================

export const itAdminSystemService = {
  async getAuditLogs(schoolId: UUID, page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  },

  async getUserRoleCounts(schoolId: UUID) {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('school_id', schoolId)
      .eq('is_active', true);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data ?? []).forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  },
};
