import { useState, useMemo } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { systemHealthService } from '@/services/adminService';
import type { SystemLog, PlatformAdminUser } from '@/types/user.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { Server, AlertTriangle, Info, Bug, Users, ShieldCheck, Search, Eye } from 'lucide-react';

type LogLevel = 'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
const LOG_LEVELS: LogLevel[] = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

const levelVariant = (lvl: string): 'success' | 'info' | 'warning' | 'danger' => {
  switch (lvl) {
    case 'ERROR': return 'danger';
    case 'WARN': return 'warning';
    case 'INFO': return 'info';
    default: return 'success';
  }
};

export default function SystemHealth() {
  const [levelFilter, setLevelFilter] = useState<LogLevel>('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');
  const debouncedSearch = useDebounce(logSearch, 300);
  const [viewAdmin, setViewAdmin] = useState<PlatformAdminUser | null>(null);
  const [viewLog, setViewLog] = useState<SystemLog | null>(null);

  const { data: logs = [], isLoading: loadingLogs } = useFetch<SystemLog[]>(
    ['admin-sys-logs'],
    () => systemHealthService.getLogs(200)
  );

  const { data: admins = [], isLoading: loadingAdmins } = useFetch<PlatformAdminUser[]>(
    ['admin-platform-admins'],
    () => systemHealthService.getPlatformAdmins()
  );

  const modules = useMemo(() => {
    const set = new Set(logs.map((l) => l.module).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (levelFilter !== 'ALL') result = result.filter((l) => l.log_level === levelFilter);
    if (moduleFilter !== 'ALL') result = result.filter((l) => l.module === moduleFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((l) => l.message.toLowerCase().includes(q) || l.module?.toLowerCase().includes(q));
    }
    return result;
  }, [logs, levelFilter, moduleFilter, debouncedSearch]);

  const errorCount = logs.filter((l) => l.log_level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.log_level === 'WARN').length;
  const infoCount = logs.filter((l) => l.log_level === 'INFO').length;

  const logColumns: Column<SystemLog>[] = [
    { key: 'log_level', header: 'Level', render: (row) => <Badge variant={levelVariant(row.log_level)}>{row.log_level}</Badge> },
    { key: 'module', header: 'Module', render: (row) => <span className="font-mono text-xs">{row.module}</span> },
    { key: 'message', header: 'Message', render: (row) => <span className="text-sm line-clamp-1">{row.message}</span> },
    { key: 'created_at', header: 'Time', render: (row) => new Date(row.created_at).toLocaleString() },
    {
      key: 'actions', header: '', render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setViewLog(row)}>
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const adminColumns: Column<PlatformAdminUser>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'role', header: 'Role', render: (row) => <Badge variant="info">{row.role.replace(/_/g, ' ')}</Badge> },
    {
      key: 'is_active', header: 'Status',
      render: (row) => <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    { key: 'last_login', header: 'Last Login', render: (row) => (row.last_login ? new Date(row.last_login).toLocaleString() : 'Never') },
    {
      key: 'actions', header: '', render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setViewAdmin(row)}>
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'System Health' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor platform health, logs, and administrator accounts.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Errors</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{errorCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Bug className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Warnings</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{warnCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Info className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Info Logs</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{infoCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Platform Admins</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{admins.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Platform Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Info</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Platform</span>
            <p className="font-medium text-gray-900 dark:text-white">SchoolSync / EduLiberia</p>
          </div>
          <div>
            <span className="text-gray-500">Backend</span>
            <p className="font-medium text-gray-900 dark:text-white">Supabase PostgreSQL</p>
          </div>
          <div>
            <span className="text-gray-500">Environment</span>
            <p className="font-medium text-gray-900 dark:text-white">{import.meta.env.MODE}</p>
          </div>
          <div>
            <span className="text-gray-500">Region</span>
            <p className="font-medium text-gray-900 dark:text-white">Liberia (West Africa)</p>
          </div>
        </div>
      </Card>

      {/* Platform Admins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Administrators</h2>
        </div>
        <Table<PlatformAdminUser>
          columns={adminColumns}
          data={admins}
          keyExtractor={(r) => r.id}
          loading={loadingAdmins}
          emptyMessage="No platform administrators."
        />
      </div>

      {/* System Logs with Filters */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Logs <span className="text-sm font-normal text-gray-500">({filteredLogs.length})</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" placeholder="Search logs..." value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-48 pl-10 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as LogLevel)} className={selectCls}>
              {LOG_LEVELS.map((l) => <option key={l} value={l}>{l === 'ALL' ? 'All Levels' : l}</option>)}
            </select>
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selectCls}>
              {modules.map((m) => <option key={m} value={m}>{m === 'ALL' ? 'All Modules' : m}</option>)}
            </select>
          </div>
        </div>
        <Table<SystemLog>
          columns={logColumns}
          data={filteredLogs}
          keyExtractor={(r) => r.id}
          loading={loadingLogs}
          emptyMessage="No logs match the current filters."
        />
      </div>

      {/* ===== LOG DETAIL MODAL ===== */}
      <Dialog open={!!viewLog} onClose={() => setViewLog(null)} className="max-w-lg">
        <DialogHeader onClose={() => setViewLog(null)}>
          <DialogTitle>Log Detail</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          {viewLog && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={levelVariant(viewLog.log_level)}>{viewLog.log_level}</Badge>
                <span className="font-mono text-xs text-gray-500">{viewLog.module}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
                <p className="text-gray-900 dark:text-white">{viewLog.message}</p>
              </div>
              {viewLog.metadata && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Metadata</label>
                  <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs overflow-x-auto">
                    {JSON.stringify(viewLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Timestamp</label>
                <p className="text-gray-900 dark:text-white">{new Date(viewLog.created_at).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setViewLog(null)}>Close</Button>
        </DialogFooter>
      </Dialog>

      {/* ===== ADMIN DETAIL MODAL ===== */}
      <Dialog open={!!viewAdmin} onClose={() => setViewAdmin(null)} className="max-w-sm">
        <DialogHeader onClose={() => setViewAdmin(null)}>
          <DialogTitle>Admin Detail</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {viewAdmin && (
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-500">Name</label>
                <p className="font-medium text-gray-900 dark:text-white">{viewAdmin.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Email</label>
                <p className="text-gray-900 dark:text-white">{viewAdmin.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="info">{viewAdmin.role.replace(/_/g, ' ')}</Badge>
                <Badge variant={viewAdmin.is_active ? 'success' : 'danger'}>{viewAdmin.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Last Login</label>
                <p className="text-gray-900 dark:text-white">{viewAdmin.last_login ? new Date(viewAdmin.last_login).toLocaleString() : 'Never'}</p>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setViewAdmin(null)}>Close</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
