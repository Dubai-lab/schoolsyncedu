import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { waecCandidateService } from '@/services/waecService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { ArrowLeft, Clock } from 'lucide-react';
import type { WaecCandidateWithStudent, RegistrationStatus } from '@/types/waec.types';
import { REGISTRATION_STATUS_LABELS } from '@/types/waec.types';

function statusVariant(status: RegistrationStatus) {
  switch (status) {
    case 'confirmed': return 'success' as const;
    case 'submitted': return 'info' as const;
    default: return 'default' as const;
  }
}

export default function ExamResults() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  // Only show confirmed/submitted candidates (those who went through to WAEC)
  const { data: allCandidates = [], isLoading } = useFetch(
    ['waec-candidates-results', schoolId],
    () => waecCandidateService.listBySchool(schoolId, { status: 'confirmed' }),
    { enabled: !!schoolId },
  );

  const columns: Column<WaecCandidateWithStudent>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-slate-400">{row.class_name ?? '—'}</p>
        </div>
      ),
    },
    { key: 'exam_type', header: 'Exam' },
    { key: 'candidate_number', header: 'Candidate #', render: (row) => row.candidate_number ?? '—' },
    { key: 'subject_count', header: 'Subjects', render: (row) => `${row.subject_count}` },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{REGISTRATION_STATUS_LABELS[row.status]}</Badge>,
    },
    {
      key: 'confirmed_at',
      header: 'Confirmed',
      render: (row) => row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString() : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'WAEC', href: '/waec' },
          { label: 'Exam Results' },
        ]}
      />

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/waec')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WAEC Exam Results</h1>
          <p className="text-sm text-slate-500">Confirmed candidates awaiting WAEC results</p>
        </div>
      </div>

      {/* Info banner */}
      <Card className="border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Results are published by WAEC</p>
            <p>This page shows confirmed candidates. Results will be available once WAEC publishes them.</p>
          </div>
        </div>
      </Card>

      <Table
        columns={columns}
        data={allCandidates}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No confirmed candidates yet. Candidates will appear here once confirmed by WAEC."
      />
    </div>
  );
}
