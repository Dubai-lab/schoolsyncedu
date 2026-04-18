import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { itAdminDashboardService } from '@/services/itAdminService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Monitor,
  Users,
  GraduationCap,
  UserCheck,
  Globe,
  Shield,
  Settings,
  UserPlus,
  Activity,
  Clock,
  CreditCard,
  FileStack,
  Wifi,
  FileText,
} from 'lucide-react';

// ==================== STAT CARD ====================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'purple';
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
};

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${c.value}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </Card>
  );
}

// ==================== QUICK ACTION ====================

interface QuickActionProps {
  label: string;
  description: string;
  icon: React.ElementType;
  to: string;
}

function QuickAction({ label, description, icon: Icon, to }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-all"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

// ==================== ROLE LABEL ====================

const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    principal: 'Principal',
    vice_principal: 'Vice Principal',
    registrar: 'Registrar',
    bursar: 'Bursar',
    dean_of_students: 'Dean',
    admin_staff: 'Admin Staff',
    it_admin: 'IT Admin',
    teacher: 'Teacher',
    librarian: 'Librarian',
    guidance_counselor: 'Counselor',
  };
  return map[role] ?? role;
};

// ==================== MAIN COMPONENT ====================

export default function ITAdminDashboard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: stats, isLoading } = useFetch(
    ['it-admin-stats', schoolId],
    () => itAdminDashboardService.getStats(schoolId),
    { enabled: !!schoolId },
  );

  const { data: recentLogs = [] } = useFetch(
    ['it-admin-recent-logs', schoolId],
    () => itAdminDashboardService.getRecentAuditLogs(schoolId, 8),
    { enabled: !!schoolId },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Monitor className="inline-block h-6 w-6 mr-2 text-blue-600" />
          IT Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {user?.first_name}. Manage users, school site, and system configuration.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats?.studentCount ?? 0} icon={GraduationCap} color="blue" />
        <StatCard label="Active Staff" value={stats?.staffCount ?? 0} icon={Users} color="green" />
        <StatCard label="Active Users" value={stats?.activeUserCount ?? 0} icon={UserCheck} color="purple" />
        <StatCard label="Recent Logins" value={stats?.recentLogins?.length ?? 0} icon={Activity} color="amber" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="Add Staff Account" description="Create a new staff user" icon={UserPlus} to="/it-admin/users/new" />
          <QuickAction label="Manage Users" description="View and edit all school users" icon={Users} to="/it-admin/users" />
          <QuickAction label="Card Designer" description="Design student ID card templates" icon={CreditCard} to="/it-admin/cards" />
          <QuickAction label="Generate Cards" description="Create ID cards for students" icon={FileStack} to="/it-admin/cards/generate" />
          <QuickAction label="NFC Assignment" description="Encode NFC chips to student cards" icon={Wifi} to="/it-admin/cards/nfc" />
          <QuickAction label="School Website" description="Customize the public school site" icon={Globe} to="/it-admin/site" />
          <QuickAction label="Audit Logs" description="Review recent system activity" icon={Shield} to="/it-admin/system" />
          <QuickAction label="School Profile" description="Edit school name, logo & contact info" icon={Settings} to="/settings" />
          <QuickAction label="Transcript Designer" description="Customise transcript colours & signatories" icon={FileText} to="/it-admin/transcript" />
        </div>
      </div>

      {/* Two-column grid: Recent Logins + Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Logins */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              <Clock className="inline-block h-4 w-4 mr-1.5 text-slate-400" />
              Recent Logins
            </h3>
            <Link to="/it-admin/users" className="text-xs font-medium text-blue-600 hover:underline">
              View all users
            </Link>
          </div>
          {stats?.recentLogins?.length ? (
            <div className="space-y-2.5">
              {stats.recentLogins.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-400">{roleLabel(u.role)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No recent logins</p>
          )}
        </Card>

        {/* Recent Audit Logs */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              <Shield className="inline-block h-4 w-4 mr-1.5 text-slate-400" />
              Recent Activity
            </h3>
            <Link to="/it-admin/system" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {recentLogs.length ? (
            <div className="space-y-2.5">
              {recentLogs.map((log: { id: string; action: string; table_name?: string; created_at: string }) => (
                <div key={log.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{log.action}</p>
                    <p className="text-xs text-slate-400">{log.table_name ?? '—'}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
          )}
        </Card>
      </div>
    </div>
  );
}
