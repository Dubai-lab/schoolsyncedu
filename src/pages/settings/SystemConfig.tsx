import { useFetch } from '@/hooks/useFetch';
import { systemConfigService } from '@/services/settingsService';
import type { SystemLog } from '@/types/user.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { Server, AlertTriangle, Info, Bug } from 'lucide-react';

const levelVariant = (level: string): 'success' | 'info' | 'warning' | 'danger' => {
  switch (level) {
    case 'ERROR': return 'danger';
    case 'WARN': return 'warning';
    case 'INFO': return 'info';
    default: return 'success';
  }
};

export default function SystemConfig() {
  const { data: logs = [], isLoading } = useFetch<SystemLog[]>(
    ['system-logs'],
    () => systemConfigService.getSystemLogs(100)
  );

  const errorCount = logs.filter((l) => l.log_level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.log_level === 'WARN').length;
  const infoCount = logs.filter((l) => l.log_level === 'INFO').length;

  const columns: Column<SystemLog>[] = [
    {
      key: 'log_level',
      header: 'Level',
      render: (row) => <Badge variant={levelVariant(row.log_level)}>{row.log_level}</Badge>,
    },
    { key: 'module', header: 'Module', render: (row) => row.module },
    { key: 'message', header: 'Message', render: (row) => row.message },
    {
      key: 'created_at',
      header: 'Time',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'System Config' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Configuration</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          System health overview and recent logs.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Errors</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{errorCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Bug className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Warnings</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{warnCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Info className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Info</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{infoCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* System Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Platform</span>
            <p className="font-medium text-gray-900 dark:text-white">SchoolSync / EduLiberia</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Backend</span>
            <p className="font-medium text-gray-900 dark:text-white">Supabase (PostgreSQL)</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Environment</span>
            <p className="font-medium text-gray-900 dark:text-white">{import.meta.env.MODE}</p>
          </div>
        </div>
      </Card>

      {/* Log Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recent System Logs</h2>
        <Table<SystemLog>
          columns={columns}
          data={logs}
          keyExtractor={(r) => r.id}
          loading={isLoading}
          emptyMessage="No system logs available."
        />
      </div>
    </div>
  );
}
