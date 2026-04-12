import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useMutate } from '@/hooks/useFetch';
import { printQueueService } from '@/services/letterService';
import { PRINT_QUEUE_STATUS } from '@/utils/constants';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Printer, Check, Truck } from 'lucide-react';
import type { PrintQueueStatus } from '@/types/letter.types';
import { notify } from '@/components/shared/Toast';

type QueueRow = {
  id: string;
  refNumber: string;
  studentName: string;
  priority: number;
  pageCount: number | null;
  reprintCount: number;
  status: string;
  createdAt: string;
};

const statusOptions = Object.entries(PRINT_QUEUE_STATUS).map(([, v]) => ({
  label: (v as string).charAt(0).toUpperCase() + (v as string).slice(1),
  value: v as string,
}));

function statusVariant(s: string) {
  if (s === 'distributed') return 'success' as const;
  if (s === 'printed') return 'info' as const;
  if (s === 'printing') return 'warning' as const;
  if (s === 'failed') return 'danger' as const;
  return 'default' as const;
}

export default function PrintQueue() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const [statusFilter, setStatusFilter] = useState('');

  const { data: items, isLoading } = useFetch(
    ['print-queue', schoolId, statusFilter],
    () => printQueueService.list(schoolId, (statusFilter as PrintQueueStatus) || undefined),
    { enabled: !!schoolId },
  );

  const updateStatus = useMutate(
    (vars: { id: string; status: PrintQueueStatus }) =>
      printQueueService.updateStatus(vars.id, vars.status, vars.status === 'distributed' ? userId : undefined),
    [['print-queue']],
    { onSuccess: () => notify.success('Status updated') },
  );

  const rows: QueueRow[] = (items ?? []).map((item) => {
    const inst = item.letter_instances as Record<string, unknown> | undefined;
    const student = (inst?.students ?? {}) as Record<string, string>;
    return {
      id: item.id,
      refNumber: (inst?.reference_number as string) ?? '',
      studentName: student.first_name ? `${student.first_name} ${student.last_name}` : '',
      priority: item.priority,
      pageCount: item.page_count,
      reprintCount: item.reprint_count,
      status: item.status,
      createdAt: item.created_at,
    };
  });

  const nextStatus = (s: string): PrintQueueStatus | null => {
    if (s === 'queued') return 'printing';
    if (s === 'printing') return 'printed';
    if (s === 'printed') return 'distributed';
    return null;
  };

  const actionIcon = (s: string) => {
    if (s === 'queued') return <Printer className="h-4 w-4 mr-1" />;
    if (s === 'printing') return <Check className="h-4 w-4 mr-1" />;
    return <Truck className="h-4 w-4 mr-1" />;
  };

  const actionLabel = (s: string) => {
    if (s === 'queued') return 'Print';
    if (s === 'printing') return 'Mark Printed';
    if (s === 'printed') return 'Distribute';
    return '';
  };

  const columns: Column<QueueRow>[] = [
    { key: 'refNumber', header: 'Reference', render: (r) => <span className="font-mono text-xs text-slate-500">{r.refNumber}</span> },
    { key: 'studentName', header: 'Student', render: (r) => <span className="font-medium text-slate-900">{r.studentName}</span> },
    { key: 'priority', header: 'Priority', render: (r) => (
      <Badge variant={r.priority >= 3 ? 'danger' : r.priority >= 2 ? 'warning' : 'default'} size="sm">{r.priority}</Badge>
    )},
    { key: 'pageCount', header: 'Pages', render: (r) => <span className="text-sm">{r.pageCount ?? '—'}</span> },
    { key: 'reprintCount', header: 'Reprints', render: (r) => <span className="text-sm">{r.reprintCount}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <Badge variant={statusVariant(r.status)} size="sm">{r.status}</Badge>
    )},
    { key: 'createdAt', header: 'Queued', render: (r) => (
      <span className="text-sm text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
    )},
    { key: 'id', header: '', render: (r) => {
      const next = nextStatus(r.status);
      if (!next) return null;
      return (
        <Button size="sm" variant="outline" loading={updateStatus.isPending}
          onClick={() => updateStatus.mutate({ id: r.id, status: next })}>
          {actionIcon(r.status)} {actionLabel(r.status)}
        </Button>
      );
    }},
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Letters', href: '/letters' }, { label: 'Print Queue' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Print Queue</h1>
        <Badge variant="info" size="sm">{rows.length} item{rows.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="flex gap-3">
        <Select label="Status" options={statusOptions} value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses" className="w-44" />
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="Print queue is empty." />
    </div>
  );
}