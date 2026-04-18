import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { USER_ROLES, type UserRole } from '@/utils/constants';
import { getPersistedSchoolSlug } from '@/store/auth.store';

interface RequireAuthProps {
  children: ReactNode;
}

export function getHomePath(role: string): string {
  switch (role) {
    case USER_ROLES.TEACHER:        return '/teacher';
    case USER_ROLES.REGISTRAR:      return '/registrar';
    case USER_ROLES.BURSAR:         return '/bursar';
    case USER_ROLES.IT_ADMIN:       return '/it-admin';
    case USER_ROLES.STUDENT:        return '/student/dashboard';
    case USER_ROLES.PROPRIETOR:     return '/proprietor';
    case USER_ROLES.SUPER_ADMIN:    return '/admin';
    case USER_ROLES.DEAN:           return '/dean';
    case USER_ROLES.PRINCIPAL:      return '/principal';
    case USER_ROLES.VICE_PRINCIPAL: return '/principal';
    case USER_ROLES.LIBRARIAN:      return '/librarian';
    default:                        return '/dashboard';
  }
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return createElement('div', {
      className: 'flex h-screen items-center justify-center bg-slate-50',
    }, createElement('div', {
      className: 'h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent',
    }));
  }

  if (!isAuthenticated) {
    const slug = getPersistedSchoolSlug();
    // School staff cannot use /auth/login — that's platform-admin only.
    // If we know the school slug (stored on sign-in), send them to their
    // school login page and preserve the intended destination.
    // If no slug is known (fresh browser / different device), send them
    // to the home page where they can find their school.
    const loginPath = slug ? `/school/${slug}/login` : '/';
    return createElement(Navigate, {
      to: loginPath,
      state: { from: location },
      replace: true,
    });
  }

  return children;
}

interface RequireRoleProps {
  children: ReactNode;
  roles: UserRole[];
}

/**
 * Guards a route or group of routes so only users with an allowed role can access.
 * Unauthorized users are redirected to their own home dashboard.
 */
export function RequireRole({ children, roles }: RequireRoleProps) {
  const { user } = useAuth();
  const role = (user?.role ?? '') as UserRole;

  if (!roles.includes(role)) {
    return createElement(Navigate, {
      to: getHomePath(role),
      replace: true,
    });
  }

  return children;
}