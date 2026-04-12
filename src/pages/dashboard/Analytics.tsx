import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { supabase } from '@/lib/supabase';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  GraduationCap,
  DollarSign,
  CalendarCheck,
  BookOpen,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';

// ==================== DATA FETCHING ====================

interface SchoolAnalytics {
  students: { total: number; active: number; byGrade: { grade: string; count: number }[] };
  staff: { total: number; byRole: { role: string; count: number }[] };
  attendance: { avgRate: number; presentToday: number; absentToday: number; lateToday: number };
  finance: { totalRevenue: number; outstanding: number; collectionRate: number; monthlyTrend: { month: string; amount: number }[] };
  academics: { classes: number; subjects: number; avgGrade: number };
}

async function fetchAnalytics(schoolId: string): Promise<SchoolAnalytics> {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  // Parallel fetches
  const [
    { count: totalStudents },
    { count: activeStudents },
    { data: studentsByGrade },
    { count: totalStaff },
    { data: staffByRole },
    { count: presentToday },
    { count: absentToday },
    { count: lateToday },
    { data: attendanceAll },
    { data: mtdPayments },
    { count: outstandingFees },
    { count: totalFees },
    { count: totalClasses },
    { count: totalSubjects },
    { data: allGrades },
    { data: monthlyPayments },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('students').select('grade_level').eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true).neq('role', 'student').neq('role', 'parent'),
    supabase.from('users').select('role').eq('school_id', schoolId).eq('is_active', true).neq('role', 'student').neq('role', 'parent'),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today).eq('status', 'present'),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today).eq('status', 'absent'),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today).eq('status', 'late'),
    supabase.from('attendance_records').select('status').eq('school_id', schoolId).gte('date', monthStart),
    supabase.from('payments').select('amount_usd').eq('school_id', schoolId).gte('created_at', monthStart),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'unpaid'),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('grades').select('score').eq('school_id', schoolId).not('score', 'is', null).limit(500),
    supabase.from('payments').select('amount_usd, created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(500),
  ]);

  // Aggregate students by grade
  const gradeMap: Record<string, number> = {};
  (studentsByGrade ?? []).forEach((s) => {
    const g = s.grade_level || 'Unknown';
    gradeMap[g] = (gradeMap[g] || 0) + 1;
  });
  const byGrade = Object.entries(gradeMap).map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));

  // Aggregate staff by role
  const roleMap: Record<string, number> = {};
  (staffByRole ?? []).forEach((s) => {
    const r = (s.role as string).replace(/_/g, ' ');
    roleMap[r] = (roleMap[r] || 0) + 1;
  });
  const byRole = Object.entries(roleMap).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);

  // Attendance rate this month
  const attendTotal = attendanceAll?.length ?? 0;
  const attendPresent = (attendanceAll ?? []).filter((a) => a.status === 'present').length;
  const avgRate = attendTotal > 0 ? Math.round((attendPresent / attendTotal) * 100) : 0;

  // Finance
  const totalRevenue = (mtdPayments ?? []).reduce((s, p) => s + Number((p as Record<string, unknown>).amount_usd ?? 0), 0);
  const paidCount = (totalFees ?? 0) - (outstandingFees ?? 0);
  const collectionRate = totalFees ? Math.round((paidCount / totalFees) * 100) : 0;

  // Monthly trend (last 6 months)
  const monthMap: Record<string, number> = {};
  (monthlyPayments ?? []).forEach((p) => {
    const m = (p.created_at as string).slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + Number((p as Record<string, unknown>).amount_usd ?? 0);
  });
  const monthlyTrend = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }));

  // Average grade
  const gradeScores = allGrades ?? [];
  const avgGrade = gradeScores.length > 0
    ? Math.round(gradeScores.reduce((s, g) => s + Number(g.score ?? 0), 0) / gradeScores.length)
    : 0;

  return {
    students: { total: totalStudents ?? 0, active: activeStudents ?? 0, byGrade },
    staff: { total: totalStaff ?? 0, byRole },
    attendance: { avgRate, presentToday: presentToday ?? 0, absentToday: absentToday ?? 0, lateToday: lateToday ?? 0 },
    finance: { totalRevenue, outstanding: outstandingFees ?? 0, collectionRate, monthlyTrend },
    academics: { classes: totalClasses ?? 0, subjects: totalSubjects ?? 0, avgGrade },
  };
}

