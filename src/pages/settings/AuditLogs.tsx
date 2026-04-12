import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { auditLogService } from '@/services/settingsService';
import type { AuditLog } from '@/types/user.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AuditLogs() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFetch<{ data: AuditLog[]; total: number }>(
    ['audit-logs', schoolId, String(page)],
    () => auditLogService.list(schoolId, page, PAGE_SIZE),
    { enabled: !!schoolId }
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Time',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    { key: 'action', header: 'Action', render: (row) => <Badge variant="info">{row.action}</Badge> },
    { key: 'entity_type', header: 'Entity', render: (row) => row.entity_type },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description ?? '—',
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (row) => (
        <span className="text-xs font-mono text-gray-500">{row.ip_address ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Audit Logs' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track user actions and system events across your school.
        </p>
      </div>

      <Card className="p-4 flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary-600" />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
          Total Events: <span className="text-gray-900 dark:text-white">{total.toLocaleString()}</span>
        </span>
      </Card>

      <Table<AuditLog>
        columns={columns}
        data={logs}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No audit logs found."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
