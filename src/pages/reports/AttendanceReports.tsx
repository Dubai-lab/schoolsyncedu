import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { attendanceReportService } from '@/services/reportService';
import type { AttendanceSummaryByClass } from '@/types/attendance.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { CalendarCheck, Users, AlertTriangle, TrendingUp } from 'lucide-react';

export default function AttendanceReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: summaries = [], isLoading } = useFetch<AttendanceSummaryByClass[]>(
    ['attendance-reports', schoolId],
    () => attendanceReportService.getSummaryByClass(schoolId),
    { enabled: !!schoolId }
  );

  // Summary stats
  const totalStudents = summaries.reduce((s, r) => s + r.total_students, 0);
  const totalRecords = summaries.reduce((s, r) => s + r.total_attendance_records, 0);
  const overallRate = summaries.length
    ? (summaries.reduce((s, r) => s + r.attendance_percentage, 0) / summaries.length).toFixed(1)
    : '—';
  const lowClasses = summaries.filter((r) => r.attendance_percentage < 80).length;

  const rateColor = (pct: number): 'success' | 'warning' | 'danger' => {
    if (pct >= 90) return 'success';
    if (pct >= 75) return 'warning';
    return 'danger';
  };

  const columns: Column<AttendanceSummaryByClass>[] = [
    { key: 'class_name', header: 'Class', render: (row) => row.class_name },
    { key: 'term_name', header: 'Term', render: (row) => row.term_name },
    { key: 'total_students', header: 'Students', render: (row) => row.total_students },
    { key: 'total_attendance_records', header: 'Records', render: (row) => row.total_attendance_records },
    {
      key: 'attendance_percentage',
      header: 'Attendance %',
      render: (row) => <Badge variant={rateColor(row.attendance_percentage)}>{row.attendance_percentage.toFixed(1)}%</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Attendance Reports' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Attendance rates by class and term with trend indicators.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalStudents}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><CalendarCheck className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Records</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Rate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{overallRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Classes &lt; 80%</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{lowClasses}</p>
            </div>
          </div>
        </Card>
      </div>

      <Table<AttendanceSummaryByClass>
        columns={columns}
        data={summaries}
        keyExtractor={(r) => `${r.class_id}-${r.term_id}`}
        loading={isLoading}
        emptyMessage="No attendance report data available."
      />
    </div>
  );
}
