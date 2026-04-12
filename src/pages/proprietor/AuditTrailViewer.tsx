import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { proprietorAuditService, type AuditLog } from '@/services/proprietorService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { Search, Eye, Activity, Shield, AlertTriangle } from 'lucide-react';

export default function AuditTrailViewer() {
  const { user } = useAuth();
  const schoolId = user?.school_id;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading } = useFetch<AuditLog[]>(
    ['prop-audit', schoolId!],
    () => proprietorAuditService.getAuditLogs(schoolId!),
    { enabled: !!schoolId }
  );

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return ['ALL', ...Array.from(set).sort()];
  }, [logs]);

  const entities = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity_type).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (actionFilter !== 'ALL') result = result.filter((l) => l.action === actionFilter);
    if (entityFilter !== 'ALL') result = result.filter((l) => l.entity_type === entityFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (l) =>
          (l.description ?? '').toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, actionFilter, entityFilter, debouncedSearch]);

  const recentErrors = logs.filter((l) => l.action.toLowerCase().includes('error') || l.action.toLowerCase().includes('fail')).length;

  const columns: Column<AuditLog>[] = [
    { key: 'action', header: 'Action', render: (r) => <Badge variant="outline">{r.action.replace(/_/g, ' ')}</Badge> },
    { key: 'entity_type', header: 'Entity', render: (r) => <span className="text-sm capitalize">{r.entity_type.replace(/_/g, ' ')}</span> },
    {
      key: 'description',
      header: 'Description',
      render: (r) => <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">{r.description ?? '—'}</span>,
    },
    {
      key: 'created_at',
      header: 'Time',
      render: (r) => <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setViewLog(r)}>
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'Audit Trail' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review all activity across your school — who did what and when.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Activity className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{logs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><Shield className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Unique Actions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{actions.length - 1}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Issues</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{recentErrors}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search audit logs..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectCls}>
          {actions.map((a) => <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className={selectCls}>
          {entities.map((e) => <option key={e} value={e}>{e === 'ALL' ? 'All Entities' : e.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} results</span>
      </div>

      <Table<AuditLog>
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No audit logs match the current filters."
      />

      {/* Detail Modal */}
      <Dialog open={!!viewLog} onClose={() => setViewLog(null)} className="max-w-lg">
        <DialogHeader onClose={() => setViewLog(null)}>
          <DialogTitle>Audit Log Detail</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          {viewLog && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{viewLog.action.replace(/_/g, ' ')}</Badge>
                <span className="capitalize text-gray-500">{viewLog.entity_type.replace(/_/g, ' ')}</span>
              </div>
              {viewLog.description && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <p className="text-gray-900 dark:text-white">{viewLog.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">User ID</label>
                  <p className="font-mono text-xs text-gray-700">{viewLog.user_id}</p>
                </div>
                {viewLog.entity_id && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Entity ID</label>
                    <p className="font-mono text-xs text-gray-700">{viewLog.entity_id}</p>
                  </div>
                )}
              </div>
              {viewLog.ip_address && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">IP Address</label>
                  <p className="font-mono text-xs text-gray-700">{viewLog.ip_address}</p>
                </div>
              )}
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
    </div>
  );
}
