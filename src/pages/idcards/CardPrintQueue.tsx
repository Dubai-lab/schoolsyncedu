import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { nfcCardService } from '@/services/nfcService';
import type { NfcCardStatus } from '@/types/nfc.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, CreditCard, CheckCircle, XCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Designed', value: 'designed' },
  { label: 'Printed', value: 'printed' },
  { label: 'Encoded', value: 'encoded' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Replaced', value: 'replaced' },
];

const statusColor = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'active': return 'success';
    case 'designed': case 'printed': return 'info';
    case 'encoded': return 'warning';
    case 'inactive': case 'replaced': return 'danger';
    default: return 'default';
  }
};

type CardRow = {
  id: string;
  card_number: string;
  nfc_chip_id: string | null;
  status: NfcCardStatus;
  assigned_at: string | null;
  valid_until: string | null;
  created_at: string;
  students: { id: string; first_name: string; last_name: string; registration_number: string };
};

export default function CardPrintQueue() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useFetch(
    ['nfc-cards', schoolId, statusFilter],
    () => nfcCardService.list(schoolId, statusFilter ? statusFilter as NfcCardStatus : undefined),
    { enabled: !!schoolId },
  );

  const cards = (data?.data ?? []) as unknown as CardRow[];
  const totalCount = data?.count ?? 0;

  // Create card dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ student_id: '', card_number: '', valid_until: '' });

  const createCard = useMutate(
    () => nfcCardService.create({
      school_id: schoolId,
      student_id: form.student_id,
      card_number: form.card_number,
      valid_until: form.valid_until || undefined,
    }),
    [['nfc-cards']],
    {
      onSuccess: () => {
        notify.success('Card created');
        setShowCreate(false);
        setForm({ student_id: '', card_number: '', valid_until: '' });
      },
    },
  );

  const updateStatus = useMutate(
    (args: { id: string; status: NfcCardStatus }) => nfcCardService.updateStatus(args.id, args.status),
    [['nfc-cards']],
    { onSuccess: () => notify.success('Card status updated') },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Status counts
  const activeCount = cards.filter((c) => c.status === 'active').length;
  const pendingCount = cards.filter((c) => ['designed', 'printed', 'encoded'].includes(c.status)).length;

  const columns: Column<CardRow>[] = [
    {
      key: 'card_number', header: 'Card Number',
      render: (r) => <span className="font-mono text-sm font-medium">{r.card_number}</span>,
    },
    {
      key: 'student', header: 'Student',
      render: (r) => (
        <div>
          <span className="font-medium text-sm">{r.students.first_name} {r.students.last_name}</span>
          <p className="text-xs text-slate-400 font-mono">{r.students.registration_number}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={statusColor(r.status)} size="sm">{r.status}</Badge>,
    },
    {
      key: 'nfc_chip_id', header: 'NFC Chip',
      render: (r) => r.nfc_chip_id
        ? <span className="text-xs font-mono text-slate-600">{r.nfc_chip_id.slice(0, 12)}...</span>
        : <span className="text-slate-400 text-xs">Not encoded</span>,
    },
    {
      key: 'valid_until', header: 'Valid Until',
      render: (r) => r.valid_until
        ? <span className="text-sm">{new Date(r.valid_until).toLocaleDateString()}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.status === 'designed' && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: 'printed' })}>
              Mark Printed
            </Button>
          )}
          {r.status === 'printed' && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: 'encoded' })}>
              Mark Encoded
            </Button>
          )}
          {r.status === 'encoded' && (
            <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: 'active' })}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
          )}
          {r.status === 'active' && (
            <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: r.id, status: 'inactive' })}>
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'ID Cards', href: '/idcards' }, { label: 'Card Queue' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" /> Card Print Queue
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Issue Card
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          <p className="text-xs text-slate-500">Total Cards</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
      </div>

      {/* Filter */}
      <div className="w-48">
        <Select options={STATUS_OPTIONS} value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} />
      </div>

      <Table columns={columns} data={cards} keyExtractor={(r) => r.id} loading={isLoading}
        emptyMessage="No cards in the system." />

      {/* Issue Card Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Issue New Card</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Student ID *" value={form.student_id}
              onChange={(e) => set('student_id', e.target.value)} placeholder="Student UUID" />
            <Input label="Card Number *" value={form.card_number}
              onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. NFC-2026-0001" />
            <Input label="Valid Until" type="date" value={form.valid_until}
              onChange={(e) => set('valid_until', e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createCard.mutate(undefined)} loading={createCard.isPending}
            disabled={!form.student_id || !form.card_number}>
            Issue Card
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}