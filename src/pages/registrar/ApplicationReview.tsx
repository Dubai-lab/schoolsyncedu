import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { registrarService } from '@/services/registrarService';
import { classService } from '@/services/classService';
import type { StudentApplication, ApplicationStatus } from '@/types/application.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Search, Download, Filter, Info, DollarSign } from 'lucide-react';

// ==================== STATUS BADGE ====================

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  submitted: 'info',
  under_review: 'warning',
  documents_requested: 'warning',
  accepted: 'success',
  rejected: 'danger',
  waitlisted: 'default',
  enrolled: 'success',
  withdrawn: 'default',
};

// ==================== FILTER OPTIONS ====================

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Documents Requested', value: 'documents_requested' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Waitlisted', value: 'waitlisted' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

// gradeOptions is now dynamic — built from DB classes inside the component

// ==================== COLUMNS ====================

const columns: Column<StudentApplication>[] = [
  {
    key: 'application_number',
    header: 'App #',
    className: 'w-36',
    render: (row) => (
      <span className="font-mono text-xs text-slate-600">{row.application_number}</span>
    ),
  },
  {
    key: 'name',
    header: 'Student Name',
    render: (row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {row.first_name[0]}{row.last_name[0]}
        </div>
        <div>
          <p className="font-medium text-slate-800">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-slate-400 capitalize">{row.gender}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'grade_level_applied',
    header: 'Class Applied',
    render: (row) => <span className="font-medium text-slate-700">{row.grade_level_applied}</span>,
  },
  {
    key: 'guardian',
    header: 'Guardian',
    render: (row) => (
      <div>
        <p className="text-sm text-slate-700">{row.guardian_full_name}</p>
        <p className="text-xs text-slate-400">{row.guardian_phone}</p>
      </div>
    ),
  },
  {
    key: 'application_fee_paid',
    header: 'Fee',
    className: 'w-24',
    render: (row) => (
      row.application_fee_amount > 0 ? (
        <Badge variant={row.application_fee_paid ? 'success' : 'danger'} size="sm">
          <DollarSign className="h-3 w-3 mr-0.5" />
          {row.application_fee_paid ? 'Paid' : 'Unpaid'}
        </Badge>
      ) : (
        <span className="text-xs text-slate-400">Free</span>
      )
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge variant={statusVariant[row.status] ?? 'default'} size="sm">
        {row.status.replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    key: 'submitted_at',
    header: 'Submitted',
    render: (row) => (
      <span className="text-xs text-slate-500">
        {new Date(row.submitted_at).toLocaleDateString()}
      </span>
    ),
  },
];

// ==================== COMPONENT ====================

export default function ApplicationReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // Load classes created by the principal — used for "Class Applied" filter
  const { data: classesResult } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classFilterOptions = [
    { label: 'All Classes', value: '' },
    ...(classesResult?.data ?? []).map((c) => ({
      label: `${c.name}${c.grade_level ? ` (${c.grade_level})` : ''}`,
      value: c.name, // filter by class name (stored in grade_level_applied on applications)
    })),
  ];

  const { data, isLoading } = useFetch(
    ['registrar-applications', schoolId, debouncedSearch, status, grade, String(page)],
    () =>
      registrarService.listApplications(
        schoolId,
        {
          search: debouncedSearch || undefined,
          status: (status || undefined) as ApplicationStatus | undefined,
          gradeLevel: grade || undefined,
        },
        page,
        20,
      ),
    { enabled: !!schoolId },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Registrar', href: '/registrar' },
          { label: 'Applications' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Applications</h1>
          <p className="text-sm text-slate-500">
            {data?.total ?? 0} application{(data?.total ?? 0) !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={() => {
            const rows = data?.data ?? [];
            if (!rows.length) return;
            const headers = ['Application #', 'First Name', 'Last Name', 'Gender', 'Class Applied', 'Guardian', 'Guardian Phone', 'Status', 'Submitted'];
            const csvRows = rows.map((r) => [
              r.application_number,
              r.first_name,
              r.last_name,
              r.gender ?? '',
              r.grade_level_applied,
              r.guardian_full_name,
              r.guardian_phone,
              r.status,
              new Date(r.submitted_at).toLocaleDateString(),
            ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
            const csv = [headers.join(','), ...csvRows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export
        </Button>
      </div>

      {/* Fee gate info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          <strong>Finance gate active:</strong> Only applications whose application fee has been confirmed paid by Finance are shown here.
          Applications awaiting fee payment are handled by the Finance/Bursar office via <em>Application Fee Payments</em>.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search name, app # or guardian..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={classFilterOptions}
          value={grade}
          onChange={(e) => { setGrade(e.target.value); setPage(1); }}
          placeholder="All Classes"
          className="w-44"
        />
        {(status || grade || search) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Filter className="h-4 w-4" />}
            onClick={() => { setSearch(''); setStatus(''); setGrade(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Table<StudentApplication>
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        onRowClick={(row) => navigate(`/registrar/applications/${row.id}`)}
        emptyMessage="No applications found matching your filters."
      />

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
