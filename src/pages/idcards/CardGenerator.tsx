import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { cardDesignService, cardGenerationService } from '@/services/nfcService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Printer, Download, FileStack } from 'lucide-react';

const statusColor = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
  switch (s) {
    case 'completed': return 'success';
    case 'in_progress': return 'warning';
    case 'failed': return 'danger';
    default: return 'default';
  }
};

type BatchRow = {
  id: string;
  batch_number: string;
  total_cards: number;
  generated_cards: number;
  failed_cards: number;
  pdf_url: string | null;
  status: string;
  created_at: string;
  id_card_designs: { id: string; name: string } | null;
};

export default function CardGenerator() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: batches, isLoading } = useFetch(
    ['card-generations', schoolId],
    () => cardGenerationService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: designs } = useFetch(
    ['card-designs', schoolId],
    () => cardDesignService.list(schoolId),
    { enabled: !!schoolId },
  );

  const designOptions = (designs ?? []).map((d) => ({ label: d.name, value: d.id }));

  // Generate dialog
  const [showGenerate, setShowGenerate] = useState(false);
  const [form, setForm] = useState({
    design_id: '', batch_number: '', total_cards: '50',
    grade_filter: '',
  });

  const generateBatch = useMutate(
    () => cardGenerationService.create(schoolId, {
      design_id: form.design_id,
      batch_number: form.batch_number || `BATCH-${Date.now()}`,
      student_range: form.grade_filter ? { filter: { grade_level: form.grade_filter } } : {},
      total_cards: Number(form.total_cards),
      generated_by: user?.id ?? '',
    }),
    [['card-generations']],
    {
      onSuccess: () => {
        notify.success('Card generation batch started');
        setShowGenerate(false);
        setForm({ design_id: '', batch_number: '', total_cards: '50', grade_filter: '' });
      },
    },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const columns: Column<BatchRow>[] = [
    {
      key: 'batch_number', header: 'Batch',
      render: (r) => <span className="font-mono text-sm font-medium">{r.batch_number}</span>,
    },
    {
      key: 'design', header: 'Design',
      render: (r) => <span className="text-sm">{r.id_card_designs?.name ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={statusColor(r.status)} size="sm">{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'progress', header: 'Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-2 w-24">
            <div className="bg-blue-500 rounded-full h-2 transition-all"
              style={{ width: `${r.total_cards > 0 ? (r.generated_cards / r.total_cards) * 100 : 0}%` }} />
          </div>
          <span className="text-xs text-slate-500">{r.generated_cards}/{r.total_cards}</span>
        </div>
      ),
    },
    {
      key: 'failed_cards', header: 'Failed',
      render: (r) => r.failed_cards > 0
        ? <Badge variant="danger" size="sm">{r.failed_cards}</Badge>
        : <span className="text-slate-400">0</span>,
    },
    {
      key: 'created_at', header: 'Date',
      render: (r) => <span className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => r.pdf_url ? (
        <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
        </a>
      ) : null,
    },
  ];

  // Summary stats
  const batchList = (batches ?? []) as unknown as BatchRow[];
  const totalGenerated = batchList.reduce((s, b) => s + b.generated_cards, 0);
  const totalFailed = batchList.reduce((s, b) => s + b.failed_cards, 0);
  const inProgress = batchList.filter((b) => b.status === 'in_progress').length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'ID Cards', href: '/idcards' }, { label: 'Generate Cards' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileStack className="h-5 w-5 text-blue-500" /> Card Generation
        </h1>
        <Button onClick={() => setShowGenerate(true)} disabled={designOptions.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Generate Batch
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalGenerated}</p>
          <p className="text-xs text-slate-500">Cards Generated</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{inProgress}</p>
          <p className="text-xs text-slate-500">In Progress</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
          <p className="text-xs text-slate-500">Failed</p>
        </div>
      </div>

      <Table columns={columns} data={batchList} keyExtractor={(r) => r.id} loading={isLoading}
        emptyMessage="No card generation batches yet." />

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onClose={() => setShowGenerate(false)}>
        <DialogHeader><DialogTitle>Generate ID Cards</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Card Design *" options={designOptions} value={form.design_id}
              onChange={(e) => set('design_id', e.target.value)} placeholder="Select design" />
            <Input label="Batch Number" value={form.batch_number}
              onChange={(e) => set('batch_number', e.target.value)} placeholder="Auto-generated if empty" />
            <Input label="Total Cards *" type="number" value={form.total_cards}
              onChange={(e) => set('total_cards', e.target.value)} />
            <Input label="Grade Level Filter" value={form.grade_filter}
              onChange={(e) => set('grade_filter', e.target.value)} placeholder="e.g. Grade 10 (optional)" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
          <Button onClick={() => generateBatch.mutate(undefined)} loading={generateBatch.isPending}
            disabled={!form.design_id || !form.total_cards}>
            <Printer className="h-4 w-4 mr-1" /> Generate
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}