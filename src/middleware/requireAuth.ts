import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { USER_ROLES, type UserRole } from '@/utils/constants';
import { getPersistedSchoolSlug } from '@/store/auth.store';
import { useDomainContext } from '@/context/DomainContext';
import { canAccess } from '@/config/routeAccess';

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
  const { isCustomDomain, schoolSlug: domainSlug } = useDomainContext();
  const location = useLocation();

  if (isLoading) {
    return createElement('div', {
      className: 'flex h-screen items-center justify-center bg-slate-50',
    }, createElement('div', {
      className: 'h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent',
    }));
  }

  if (!isAuthenticated) {
    // On a custom domain the login page is just /login (no slug in URL).
    // Otherwise use the persisted slug so staff sharing internal links land
    // on their school's login. Fall back to / if no slug is known.
    const loginPath = isCustomDomain
      ? '/login'
      : domainSlug
        ? `/school/${domainSlug}/login`
        : (() => { const slug = getPersistedSchoolSlug(); return slug ? `/school/${slug}/login` : '/'; })();

    return createElement(Navigate, {
      to: loginPath,
      state: { from: location },
      replace: true,
    });
  }

  return children;
}

/**
 * Applies the shared route matrix to whatever page the address bar is asking
 * for.
 *
 * Placed once around the dashboard shell rather than route by route. Guarding
 * each route individually is what produced the problem it fixes: 93 of the 107
 * routes were never given a role, so signing in was the only requirement to
 * open the system's configuration, the fee ledger or the permissions screen.
 * One wrapper cannot be forgotten on a new page — an unlisted path is denied.
 *
 * The redirect goes to the caller's own home rather than an error, so a
 * stale bookmark lands somewhere useful instead of a wall.
 */
export function RequireRouteAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = (user?.role ?? '') as UserRole;

  if (!canAccess(location.pathname, role)) {
    const home = getHomePath(role);
    // Never bounce to a home the same check would reject, or the redirect
    // loops. /unauthorized is always reachable.
    const target = canAccess(home, role) ? home : '/unauthorized';
    return createElement(Navigate, { to: target, replace: true });
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