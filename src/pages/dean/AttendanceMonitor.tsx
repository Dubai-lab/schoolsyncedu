import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { AlertTriangle, UserX, TrendingDown, Search, Users } from 'lucide-react';

interface AttendanceRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  current_grade_level: string;
  registration_number: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  attendance_rate: number;
}

const THRESHOLD_CHRONIC = 75; // Below 75% = chronic absentee
const THRESHOLD_AT_RISK = 85; // Below 85% = at risk

async function fetchAttendanceSummary(schoolId: string): Promise<AttendanceRecord[]> {
  // Get all students
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, first_name, last_name, current_grade_level, registration_number')
    .eq('school_id', schoolId)
    .eq('status', 'enrolled')
    .order('last_name');
  if (sErr) throw sErr;

  if (!students || students.length === 0) return [];

  // Get attendance records for all students
  const studentIds = students.map((s) => s.id);
  const { data: attendance, error: aErr } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('school_id', schoolId)
    .in('student_id', studentIds);
  if (aErr) throw aErr;

  // Aggregate per student
  const map = new Map<string, { total: number; present: number; absent: number; late: number }>();
  for (const s of students) map.set(s.id, { total: 0, present: 0, absent: 0, late: 0 });

  for (const rec of attendance ?? []) {
    const entry = map.get(rec.student_id);
    if (!entry) continue;
    entry.total++;
    if (rec.status === 'present') entry.present++;
    else if (rec.status === 'absent') entry.absent++;
    else if (rec.status === 'late') entry.late++;
  }

  return students.map((s) => {
    const a = map.get(s.id) ?? { total: 0, present: 0, absent: 0, late: 0 };
    const rate = a.total > 0 ? Math.round((a.present / a.total) * 100) : 100;
    return {
      student_id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      current_grade_level: s.current_grade_level,
      registration_number: s.registration_number,
      total_days: a.total,
      present_days: a.present,
      absent_days: a.absent,
      late_days: a.late,
      attendance_rate: rate,
    };
  });
}

function RateBar({ rate }: { rate: number }) {
  const color = rate < THRESHOLD_CHRONIC ? 'bg-red-500' : rate < THRESHOLD_AT_RISK ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${rate < THRESHOLD_CHRONIC ? 'text-red-600' : rate < THRESHOLD_AT_RISK ? 'text-amber-600' : 'text-emerald-600'}`}>
        {rate}%
      </span>
    </div>
  );
}

export default function AttendanceMonitor() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'chronic' | 'at_risk'>('all');

  const { data: records = [], isLoading } = useFetch(
    ['dean-attendance', schoolId],
    () => fetchAttendanceSummary(schoolId),
    { enabled: !!schoolId },
  );

  const filtered = (records as AttendanceRecord[]).filter((r) => {
    const name = `${r.first_name} ${r.last_name} ${r.registration_number}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'chronic' && r.attendance_rate < THRESHOLD_CHRONIC) ||
      (filter === 'at_risk' && r.attendance_rate >= THRESHOLD_CHRONIC && r.attendance_rate < THRESHOLD_AT_RISK);
    return matchSearch && matchFilter;
  });

  const sorted = [...filtered].sort((a, b) => a.attendance_rate - b.attendance_rate);

  const chronicCount = (records as AttendanceRecord[]).filter((r) => r.attendance_rate < THRESHOLD_CHRONIC).length;
  const atRiskCount = (records as AttendanceRecord[]).filter((r) => r.attendance_rate >= THRESHOLD_CHRONIC && r.attendance_rate < THRESHOLD_AT_RISK).length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Attendance Monitor' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Attendance Monitor</h1>
        <p className="text-sm text-slate-500">Track school-wide attendance and identify chronic absentees.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{(records as AttendanceRecord[]).length}</p>
            <p className="text-xs text-slate-500">Total Students</p>
          </div>
        </Card>
        <Card
          className={`p-4 flex items-center gap-3 cursor-pointer transition-shadow hover:shadow-md ${filter === 'at_risk' ? 'ring-2 ring-amber-400' : ''}`}
          onClick={() => setFilter(filter === 'at_risk' ? 'all' : 'at_risk')}
        >
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-700">{atRiskCount}</p>
            <p className="text-xs text-slate-500">At Risk (75–84%)</p>
          </div>
        </Card>
        <Card
          className={`p-4 flex items-center gap-3 cursor-pointer transition-shadow hover:shadow-md ${filter === 'chronic' ? 'ring-2 ring-red-400' : ''}`}
          onClick={() => setFilter(filter === 'chronic' ? 'all' : 'chronic')}
        >
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <UserX className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-700">{chronicCount}</p>
            <p className="text-xs text-slate-500">Chronic (&lt;75%)</p>
          </div>
        </Card>
      </div>

      {/* Alert banner */}
      {chronicCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{chronicCount} student{chronicCount > 1 ? 's' : ''}</strong> below 75% attendance — parental contact recommended.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'chronic', 'at_risk'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f
                  ? f === 'chronic' ? 'bg-red-100 text-red-700 border-red-300'
                    : f === 'at_risk' ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-primary-100 text-primary-700 border-primary-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {f === 'all' ? 'All Students' : f === 'chronic' ? 'Chronic' : 'At Risk'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400 self-center">{sorted.length} students shown</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-16 text-center">
          <Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No attendance records found.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Present</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Absent</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Late</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((r) => {
                  const isChronic = r.attendance_rate < THRESHOLD_CHRONIC;
                  const isAtRisk = !isChronic && r.attendance_rate < THRESHOLD_AT_RISK;
                  return (
                    <tr key={r.student_id} className={`hover:bg-slate-50/70 transition-colors ${isChronic ? 'bg-red-50/30' : isAtRisk ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.last_name}, {r.first_name}</p>
                        <p className="text-xs text-slate-400">{r.registration_number}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">Grade {r.current_grade_level}</td>
                      <td className="px-4 py-3 text-center font-medium text-emerald-700">{r.present_days}</td>
                      <td className="px-4 py-3 text-center font-medium text-red-600">{r.absent_days}</td>
                      <td className="px-4 py-3 text-center font-medium text-amber-600">{r.late_days}</td>
                      <td className="px-4 py-3 w-48"><RateBar rate={r.attendance_rate} /></td>
                      <td className="px-4 py-3">
                        {isChronic ? (
                          <Badge variant="error" size="sm">Chronic</Badge>
                        ) : isAtRisk ? (
                          <Badge variant="warning" size="sm">At Risk</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Good</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
