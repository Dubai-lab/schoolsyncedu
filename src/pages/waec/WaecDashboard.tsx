import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { waecSessionService, waecCandidateService } from '@/services/waecService';
import { notify } from '@/components/shared/Toast';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import {
  ClipboardList,
  Plus,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import type { WaecExamSession, WaecExamType, CreateExamSessionForm } from '@/types/waec.types';

const currentYear = new Date().getFullYear();

function statusVariant(isActive: boolean) {
  return isActive ? ('success' as const) : ('default' as const);
}

export default function WaecDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState<CreateExamSessionForm>({
    examType: 'WASSCE',
    academicYear: `${currentYear}-${currentYear + 1}`,
    examYear: currentYear + 1,
    registrationDeadline: '',
    feePerCandidateUsd: 0,
    feePerSubjectUsd: 0,
  });

  // Fetch sessions
  const { data: sessions = [], isLoading } = useFetch<WaecExamSession[]>(
    ['waec-sessions', schoolId],
    () => waecSessionService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch all candidates for stats
  const { data: allCandidates = [] } = useFetch(
    ['waec-candidates-all', schoolId],
    () => waecCandidateService.listBySchool(schoolId),
    { enabled: !!schoolId },
  );

  const createMutation = useMutate(
    (f: CreateExamSessionForm) => waecSessionService.create(schoolId, f),
    [['waec-sessions', schoolId]],
  );

  const handleCreate = async () => {
    if (!form.registrationDeadline) {
      notify.error('Registration deadline is required');
      return;
    }
    try {
      await createMutation.mutateAsync(form);
      notify.success('Exam session created');
      setShowCreateDialog(false);
      setForm({
        examType: 'WASSCE',
        academicYear: `${currentYear}-${currentYear + 1}`,
        examYear: currentYear + 1,
        registrationDeadline: '',
        feePerCandidateUsd: 0,
        feePerSubjectUsd: 0,
      });
    } catch {
      notify.error('Failed to create session');
    }
  };

  // Stats
  const totalCandidates = allCandidates.length;
  const submitted = allCandidates.filter((c) => ['submitted', 'confirmed'].includes(c.status)).length;
  const pendingPayment = allCandidates.filter((c) => !c.registration_fee_paid).length;
  const activeSessions = sessions.filter((s) => s.is_active).length;

  const stats = [
    { label: 'Active Sessions', value: activeSessions, icon: ClipboardList, color: 'text-blue-600 bg-blue-100' },
    { label: 'Total Candidates', value: totalCandidates, icon: Users, color: 'text-purple-600 bg-purple-100' },
    { label: 'Submitted / Confirmed', value: submitted, icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    { label: 'Pending Payment', value: pendingPayment, icon: DollarSign, color: 'text-amber-600 bg-amber-100' },
  ];

  const sessionColumns: Column<WaecExamSession>[] = [
    { key: 'exam_type', header: 'Exam', render: (row) => <span className="font-medium">{row.exam_type}</span> },
    { key: 'academic_year', header: 'Academic Year' },
    { key: 'exam_year', header: 'Exam Year' },
    {
      key: 'registration_deadline',
      header: 'Deadline',
      render: (row) => new Date(row.registration_deadline).toLocaleDateString(),
    },
    {
      key: 'fee_per_candidate_usd',
      header: 'Fee / Candidate',
      render: (row) => `$${Number(row.fee_per_candidate_usd).toFixed(2)}`,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <Badge variant={statusVariant(row.is_active)}>{row.is_active ? 'Active' : 'Closed'}</Badge>
      ),
    },
  ];

  const examTypeOptions = [
    { label: 'WASSCE (Grade 12)', value: 'WASSCE' },
    { label: 'LJHSCE (Grade 9)', value: 'LJHSCE' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'WAEC', href: '/waec' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WAEC Exam Registration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register candidates for LJHSCE and WASSCE examinations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/waec/candidates')}>
            <Users className="mr-2 h-4 w-4" /> Candidates
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Session
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sessions table */}
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Exam Sessions</h2>
        <Table
          columns={sessionColumns}
          data={sessions}
          keyExtractor={(r) => r.id}
          loading={isLoading}
          emptyMessage="No exam sessions yet. Create one to start registering candidates."
          onRowClick={(row) => navigate(`/waec/candidates?session=${row.id}`)}
        />
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className="cursor-pointer p-4 transition-shadow hover:shadow-md"
          onClick={() => navigate('/waec/register')}
        >
          <div className="flex items-center gap-3">
            <Plus className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium text-slate-900">Register Candidate</p>
              <p className="text-xs text-slate-500">Add a new student to an exam session</p>
            </div>
          </div>
        </Card>
        <Card
          className="cursor-pointer p-4 transition-shadow hover:shadow-md"
          onClick={() => navigate('/waec/candidates')}
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium text-slate-900">Candidate List</p>
              <p className="text-xs text-slate-500">View and manage all registered candidates</p>
            </div>
          </div>
        </Card>
        <Card
          className="cursor-pointer p-4 transition-shadow hover:shadow-md"
          onClick={() => navigate('/waec/results')}
        >
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium text-slate-900">Exam Results</p>
              <p className="text-xs text-slate-500">View published WAEC results</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Session Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogHeader>
          <DialogTitle>Create Exam Session</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <Select
              label="Exam Type"
              options={examTypeOptions}
              value={form.examType}
              onChange={(e) => setForm({ ...form, examType: e.target.value as WaecExamType })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Academic Year"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                placeholder="2025-2026"
              />
              <Input
                label="Exam Year"
                type="number"
                value={String(form.examYear)}
                onChange={(e) => setForm({ ...form, examYear: Number(e.target.value) })}
              />
            </div>
            <Input
              label="Registration Deadline"
              type="date"
              value={form.registrationDeadline}
              onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fee per Candidate (USD)"
                type="number"
                value={String(form.feePerCandidateUsd)}
                onChange={(e) => setForm({ ...form, feePerCandidateUsd: Number(e.target.value) })}
              />
              <Input
                label="Fee per Subject (USD)"
                type="number"
                value={String(form.feePerSubjectUsd)}
                onChange={(e) => setForm({ ...form, feePerSubjectUsd: Number(e.target.value) })}
              />
            </div>
            <Input
              label="Notes (optional)"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={createMutation.isPending}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
