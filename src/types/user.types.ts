// ============================================================
// USER TYPES — Users, roles, permissions, audit logs
// ============================================================

import type { UUID, Timestamp, SchoolScopedEntity, PlatformAdminRole } from './common.types';
import type { UserRole } from '@/utils/constants';

/** public.users table — includes auth_id from migration 006 */
export interface User {
  id: UUID;
  school_id: UUID;
  auth_id: UUID | null;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  profile_photo_url: string | null;
  is_active: boolean;
  last_login: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** user_roles table */
export interface UserRoleRecord extends SchoolScopedEntity {
  role_name: UserRole;
  permissions: string[];
  updated_at: Timestamp;
}

/** permissions table */
export interface Permission extends SchoolScopedEntity {
  role: UserRole;
  module: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
}

/** audit_logs table */
export interface AuditLog extends SchoolScopedEntity {
  user_id: UUID;
  action: string;
  entity_type: string;
  entity_id: UUID;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

/** system_logs table */
export interface SystemLog {
  id: UUID;
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: Timestamp;
}

/** webhook_events table */
export interface WebhookEvent {
  id: UUID;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  retry_count: number;
  created_at: Timestamp;
  processed_at: Timestamp | null;
}

/** platform_admin_users table */
export interface PlatformAdminUser {
  id: UUID;
  email: string;
  name: string;
  role: PlatformAdminRole;
  is_active: boolean;
  last_login: Timestamp | null;
  created_at: Timestamp;
}

// ==================== VIEW TYPES ====================

/** vw_staff_directory */
export interface StaffDirectoryItem {
  id: UUID;
  school_id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  status: boolean;
  created_at: Timestamp;
  school_name: string;
}

/** vw_recent_audit_activity */
export interface RecentAuditActivity {
  id: UUID;
  school_id: UUID;
  school_name: string;
  user_id: UUID;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: UUID;
  description: string | null;
  created_at: Timestamp;
}

// ==================== FORMS ====================

export interface CreateUserForm {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  profilePhotoUrl?: string;
}

export interface UpdateUserForm {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhotoUrl?: string;
  isActive?: boolean;
}

export interface UpdateProfileForm {
  firstName: string;
  lastName: string;
  phone?: string;
  profilePhotoUrl?: string;
}