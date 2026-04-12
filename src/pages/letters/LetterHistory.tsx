import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { letterInstanceService, letterSendService } from '@/services/letterService';
import { LETTER_CATEGORIES, LETTER_INSTANCE_STATUS } from '@/utils/constants';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, FileText, CheckSquare, Printer, Mail, RefreshCw } from 'lucide-react';
import type { LetterCategory, LetterInstanceStatus } from '@/types/letter.types';

type LetterRow = {
  id: string;
  refNumber: string;
  studentName: string;
  templateName: string;
  category: string;
  status: string;
  createdAt: string;
};

const categoryOptions = Object.entries(LETTER_CATEGORIES).map(([, v]) => ({
  label: (v as string).charAt(0).toUpperCase() + (v as string).slice(1),
  value: v as string,
}));

const statusOptions = Object.entries(LETTER_INSTANCE_STATUS).map(([, v]) => ({
  label: (v as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
  value: v as string,
}));

function statusVariant(s: string) {
  if (s === 'sent' || s === 'approved') return 'success' as const;
  if (s === 'pending_approval') return 'warning' as const;
  if (s === 'draft') return 'default' as const;
  if (s === 'recalled' || s === 'voided') return 'danger' as const;
  return 'info' as const;
}

export default function LetterHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category: '', status: '' });
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: result, isLoading, refetch } = useFetch(
    ['letter-instances', schoolId, String(page), JSON.stringify(filters)],
    () => letterInstanceService.list(schoolId, {
      page, pageSize: 25,
      category: (filters.category as LetterCategory) || undefined,
      status: (filters.status as LetterInstanceStatus) || undefined,
    }),
    { enabled: !!schoolId },
  );

  const sendMutation = useMutate(
    (vars: { id: string }) => letterSendService.sendToGuardian(vars.id, schoolId, userId),
    [['letter-instances']],
    {
      onSuccess: (result) => {
        setSendingId(null);
        if ((result as { sent: boolean }).sent) {
          notify.success('Letter emailed to guardian');
          refetch();
        } else {
          notify.error((result as { reason?: string }).reason ?? 'Email failed');
        }
      },
      onError: (err: unknown) => {
        setSendingId(null);
        notify.error((err as Error).message ?? 'Email failed');
      },
    },
  );

  const rows: LetterRow[] = (result?.data ?? []).map((l) => {
    const student = l.students as Record<string, string> | undefined;
    const template = l.letter_templates as Record<string, string> | undefined;
    return {
      id: l.id,
      refNumber: l.reference_number,
      studentName: student ? `${student.first_name} ${student.last_name}` : '',
      templateName: template?.name ?? '',
      category: template?.category ?? '',
      status: l.status,
      createdAt: l.created_at,
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const columns: Column<LetterRow>[] = [
    { key: 'refNumber', header: 'Reference', render: (r) => <span className="font-mono text-xs text-slate-500">{r.refNumber}</span> },
    { key: 'studentName', header: 'Student', render: (r) => <span className="font-medium text-slate-900">{r.studentName}</span> },
    { key: 'templateName', header: 'Template' },
    { key: 'category', header: 'Category', render: (r) => <span className="capitalize text-sm">{r.category}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <Badge variant={statusVariant(r.status)} size="sm">{r.status.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'createdAt', header: 'Created', render: (r) => (
      <span className="text-sm text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
    )},
    {
      key: 'id', header: 'Email',
      render: (r) => {
        if (r.status === 'approved') {
          return (
            <Button
              size="sm"
              loading={sendingId === r.id && sendMutation.isPending}
              onClick={() => {
                setSendingId(r.id);
                sendMutation.mutate({ id: r.id });
              }}
              title="Send this letter to the student's guardian via email"
            >
              <Mail className="h-3.5 w-3.5 mr-1" /> Send Email
            </Button>
          );
        }
        if (r.status === 'sent') {
          return (
            <Button
              size="sm"
              variant="outline"
              loading={sendingId === r.id && sendMutation.isPending}
              onClick={() => {
                setSendingId(r.id);
                sendMutation.mutate({ id: r.id });
              }}
              title="Resend this letter to the guardian"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Resend
            </Button>
          );
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Letters' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Letters</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/letters/templates')}>
            <FileText className="h-4 w-4 mr-1" /> Templates
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/letters/approvals')}>
            <CheckSquare className="h-4 w-4 mr-1" /> Approvals
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/letters/print-queue')}>
            <Printer className="h-4 w-4 mr-1" /> Print Queue
          </Button>
          <Button size="sm" onClick={() => navigate('/letters/create')}>
            <Plus className="h-4 w-4 mr-1" /> Create Letter
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select label="Category" options={categoryOptions} value={filters.category}
          onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}
          placeholder="All Categories" className="w-44" />
        <Select label="Status" options={statusOptions} value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          placeholder="All Statuses" className="w-48" />
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No letters found." />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}