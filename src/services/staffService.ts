import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { User, UserRoleRecord, Permission, StaffDirectoryItem } from '@/types/user.types';
import type { UserRole } from '@/utils/constants';

// ==================== STAFF / USERS ====================

export const staffService = {
  async list(schoolId: UUID, filters?: { role?: UserRole; is_active?: boolean; search?: string }) {
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .not('role', 'in', '("student","parent")')
      .order('role')
      .order('last_name');
    if (filters?.role) query = query.eq('role', filters.role);
    if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters?.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as User[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as User;
  },

  async create(schoolId: UUID, user: {
    email: string; first_name: string; last_name: string;
    phone?: string; role: UserRole; password: string;
  }) {
    const { data, error } = await supabase.rpc('create_school_user', {
      p_school_id: schoolId,
      p_email: user.email,
      p_password: user.password,
      p_first_name: user.first_name,
      p_last_name: user.last_name,
      p_phone: user.phone ?? '',
      p_role: user.role,
    });
    if (error) throw error;
    return data as unknown as User;
  },

  async update(id: UUID, updates: Partial<{
    first_name: string; last_name: string; phone: string;
    role: UserRole; profile_photo_url: string; is_active: boolean;
  }>) {
    const payload: Record<string, unknown> = { ...updates };
    if (updates.first_name || updates.last_name) {
      const current = await staffService.getById(id);
      payload.full_name = `${updates.first_name ?? current.first_name} ${updates.last_name ?? current.last_name}`;
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

  async deactivate(id: UUID) {
    return staffService.update(id, { is_active: false });
  },

  async activate(id: UUID) {
    return staffService.update(id, { is_active: true });
  },

  async getStaffDirectory(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_staff_directory')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as StaffDirectoryItem[];
  },
};

// ==================== ROLE PERMISSIONS ====================

export const rolePermissionService = {
  async listRoles(schoolId: UUID) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('school_id', schoolId)
      .order('role_name');
    if (error) throw error;
    return data as UserRoleRecord[];
  },

  async updateRolePermissions(id: UUID, permissions: string[]) {
    const { data, error } = await supabase
      .from('user_roles')
      .update({ permissions })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as UserRoleRecord;
  },

  async listPermissions(schoolId: UUID, role?: UserRole) {
    let query = supabase
      .from('permissions')
      .select('*')
      .eq('school_id', schoolId);
    if (role) query = query.eq('role', role);
    const { data, error } = await query;
    if (error) throw error;
    return data as Permission[];
  },

  async grantPermission(perm: { school_id: UUID; role: UserRole; module: string; action: string }) {
    const { data, error } = await supabase
      .from('permissions')
      .insert(perm)
      .select()
      .single();
    if (error) throw error;
    return data as Permission;
  },

  async revokePermission(id: UUID) {
    const { error } = await supabase.from('permissions').delete().eq('id', id);
    if (error) throw error;
  },
};
