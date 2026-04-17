import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  BookOpen,
  CalendarCheck,
  DollarSign,
  CreditCard,
  Bell,
  User,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

// ==================== HELPERS ====================

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${timeGreeting}, ${name}` : timeGreeting;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getGradeLetter(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ==================== STAT CARD ====================

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  onClick?: () => void;
}) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-700' },
    green:  { bg: 'bg-emerald-50',icon: 'text-emerald-600',value: 'text-emerald-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  value: 'text-amber-700' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    value: 'text-red-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  };
  const c = colors[color];
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:shadow-md hover:shadow-slate-100 transition-shadow w-full"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${c.value}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
      {onClick && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400">
          View details <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}

// ==================== QUICK LINKS ====================

function QuickLink({ label, icon: Icon, path, color }: {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </button>
  );
}

// ==================== MAIN COMPONENT ====================

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const { data: student, isLoading: profileLoading } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = (student as Record<string, unknown> | null)?.id as string ?? '';

  const { data: grades = [] } = useFetch(
    ['my-grades', schoolId, studentId],
    () => studentPortalService.getMyGrades(schoolId, studentId),
    { enabled: !!studentId },
  );

  const { data: attendanceSummary } = useFetch(
    ['my-attendance-summary', schoolId, studentId],
    () => studentPortalService.getMyAttendanceSummary(schoolId, studentId),
    { enabled: !!studentId },
  );

  const { data: fees = [] } = useFetch(
    ['my-fees', schoolId, studentId],
    () => studentPortalService.getMyFees(schoolId, studentId),
    { enabled: !!studentId },
  );

  const { data: announcements = [] } = useFetch(
    ['announcements', schoolId],
    () => studentPortalService.getAnnouncements(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch class subjects so Subjects widget shows assigned subjects even before grades exist
  const classId = (student as Record<string, unknown> | null)?.current_class_id as string ?? '';
  const { data: myClass } = useFetch(
    ['my-class', schoolId, classId],
    () => studentPortalService.getMyClass(schoolId, classId),
    { enabled: !!classId },
  );
  const classSubjects = ((myClass as Record<string, unknown> | null)
    ?.class_subjects as Record<string, unknown>[] | null) ?? [];

  // Compute grade average
  const gradeScores = (grades as Record<string, unknown>[])
    .map((g) => Number(g.score ?? 0))
    .filter((s) => s > 0);
  const avgGrade = gradeScores.length > 0
    ? gradeScores.reduce((a, b) => a + b, 0) / gradeScores.length
    : 0;

  // Compute fee balance (student_fees.amount_due / amount_paid)
  const totalAmountDue = (fees as Record<string, unknown>[])
    .reduce((s, f) => s + Number(f.amount_due ?? (f.fee_structures as Record<string, unknown> | null)?.amount_usd ?? 0), 0);
  const totalAmountPaid = (fees as Record<string, unknown>[])
    .reduce((s, f) => s + Number(f.amount_paid ?? 0), 0);
  const feeBalance = totalAmountDue - totalAmountPaid;
  const hasUnpaidFees = feeBalance > 0;

  const s = student as Record<string, unknown> | null;
  const studentName = s ? `${s.first_name as string}` : user?.first_name || 'Student';
  const className = (s?.classes as Record<string, unknown> | null)?.name as string ?? s?.current_grade_level as string ?? '—';

  if (profileLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
            {s?.photo_url ? (
              <img src={s.photo_url as string} alt="Photo" className="h-full w-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-blue-500" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{getGreeting(studentName)}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500 font-mono">{s?.registration_number as string ?? ''}</span>
              {className && (
                <>
                  <span className="text-slate-300">·</span>
                  <Badge variant="info" size="sm">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {className}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Grade Average"
          value={gradeScores.length > 0 ? `${avgGrade.toFixed(1)}%` : '—'}
          sub={gradeScores.length > 0 ? `Letter: ${getGradeLetter(avgGrade)}` : 'No grades yet'}
          icon={TrendingUp}
          color="blue"
          onClick={() => navigate('/student/grades')}
        />
        <StatCard
          label="Attendance Rate"
          value={attendanceSummary ? `${attendanceSummary.rate}%` : '—'}
          sub={attendanceSummary ? `${attendanceSummary.present} present, ${attendanceSummary.absent} absent` : 'No records'}
          icon={CalendarCheck}
          color={attendanceSummary && attendanceSummary.rate < 75 ? 'red' : 'green'}
          onClick={() => navigate('/student/attendance')}
        />
        <StatCard
          label="Fees Balance"
          value={totalAmountDue > 0 ? formatCurrency(feeBalance) : '—'}
          sub={hasUnpaidFees ? 'Payment due' : totalAmountDue > 0 ? 'All paid' : 'No fees assigned'}
          icon={DollarSign}
          color={hasUnpaidFees ? 'amber' : 'green'}
          onClick={() => navigate('/student/fees')}
        />
        <StatCard
          label="Subjects"
          value={classSubjects.length > 0 ? String(classSubjects.length) : '—'}
          sub={classSubjects.length > 0 ? 'In your class' : 'No subjects assigned'}
          icon={BookOpen}
          color="purple"
          onClick={() => navigate('/student/grades')}
        />
      </div>

      {/* Fee alert */}
      {hasUnpaidFees && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Outstanding fee balance: {formatCurrency(feeBalance)}</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Please visit the finance office to settle your balance or contact your school administrator.
            </p>
          </div>
          <button
            onClick={() => navigate('/student/fees')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap"
          >
            View Fees →
          </button>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickLink label="My Grades" icon={BookOpen} path="/student/grades" color="bg-blue-600" />
          <QuickLink label="Attendance" icon={CalendarCheck} path="/student/attendance" color="bg-emerald-600" />
          <QuickLink label="Timetable" icon={Clock} path="/student/timetable" color="bg-purple-600" />
          <QuickLink label="My Fees" icon={DollarSign} path="/student/fees" color="bg-amber-600" />
          <QuickLink label="Library" icon={BookOpen} path="/student/library" color="bg-cyan-600" />
          <QuickLink label="ID Card" icon={CreditCard} path="/student/id-card" color="bg-slate-600" />
        </div>
      </div>

      {/* Recent Grades + Announcements side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Grades</h2>
            <button
              onClick={() => navigate('/student/grades')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {(grades as Record<string, unknown>[]).length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No grades recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(grades as Record<string, unknown>[]).slice(0, 5).map((g, i) => {
                const score = Number(g.score ?? 0);
                const subject = g.subjects as Record<string, unknown> | null;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {(subject?.name as string) || 'Unknown Subject'}
                      </p>
                      <p className="text-xs text-slate-400">{(g.term as string) || 'Current term'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{score}%</span>
                      <Badge
                        variant={score >= 70 ? 'success' : score >= 60 ? 'warning' : 'danger'}
                        size="sm"
                      >
                        {getGradeLetter(score)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Announcements */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Announcements</h2>
            <Bell className="h-4 w-4 text-slate-400" />
          </div>
          {(announcements as Record<string, unknown>[]).length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(announcements as Record<string, unknown>[]).slice(0, 4).map((a, i) => (
                <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Bell className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{a.title as string}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.content as string}</p>
                    <p className="text-xs text-slate-300 mt-1">
                      {a.created_at ? new Date(a.created_at as string).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Attendance summary bar */}
      {attendanceSummary && attendanceSummary.total > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Attendance This Year</h2>
            <button
              onClick={() => navigate('/student/attendance')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${attendanceSummary.rate}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700 w-12 text-right">{attendanceSummary.rate}%</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Present', value: attendanceSummary.present, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Absent', value: attendanceSummary.absent, icon: AlertTriangle, color: 'text-red-600' },
              { label: 'Late', value: attendanceSummary.late, icon: Clock, color: 'text-amber-600' },
              { label: 'Excused', value: attendanceSummary.excused, icon: CheckCircle2, color: 'text-blue-600' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-slate-50">
                <item.icon className={`h-4 w-4 mx-auto mb-1 ${item.color}`} />
                <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
