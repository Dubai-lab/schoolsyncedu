import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';

interface RequireAuthProps {
  children: ReactNode;
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
    return createElement(Navigate, {
      to: '/auth/login',
      state: { from: location },
      replace: true,
    });
  }

  return children;
}