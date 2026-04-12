import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CalendarCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MyAttendance() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = student?.id ?? '';

  const { data: records = [], isLoading } = useFetch(
    ['my-attendance', schoolId, studentId],
    () => studentPortalService.getMyAttendance(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: summary } = useFetch(
    ['my-attendance-summary', schoolId, studentId],
    () => studentPortalService.getMyAttendanceSummary(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  // Build lookup: date string → status
  const dateMap = useMemo(() => {
    const m = new Map<string, string>();
    records.forEach((r: Record<string, unknown>) => {
      const d = r.date as string;
      if (d) m.set(d.slice(0, 10), r.status as string);
    });
    return m;
  }, [records]);

  // Calendar data
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  function statusColor(status: string) {
    switch (status?.toLowerCase()) {
      case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'late': case 'tardy': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'excused': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  }

  function statusIcon(status: string) {
    switch (status?.toLowerCase()) {
      case 'present': return <CheckCircle className="h-3.5 w-3.5" />;
      case 'absent': return <XCircle className="h-3.5 w-3.5" />;
      case 'late': case 'tardy': return <Clock className="h-3.5 w-3.5" />;
      case 'excused': return <AlertCircle className="h-3.5 w-3.5" />;
      default: return null;
    }
  }

  const presentCount = summary?.present ?? 0;
  const absentCount = summary?.absent ?? 0;
  const lateCount = summary?.late ?? 0;
  const excusedCount = summary?.excused ?? 0;
  const rate = summary?.rate ?? 0;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Attendance' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <CalendarCheck className="inline-block h-6 w-6 mr-2 text-blue-600" />
          My Attendance
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your daily attendance and overall attendance rate.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{rate.toFixed(1)}%</div>
          <p className="text-xs text-slate-500 mt-0.5">Attendance Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xl font-bold text-emerald-600">{presentCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Present</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xl font-bold text-red-600">{absentCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Absent</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xl font-bold text-amber-600">{lateCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Late</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <span className="text-xl font-bold text-blue-600">{excusedCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Excused</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Calendar View */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100">
                <ChevronLeft className="h-5 w-5 text-slate-500" />
              </button>
              <h3 className="text-base font-semibold text-slate-800">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100">
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const status = dateMap.get(dateStr);
                const isToday = dateStr === today;

                return (
                  <div
                    key={day}
                    className={`relative flex flex-col items-center justify-center rounded-lg border p-1.5 text-xs min-h-[42px] ${
                      status ? statusColor(status) : 'border-transparent'
                    } ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                    title={status ? `${dateStr}: ${status}` : dateStr}
                  >
                    <span className="font-medium">{day}</span>
                    {status && <span className="mt-0.5">{statusIcon(status)}</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
              {[
                { label: 'Present', color: 'bg-emerald-400' },
                { label: 'Absent', color: 'bg-red-400' },
                { label: 'Late', color: 'bg-amber-400' },
                { label: 'Excused', color: 'bg-blue-400' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </Card>

          {/* Recent records table */}
          {records.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Recent Records</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
                      <th className="px-4 py-2.5 text-center font-medium text-slate-600">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.slice(0, 20).map((r: Record<string, unknown>, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-700">
                          {r.date ? new Date(r.date as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge
                            variant={
                              (r.status as string) === 'present' ? 'success' :
                              (r.status as string) === 'absent' ? 'danger' :
                              (r.status as string) === 'late' ? 'warning' : 'info'
                            }
                            size="sm"
                          >
                            {(r.status as string) || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{(r.notes as string) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
