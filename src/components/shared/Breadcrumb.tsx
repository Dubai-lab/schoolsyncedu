import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/utils/helpers';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/utils/constants';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

function getHomePathForRole(role: string): string {
  switch (role) {
    case USER_ROLES.TEACHER:       return '/teacher';
    case USER_ROLES.REGISTRAR:     return '/registrar';
    case USER_ROLES.BURSAR:        return '/bursar';
    case USER_ROLES.IT_ADMIN:      return '/it-admin';
    case USER_ROLES.STUDENT:       return '/student/dashboard';
    case USER_ROLES.PROPRIETOR:    return '/proprietor';
    case USER_ROLES.SUPER_ADMIN:   return '/admin';
    default:                       return '/dashboard';
  }
}

/** If no items are provided, auto-generates from the URL path */
export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  const location = useLocation();
  const { user } = useAuth();
  const homePath = getHomePathForRole(user?.role ?? '');

  const crumbs: BreadcrumbItem[] = items ?? buildFromPath(location.pathname);

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      <Link to={homePath} className="text-slate-400 hover:text-slate-600 transition-colors">
        <Home className="h-4 w-4" />
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            {isLast || !crumb.href ? (
              <span className={cn(isLast ? 'font-medium text-slate-700' : 'text-slate-500')}>
                {crumb.label}
              </span>
            ) : (
              <Link to={crumb.href} className="text-slate-500 hover:text-slate-700 transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function buildFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: i < segments.length - 1 ? '/' + segments.slice(0, i + 1).join('/') : undefined,
  }));
}