import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { studentService } from '@/services/studentService';
import type { StudentFilterParams, StudentStatus } from '@/types/student.types';
import Table, { type Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Search, Download } from 'lucide-react';

// ==================== STATUS BADGE ====================

const statusVariant: Record<StudentStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  enrolled: 'success',
  suspended: 'warning',
  expelled: 'danger',
  withdrawn: 'default',
  graduated: 'info',
  on_leave: 'warning',
};

// ==================== STUDENT ROW TYPE ====================

interface StudentRow {
  id: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  current_grade_level: string;
  status: StudentStatus;
  enrollment_date: string;
  guardians: { full_name: string; phone: string; relationship: string }[];
  student_enrollments?: { status: string }[];
}

// ==================== COLUMNS ====================

const columns: Column<StudentRow>[] = [
  {
    key: 'registration_number',
    header: 'Reg #',
    className: 'w-28',
    render: (row) => (
      <span className="font-mono text-xs text-slate-600">{row.registration_number}</span>
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
    key: 'current_grade_level',
    header: 'Grade',
    render: (row) => <span className="text-slate-600">{row.current_grade_level || '—'}</span>,
  },
  {
    key: 'guardian',
    header: 'Guardian',
    render: (row) => {
      const g = row.guardians?.[0];
      return g ? (
        <div>
          <p className="text-sm text-slate-700">{g.full_name}</p>
          <p className="text-xs text-slate-400">{g.phone}</p>
        </div>
      ) : <span className="text-slate-400">—</span>;
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => {
      const isPendingEnrollment = row.student_enrollments?.some(
        (e) => e.status === 'pending_payment',
      );
      if (isPendingEnrollment) {
        return <Badge variant="warning">Pending Enrollment</Badge>;
      }
      return (
        <Badge variant={statusVariant[row.status]}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      );
    },
  },
  {
    key: 'enrollment_date',
    header: 'Enrolled',
    render: (row) => (
      <span className="text-xs text-slate-500">
        {row.enrollment_date ? new Date(row.enrollment_date).toLocaleDateString() : '—'}
      </span>
    ),
  },
];

// ==================== FILTER OPTIONS ====================

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'On Leave', value: 'on_leave' },
  { label: 'Graduated', value: 'graduated' },
  { label: 'Withdrawn', value: 'withdrawn' },
  { label: 'Expelled', value: 'expelled' },
];

const genderOptions = [
  { label: 'All Genders', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

// ==================== COMPONENT ====================

export default function StudentList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  // Filters & pagination state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const filters: StudentFilterParams & { page: number; pageSize: number } = {
    search: debouncedSearch || undefined,
    status: (status || undefined) as StudentStatus | undefined,
    gender: (gender || undefined) as 'male' | 'female' | 'other' | undefined,
    page,
    pageSize: 20,
  };

  const { data, isLoading } = useFetch(
    ['students', schoolId, JSON.stringify(filters)],
    () => studentService.list(schoolId, filters),
    { enabled: !!schoolId },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Students' }]} />

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">
            {data?.total ?? 0} student{(data?.total ?? 0) !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/students/new')}>
            Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search name or reg number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-40"
        />
        <Select
          options={genderOptions}
          value={gender}
          onChange={(e) => { setGender(e.target.value); setPage(1); }}
          className="w-36"
        />
      </div>

      {/* Table */}
      <Table<StudentRow>
        columns={columns}
        data={(data?.data ?? []) as StudentRow[]}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        onRowClick={(row) => navigate(`/students/${row.id}`)}
        emptyMessage="No students found. Add your first student to get started."
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