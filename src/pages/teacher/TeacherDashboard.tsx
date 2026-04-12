import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { registrarService } from '@/services/registrarService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import {
  Users,
  BookOpen,
  CalendarCheck,
  Clock,
  ArrowRight,
  GraduationCap,
  BarChart3,
  ClipboardList,
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const { data: stats } = useFetch(
    ['teacher-dashboard-stats', schoolId, teacherId],
    () => teacherService.getDashboardStats(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const { data: academicYear } = useFetch(
    ['school-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Teacher Portal' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.first_name || 'Teacher'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Teacher Dashboard &mdash; {academicYear ? `Academic Year ${academicYear}` : 'Manage your classes, attendance, and grades.'}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="My Classes" value={stats?.myClasses ?? 0} icon={Users} color="blue" />
        <StatCard label="My Students" value={stats?.myStudents ?? 0} icon={GraduationCap} color="green" />
        <StatCard label="My Subjects" value={stats?.mySubjects ?? 0} icon={BookOpen} color="purple" />
        <StatCard label="Attendance Today" value={stats?.todayAttendance ?? 0} icon={CalendarCheck} color="amber" />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          title="Take Attendance"
          description="Mark daily attendance for your classes"
          icon={CalendarCheck}
          color="emerald"
          onClick={() => navigate('/teacher/attendance')}
        />
        <QuickAction
          title="NFC Attendance"
          description="Use NFC card tap for quick attendance"
          icon={ClipboardList}
          color="blue"
          onClick={() => navigate('/teacher/nfc-attendance')}
        />
        <QuickAction
          title="Enter Grades"
          description="Enter scores for your subjects"
          icon={BarChart3}
          color="purple"
          onClick={() => navigate('/teacher/grades')}
        />
        <QuickAction
          title="My Schedule"
          description="View your weekly timetable"
          icon={Clock}
          color="amber"
          onClick={() => navigate('/teacher/schedule')}
        />
      </div>

      {/* My Classes List */}
      {stats?.classes && stats.classes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold text-slate-800">My Classes</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/classes')}>
              View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.classes.slice(0, 6).map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition"
                onClick={() => navigate('/teacher/attendance', { state: { classId: cls.id } })}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{cls.name}</p>
                    <p className="text-xs text-slate-400">
                      {cls.grade_level}
                      {cls.isHomeroom && ' · Homeroom'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">
                    {stats.studentCounts[cls.id] ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400">students</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STAT CARD ====================

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
};

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: keyof typeof colorMap;
}) {
  const c = colorMap[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.value}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

// ==================== QUICK ACTION ====================

const actionColorMap = {
  emerald: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
};

function QuickAction({ title, description, icon: Icon, color, onClick }: {
  title: string; description: string; icon: React.ElementType; color: keyof typeof actionColorMap; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${actionColorMap[color]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs opacity-80">{description}</p>
      </div>
    </button>
  );
}
