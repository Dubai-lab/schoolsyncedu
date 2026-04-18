import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import type { UserRole } from '@/utils/constants';
import { getPersistedSchoolSlug } from '@/store/auth.store';

interface RequireRoleProps {
  children: ReactNode;
  roles: UserRole[];
}

export function RequireRole({ children, roles }: RequireRoleProps) {
  const { hasRole, isAuthenticated, isLoading } = useAuth();
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
    const loginPath = slug ? `/school/${slug}/login` : '/';
    return createElement(Navigate, { to: loginPath, state: { from: location }, replace: true });
  }

  if (!hasRole(...roles)) {
    return createElement(Navigate, { to: '/unauthorized', replace: true });
  }

  return children;
}