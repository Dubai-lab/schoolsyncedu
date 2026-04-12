import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { itAdminSystemService } from '@/services/itAdminService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';

// ==================== TYPES ====================

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  ip_address: string | null;
  created_at: string;
}

// ==================== ROLE LABEL ====================

const roleLabel = (r: string): string => {
  const map: Record<string, string> = {
    proprietor: 'Proprietor',
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
    student: 'Student',
    parent: 'Parent',
  };
  return map[r] ?? r;
};

const roleColor = (r: string): string => {
  const map: Record<string, string> = {
    proprietor: 'bg-purple-100 text-purple-700',
    principal: 'bg-red-100 text-red-700',
    vice_principal: 'bg-red-50 text-red-600',
    teacher: 'bg-blue-100 text-blue-700',
    admin_staff: 'bg-slate-100 text-slate-700',
    it_admin: 'bg-cyan-100 text-cyan-700',
    student: 'bg-emerald-100 text-emerald-700',
    parent: 'bg-amber-100 text-amber-700',
  };
  return map[r] ?? 'bg-slate-100 text-slate-700';
};

// ==================== MAIN COMPONENT ====================

export default function SystemOverview() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Audit logs
  const { data: logsData, isLoading: logsLoading } = useFetch(
    ['it-admin-audit', schoolId, String(page)],
    () => itAdminSystemService.getAuditLogs(schoolId, page, pageSize),
    { enabled: !!schoolId },
  );

  const logs = (logsData?.data ?? []) as AuditLog[];
  const totalLogs = logsData?.total ?? 0;
  const totalPages = Math.ceil(totalLogs / pageSize);

  // Role counts
  const { data: roleCounts = {} } = useFetch<Record<string, number>>(
    ['it-admin-role-counts', schoolId],
    () => itAdminSystemService.getUserRoleCounts(schoolId),
    { enabled: !!schoolId },
  );

  const totalUsers = Object.values(roleCounts).reduce((s, c) => s + c, 0);

  // Table columns for audit logs
  const columns: Column<AuditLog>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span className="text-sm font-medium text-slate-700">{row.action}</span>
      ),
    },
    {
      key: 'table_name',
      header: 'Table',
      render: (row) => (
        <Badge variant="default">{row.table_name ?? '—'}</Badge>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP',
      render: (row) => (
        <span className="text-sm text-slate-400 font-mono">{row.ip_address ?? '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Time',
      render: (row) => (
        <span className="text-sm text-slate-400">
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'System Overview' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Activity className="inline-block h-6 w-6 mr-2 text-blue-600" />
          System Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor user distribution, audit trail, and system activity.
        </p>
      </div>

      {/* Role Distribution */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">User Distribution</h2>
          <span className="ml-auto text-sm text-slate-400">{totalUsers} total active users</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Object.entries(roleCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([role, count]) => (
              <div
                key={role}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
              >
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${roleColor(role)}`}>
                  {roleLabel(role)}
                </span>
                <span className="ml-auto text-sm font-bold text-slate-700">{count}</span>
              </div>
            ))}
          {Object.keys(roleCounts).length === 0 && (
            <p className="text-sm text-slate-400 col-span-full text-center py-4">No user data available</p>
          )}
        </div>
      </Card>

      {/* Audit Logs */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Audit Trail</h2>
          <span className="ml-auto text-sm text-slate-400">{totalLogs} entries</span>
        </div>

        <Table
          columns={columns}
          data={logs}
          isLoading={logsLoading}
          emptyMessage="No audit logs found."
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
