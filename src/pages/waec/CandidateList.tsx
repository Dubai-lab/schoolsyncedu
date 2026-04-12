import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { waecCandidateService, waecSessionService } from '@/services/waecService';
import { notify } from '@/components/shared/Toast';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { Plus, DollarSign, Send, XCircle } from 'lucide-react';
import type {
  WaecCandidateWithStudent,
  WaecExamSession,
  WaecExamType,
  RegistrationStatus,
} from '@/types/waec.types';
import { REGISTRATION_STATUS_LABELS } from '@/types/waec.types';

function statusVariant(status: RegistrationStatus) {
  switch (status) {
    case 'confirmed': return 'success' as const;
    case 'submitted': return 'info' as const;
    case 'payment_confirmed': return 'info' as const;
    case 'pending_payment': return 'warning' as const;
    case 'draft': return 'default' as const;
    case 'rejected': return 'danger' as const;
    default: return 'default' as const;
  }
}

export default function CandidateList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const schoolId = user?.school_id ?? '';

  const sessionFromUrl = searchParams.get('session') ?? '';
  const [filterExam, setFilterExam] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [rejectDialog, setRejectDialog] = useState<{ id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch sessions for filter dropdown
  useFetch<WaecExamSession[]>(
    ['waec-sessions', schoolId],
    () => waecSessionService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch candidates
  const { data: candidates = [], isLoading } = useFetch<WaecCandidateWithStudent[]>(
    ['waec-candidates', schoolId, filterExam, filterStatus, sessionFromUrl],
    () =>
      waecCandidateService.listBySchool(schoolId, {
        examType: (filterExam || undefined) as WaecExamType | undefined,
        status: (filterStatus || undefined) as RegistrationStatus | undefined,
      }),
    { enabled: !!schoolId },
  );

  // Filter by session URL param if present
  const filteredCandidates = sessionFromUrl
    ? candidates.filter((c) => c.session_id === sessionFromUrl)
    : candidates;

  const markPaidMutation = useMutate(
    (id: string) => waecCandidateService.markFeePaid(id),
    [['waec-candidates', schoolId]],
  );

  const updateStatusMutation = useMutate(
    ({ id, status, reason }: { id: string; status: RegistrationStatus; reason?: string }) =>
      waecCandidateService.updateStatus(id, status, { rejectionReason: reason }),
    [['waec-candidates', schoolId], ['waec-candidates-all', schoolId]],
  );

  const handleMarkPaid = async (id: string) => {
    try {
      await markPaidMutation.mutateAsync(id);
      notify.success('Payment marked as received');
    } catch {
      notify.error('Failed to update payment');
    }
  };

  const handleSubmitToWaec = async (id: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: 'submitted' });
      notify.success('Candidate submitted to WAEC');
    } catch {
      notify.error('Failed to submit');
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: rejectDialog.id,
        status: 'rejected',
        reason: rejectionReason,
      });
      notify.success('Candidate registration rejected');
      setRejectDialog(null);
      setRejectionReason('');
    } catch {
      notify.error('Failed to reject');
    }
  };

  const columns: Column<WaecCandidateWithStudent>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-slate-400">{row.class_name ?? 'No class'}</p>
        </div>
      ),
    },
    { key: 'exam_type', header: 'Exam', render: (row) => <span className="font-medium">{row.exam_type}</span> },
    { key: 'grade_level', header: 'Grade' },
    {
      key: 'subject_count',
      header: 'Subjects',
      render: (row) => <span>{row.subject_count} subjects</span>,
    },
    {
      key: 'registration_fee_paid',
      header: 'Fee Paid',
      render: (row) => (
        <Badge variant={row.registration_fee_paid ? 'success' : 'warning'}>
          {row.registration_fee_paid ? 'Paid' : 'Unpaid'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>
          {REGISTRATION_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'candidate_number',
      header: 'Candidate #',
      render: (row) => row.candidate_number ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          {!row.registration_fee_paid && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handleMarkPaid(row.id); }}
              title="Mark fee paid"
            >
              <DollarSign className="h-3 w-3" />
            </Button>
          )}
          {row.registration_fee_paid && row.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handleSubmitToWaec(row.id); }}
              title="Submit to WAEC"
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
          {['draft', 'pending_payment'].includes(row.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setRejectDialog({ id: row.id, name: `${row.first_name} ${row.last_name}` });
              }}
              title="Reject"
            >
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const examOptions = [
    { label: 'All Exams', value: '' },
    { label: 'WASSCE', value: 'WASSCE' },
    { label: 'LJHSCE', value: 'LJHSCE' },
  ];

  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Payment', value: 'pending_payment' },
    { label: 'Payment Confirmed', value: 'payment_confirmed' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'WAEC', href: '/waec' },
          { label: 'Candidates' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WAEC Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filteredCandidates.length} registered candidate{filteredCandidates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/waec/register')}>
          <Plus className="mr-2 h-4 w-4" /> Register Candidate
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Select
              label="Exam Type"
              options={examOptions}
              value={filterExam}
              onChange={(e) => setFilterExam(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              label="Status"
              options={statusOptions}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            />
          </div>
          {sessionFromUrl && (
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => navigate('/waec/candidates')}>
                Clear Session Filter
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        data={filteredCandidates}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No candidates registered yet."
      />

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)}>
        <DialogHeader>
          <DialogTitle>Reject Registration</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="mb-3 text-sm text-slate-600">
            Reject registration for <strong>{rejectDialog?.name}</strong>?
          </p>
          <Input
            label="Reason (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter rejection reason..."
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleReject} loading={updateStatusMutation.isPending}>
            Reject
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
