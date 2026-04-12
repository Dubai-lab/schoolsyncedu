import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { studentService, enrollmentService } from '@/services/studentService';
import { notify } from '@/components/shared/Toast';
import Table, { type Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Modal from '@/components/shared/Modal';
import { Plus, Search } from 'lucide-react';
import type { EnrollmentStatus } from '@/types/common.types';

// ==================== TYPES ====================

interface EnrollmentRow {
  id: string;
  student_id: string;
  academic_year: string;
  enrollment_date: string;
  status: EnrollmentStatus;
  notes: string | null;
  // Joined
  first_name?: string;
  last_name?: string;
  registration_number?: string;
}

// ==================== COMPONENT ====================

export default function StudentEnrollment() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Quick-enroll modal
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollYear, setEnrollYear] = useState('');

  // Fetch students with their enrollments
  const { data: studentData, isLoading } = useFetch(
    ['students', schoolId, debouncedSearch],
    () => studentService.list(schoolId, { search: debouncedSearch || undefined, pageSize: 100 }),
    { enabled: !!schoolId },
  );

  // Flatten for display — show each student's latest enrollment info
  const rows: EnrollmentRow[] = (studentData?.data ?? []).map((s) => ({
    id: s.id,
    student_id: s.id,
    academic_year: '', // will be populated per enrollment in a full implementation
    enrollment_date: s.enrollment_date ?? '',
    status: (s.status === 'enrolled' ? 'active' : 'withdrawn') as EnrollmentStatus,
    notes: null,
    first_name: s.first_name,
    last_name: s.last_name,
    registration_number: s.registration_number,
  }));

  const filteredRows = yearFilter
    ? rows.filter((r) => r.academic_year === yearFilter)
    : rows;

  const enrollMutation = useMutate(
    (vars: { studentId: string; year: string }) =>
      enrollmentService.create({
        student_id: vars.studentId,
        school_id: schoolId,
        academic_year: vars.year,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active',
        notes: null,
      }),
    [['students']],
    {
      onSuccess: () => {
        notify.success('Student enrolled for academic year');
        setEnrollModal(false);
      },
      onError: () => notify.error('Enrollment failed'),
    },
  );

  const columns: Column<EnrollmentRow>[] = [
    {
      key: 'registration_number',
      header: 'Reg #',
      className: 'w-28',
      render: (row) => <span className="font-mono text-xs">{row.registration_number}</span>,
    },
    {
      key: 'name',
      header: 'Student',
      render: (row) => <span className="font-medium text-slate-800">{row.first_name} {row.last_name}</span>,
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
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'completed' ? 'info' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { label: 'All Years', value: '' },
    ...Array.from({ length: 5 }, (_, i) => ({
      label: `${currentYear - i}/${currentYear - i + 1}`,
      value: `${currentYear - i}/${currentYear - i + 1}`,
    })),
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Students', href: '/students' },
        { label: 'Enrollment' },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Enrollment</h1>
          <p className="text-sm text-slate-500">{filteredRows.length} records</p>
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEnrollModal(true)}>
          Quick Enroll
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select options={yearOptions} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-44" />
      </div>

      <Table<EnrollmentRow>
        columns={columns}
        data={filteredRows}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No enrollment records found."
      />

      {/* Quick Enroll modal */}
      <Modal
        open={enrollModal}
        onClose={() => setEnrollModal(false)}
        title="Quick Enroll Student"
        description="Enroll a student for a new academic year."
        confirmLabel="Enroll"
        onConfirm={() => enrollMutation.mutate({ studentId: enrollStudentId, year: enrollYear })}
        loading={enrollMutation.isPending}
      >
        <div className="space-y-4">
          <Input
            label="Student ID"
            value={enrollStudentId}
            onChange={(e) => setEnrollStudentId(e.target.value)}
            placeholder="Paste student UUID"
          />
          <Select
            label="Academic Year"
            options={yearOptions.slice(1)}
            value={enrollYear}
            onChange={(e) => setEnrollYear(e.target.value)}
            placeholder="Select year"
          />
        </div>
      </Modal>
    </div>
  );
}