// ==================== BAR CHART (CSS) ====================

function BarChartSimple({ data, label, color }: { data: { name: string; value: number }[]; label: string; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-3">{label}</p>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-20 truncate text-right">{d.name}</span>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-10">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== MINI METRIC ====================

function MiniMetric({ label, value, trend, icon: Icon, color }: {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg`} style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-lg font-bold text-slate-800">{value}</p>
          {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}
          {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
          {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-slate-400" />}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN ====================

export default function Analytics() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [tab, setTab] = useState<'overview' | 'students' | 'finance' | 'attendance'>('overview');

  const { data, isLoading } = useFetch<SchoolAnalytics>(
    ['analytics', schoolId],
    () => fetchAnalytics(schoolId),
    { enabled: !!schoolId },
  );

  function formatCurrency(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <BarChart3 className="inline-block h-6 w-6 mr-2 text-blue-600" />
          School Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Comprehensive overview of school performance and metrics.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['overview', 'students', 'finance', 'attendance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : !data ? (
        <Card className="p-12 text-center">
          <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">No data available</h3>
          <p className="text-sm text-slate-400 mt-1">Analytics will appear as data is recorded in the system.</p>
        </Card>
      ) : (
        <>
          {/* ===== OVERVIEW TAB ===== */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Top metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniMetric label="Total Students" value={String(data.students.active)} icon={GraduationCap} color="#3b82f6" />
                <MiniMetric label="Active Staff" value={String(data.staff.total)} icon={Users} color="#8b5cf6" />
                <MiniMetric label="Revenue (MTD)" value={formatCurrency(data.finance.totalRevenue)} icon={DollarSign} color="#f59e0b" trend="up" />
                <MiniMetric label="Attendance Rate" value={`${data.attendance.avgRate}%`} icon={CalendarCheck} color="#10b981" trend={data.attendance.avgRate >= 80 ? 'up' : 'down'} />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Students by Grade</h3>
                  {data.students.byGrade.length > 0 ? (
                    <BarChartSimple
                      data={data.students.byGrade.map((g) => ({ name: `Grade ${g.grade}`, value: g.count }))}
                      label=""
                      color="#3b82f6"
                    />
                  ) : (
                    <p className="text-sm text-slate-400 py-8 text-center">No student data yet</p>
                  )}
                </Card>

                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Staff by Role</h3>
                  {data.staff.byRole.length > 0 ? (
                    <BarChartSimple
                      data={data.staff.byRole.map((r) => ({ name: r.role, value: r.count }))}
                      label=""
                      color="#8b5cf6"
                    />
                  ) : (
                    <p className="text-sm text-slate-400 py-8 text-center">No staff data yet</p>
                  )}
                </Card>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Academic Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Classes</span>
                      <span className="text-sm font-semibold text-slate-800">{data.academics.classes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Subjects</span>
                      <span className="text-sm font-semibold text-slate-800">{data.academics.subjects}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Avg Grade Score</span>
                      <span className="text-sm font-semibold text-slate-800">{data.academics.avgGrade}%</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Today&apos;s Attendance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Present</span>
                      <Badge variant="success" size="sm">{data.attendance.presentToday}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Absent</span>
                      <Badge variant="danger" size="sm">{data.attendance.absentToday}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Late</span>
                      <Badge variant="warning" size="sm">{data.attendance.lateToday}</Badge>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Collection Rate</span>
                      <span className="text-sm font-semibold text-slate-800">{data.finance.collectionRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Outstanding</span>
                      <Badge variant="danger" size="sm">{data.finance.outstanding}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Revenue (MTD)</span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(data.finance.totalRevenue)}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ===== STUDENTS TAB ===== */}
          {tab === 'students' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniMetric label="Total Enrolled" value={String(data.students.total)} icon={GraduationCap} color="#3b82f6" />
                <MiniMetric label="Active" value={String(data.students.active)} icon={Users} color="#10b981" />
                <MiniMetric label="Inactive" value={String(data.students.total - data.students.active)} icon={AlertTriangle} color="#ef4444" />
                <MiniMetric label="Grade Levels" value={String(data.students.byGrade.length)} icon={BookOpen} color="#8b5cf6" />
              </div>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Enrollment by Grade Level</h3>
                {data.students.byGrade.length > 0 ? (
                  <BarChartSimple
                    data={data.students.byGrade.map((g) => ({ name: `Grade ${g.grade}`, value: g.count }))}
                    label="Number of students per grade"
                    color="#3b82f6"
                  />
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">No student enrollment data available</p>
                )}
              </Card>
            </div>
          )}

          {/* ===== FINANCE TAB ===== */}
          {tab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniMetric label="Revenue (MTD)" value={formatCurrency(data.finance.totalRevenue)} icon={DollarSign} color="#10b981" trend="up" />
                <MiniMetric label="Outstanding" value={String(data.finance.outstanding)} icon={AlertTriangle} color="#ef4444" />
                <MiniMetric label="Collection Rate" value={`${data.finance.collectionRate}%`} icon={TrendingUp} color="#f59e0b" />
                <MiniMetric label="Avg Grade Score" value={`${data.academics.avgGrade}%`} icon={BookOpen} color="#3b82f6" />
              </div>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue Trend</h3>
                {data.finance.monthlyTrend.length > 0 ? (
                  <BarChartSimple
                    data={data.finance.monthlyTrend.map((m) => ({ name: m.month, value: m.amount }))}
                    label="Revenue by month"
                    color="#10b981"
                  />
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">No payment data to show trends</p>
                )}
              </Card>
            </div>
          )}

          {/* ===== ATTENDANCE TAB ===== */}
          {tab === 'attendance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniMetric label="Avg Rate (MTD)" value={`${data.attendance.avgRate}%`} icon={CalendarCheck} color="#10b981" trend={data.attendance.avgRate >= 80 ? 'up' : 'down'} />
                <MiniMetric label="Present Today" value={String(data.attendance.presentToday)} icon={CalendarCheck} color="#3b82f6" />
                <MiniMetric label="Absent Today" value={String(data.attendance.absentToday)} icon={AlertTriangle} color="#ef4444" />
                <MiniMetric label="Late Today" value={String(data.attendance.lateToday)} icon={TrendingDown} color="#f59e0b" />
              </div>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Today&apos;s Breakdown</h3>
                <div className="relative h-8 rounded-full overflow-hidden bg-slate-100 flex">
                  {(() => {
                    const total = data.attendance.presentToday + data.attendance.absentToday + data.attendance.lateToday;
                    if (total === 0) return <div className="flex-1 flex items-center justify-center text-xs text-slate-400">No attendance recorded today</div>;
                    const pct = (v: number) => `${(v / total) * 100}%`;
                    return (
                      <>
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: pct(data.attendance.presentToday) }} />
                        <div className="h-full bg-amber-400 transition-all" style={{ width: pct(data.attendance.lateToday) }} />
                        <div className="h-full bg-red-400 transition-all" style={{ width: pct(data.attendance.absentToday) }} />
                      </>
                    );
                  })()}
                </div>
                <div className="flex gap-6 mt-3">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" /> Present ({data.attendance.presentToday})
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full bg-amber-400" /> Late ({data.attendance.lateToday})
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full bg-red-400" /> Absent ({data.attendance.absentToday})
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
