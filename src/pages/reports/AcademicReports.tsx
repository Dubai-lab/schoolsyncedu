import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { academicReportService } from '@/services/reportService';
import type { GradeReportSummary } from '@/types/grade.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { GraduationCap, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

export default function AcademicReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [classFilter, setClassFilter] = useState('');

  const { data: grades = [], isLoading } = useFetch<GradeReportSummary[]>(
    ['academic-reports', schoolId],
    () => academicReportService.getGradeReportSummary(schoolId),
    { enabled: !!schoolId }
  );

  // Derive unique classes for filter
  const classes = [...new Set(grades.map((g) => g.class_name).filter(Boolean))] as string[];
  const classOptions = [{ label: 'All Classes', value: '' }, ...classes.map((c) => ({ label: c, value: c }))];

  const filtered = classFilter ? grades.filter((g) => g.class_name === classFilter) : grades;

  // Summary stats
  const avgGpa = filtered.length
    ? (filtered.reduce((s, g) => s + (g.average_gpa ?? 0), 0) / filtered.length).toFixed(2)
    : '—';
  const highestAvg = filtered.length
    ? Math.max(...filtered.map((g) => g.average_gpa ?? 0)).toFixed(2)
    : '—';
  const lowestAvg = filtered.length
    ? Math.min(...filtered.filter((g) => g.average_gpa !== null).map((g) => g.average_gpa!)).toFixed(2)
    : '—';
  const totalStudents = filtered.length;

  const gpaColor = (gpa: number | null): 'success' | 'warning' | 'danger' | 'default' => {
    if (gpa === null) return 'default';
    if (gpa >= 3.5) return 'success';
    if (gpa >= 2.5) return 'warning';
    return 'danger';
  };

  const columns: Column<GradeReportSummary>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => `${row.first_name} ${row.last_name}`,
    },
    { key: 'class_name', header: 'Class', render: (row) => row.class_name ?? '—' },
    { key: 'term_name', header: 'Term', render: (row) => row.term_name ?? '—' },
    { key: 'subject_count', header: 'Subjects', render: (row) => row.subject_count },
    {
      key: 'average_gpa',
      header: 'Avg GPA',
      render: (row) => (
        <Badge variant={gpaColor(row.average_gpa)}>
          {row.average_gpa !== null ? row.average_gpa.toFixed(2) : '—'}
        </Badge>
      ),
    },
    {
      key: 'highest_grade',
      header: 'Highest',
      render: (row) => (row.highest_grade !== null ? row.highest_grade.toFixed(1) : '—'),
    },
    {
      key: 'lowest_grade',
      header: 'Lowest',
      render: (row) => (row.lowest_grade !== null ? row.lowest_grade.toFixed(1) : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Academic Reports' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Grade summaries and GPA distributions across classes and terms.
          </p>
        </div>
        <div className="w-48">
          <Select
            options={classOptions}
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalStudents}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average GPA</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{avgGpa}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Highest Avg GPA</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{highestAvg}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><TrendingDown className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lowest Avg GPA</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{lowestAvg}</p>
            </div>
          </div>
        </Card>
      </div>

      <Table<GradeReportSummary>
        columns={columns}
        data={filtered}
        keyExtractor={(r) => `${r.student_id}-${r.class_id}`}
        loading={isLoading}
        emptyMessage="No academic report data available."
      />
    </div>
  );
}
