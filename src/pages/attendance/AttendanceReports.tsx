import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { attendanceService } from '@/services/attendanceService';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export default function AttendanceReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [selectedClass, setSelectedClass] = useState('');
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split('T')[0]);

  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => attendanceService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  const { data: stats, isLoading } = useFetch(
    ['attendance-stats', selectedClass, dateFrom, dateTo],
    () => attendanceService.getClassStats(selectedClass, dateFrom, dateTo),
    { enabled: !!selectedClass && !!dateFrom && !!dateTo },
  );

  const classOptions = (classes ?? []).map((c) => ({
    label: `${c.name} — ${c.grade_level || ''}`,
    value: c.id,
  }));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Attendance', href: '/attendance' },
        { label: 'Reports' },
      ]} />

      <h1 className="text-xl font-bold text-slate-900">Attendance Reports</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          label="Class"
          options={classOptions}
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          placeholder="Select a class"
          className="w-64"
        />
        <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
        <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
      </div>

      {!selectedClass ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Select a class to view attendance reports.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={TrendingUp} label="Attendance Rate" value={`${stats.attendanceRate}%`} color="text-primary-700" bg="bg-primary-50" />
            <StatCard icon={CheckCircle} label="Present" value={String(stats.present)} color="text-emerald-700" bg="bg-emerald-50" />
            <StatCard icon={XCircle} label="Absent" value={String(stats.absent)} color="text-red-700" bg="bg-red-50" />
            <StatCard icon={Clock} label="Late" value={String(stats.late)} color="text-amber-700" bg="bg-amber-50" />
            <StatCard icon={AlertTriangle} label="Excused" value={String(stats.excused)} color="text-blue-700" bg="bg-blue-50" />
          </div>

          {/* Visual bar */}
          <Card>
            <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <BarRow label="Present" value={stats.present} total={stats.total} color="bg-emerald-500" />
                <BarRow label="Absent" value={stats.absent} total={stats.total} color="bg-red-500" />
                <BarRow label="Late" value={stats.late} total={stats.total} color="bg-amber-500" />
                <BarRow label="Excused" value={stats.excused} total={stats.total} color="bg-blue-500" />
                <BarRow label="Unexcused" value={stats.unexcused} total={stats.total} color="bg-orange-500" />
                <BarRow label="Medical Leave" value={stats.medical_leave} total={stats.total} color="bg-purple-500" />
              </div>
              <p className="mt-4 text-xs text-slate-400">{stats.total} total records in selected period</p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ==================== HELPERS ====================

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} px-4 py-4`}>
      <Icon className={`h-5 w-5 ${color} mb-2`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function BarRow({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-slate-600 shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-slate-500">{value}</span>
    </div>
  );
}