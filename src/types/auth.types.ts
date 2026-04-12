// ============================================================
// AUTH TYPES — Authentication & session management
// ============================================================

import type { UUID, Timestamp } from './common.types';
import type { User } from './user.types';
import type { School } from './school.types';
import type { UserRole } from '@/utils/constants';

/** Supabase auth session */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

/** Supabase auth.users record */
export interface AuthUser {
  id: UUID;
  email: string;
  created_at: Timestamp;
}

/** Full authenticated user context (Supabase auth + public.users + school) */
export interface AuthenticatedUser {
  authUser: AuthUser;
  user: User;
  school: School | null;
  role: UserRole;
  permissions: string[];
}

/** Auth context state */
export interface AuthState {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ==================== FORMS ====================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  schoolCode?: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface StudentLoginData {
  registrationNumber: string;
  password: string;
}

// ==================== AUTH RESPONSES ====================

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: AuthenticatedUser;
}

export interface TokenPayload {
  sub: UUID;
  email: string;
  role: UserRole;
  school_id: UUID | null;
  exp: number;
}