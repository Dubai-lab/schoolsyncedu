import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import type { UserRole } from '@/utils/constants';

interface RequireRoleProps {
  children: ReactNode;
  roles: UserRole[];
}

export function RequireRole({ children, roles }: RequireRoleProps) {
  const { hasRole, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return createElement('div', {
      className: 'flex h-screen items-center justify-center bg-slate-50',
    }, createElement('div', {
      className: 'h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent',
    }));
  }

  if (!isAuthenticated) {
    return createElement(Navigate, { to: '/auth/login', replace: true });
  }

  if (!hasRole(...roles)) {
    return createElement(Navigate, { to: '/unauthorized', replace: true });
  }

  return children;
}