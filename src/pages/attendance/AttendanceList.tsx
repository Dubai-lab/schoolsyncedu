import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { attendanceService } from '@/services/attendanceService';
import type { AttendanceStatus, AttendanceFilterParams } from '@/types/attendance.types';
import Table, { type Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Download } from 'lucide-react';

// ==================== STATUS BADGE ====================

const statusVariant: Record<AttendanceStatus, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
  unexcused: 'warning',
  medical_leave: 'default',
};

// ==================== ROW TYPE ====================

interface AttRow {
  id: string;
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
  students: { first_name: string; last_name: string; registration_number: string };
  classes: { name: string };
}

// ==================== COLUMNS ====================

const columns: Column<AttRow>[] = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => (
      <span className="text-sm text-slate-700">
        {new Date(row.attendance_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </span>
    ),
  },
  {
    key: 'student',
    header: 'Student',
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-slate-800">
          {row.students.first_name} {row.students.last_name}
        </p>
        <p className="text-xs text-slate-400 font-mono">{row.students.registration_number}</p>
      </div>
    ),
  },
  {
    key: 'class',
    header: 'Class',
    render: (row) => <span className="text-sm text-slate-600">{row.classes.name}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge variant={statusVariant[row.status]}>
        {row.status.replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (row) => (
      <span className="text-xs text-slate-400 truncate max-w-[200px] inline-block">
        {row.notes || '—'}
      </span>
    ),
  },
];

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Late', value: 'late' },
  { label: 'Excused', value: 'excused' },
  { label: 'Unexcused', value: 'unexcused' },
  { label: 'Medical Leave', value: 'medical_leave' },
];

// ==================== COMPONENT ====================

export default function AttendanceList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Fetch classes for filter dropdown
  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => attendanceService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  const filters: AttendanceFilterParams & { page: number; pageSize: number } = {
    classId: classFilter || undefined,
    status: (statusFilter || undefined) as AttendanceStatus | undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 30,
  };

  const { data, isLoading } = useFetch(
    ['attendance-list', schoolId, JSON.stringify(filters)],
    () => attendanceService.list(schoolId, filters),
    { enabled: !!schoolId },
  );

  const classOptions = [
    { label: 'All Classes', value: '' },
    ...(classes ?? []).map((c) => ({
      label: `${c.name} — ${c.grade_level || ''}`,
      value: c.id,
    })),
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Attendance' }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance Records</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>Export</Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/attendance/mark')}>
            Mark Attendance
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          options={classOptions}
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-40"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="From"
          className="w-40"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          placeholder="To"
          className="w-40"
        />
      </div>

      {/* Table */}
      <Table<AttRow>
        columns={columns}
        data={(data?.data ?? []) as AttRow[]}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No attendance records found."
      />

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}