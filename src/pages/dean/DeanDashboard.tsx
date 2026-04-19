import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { deanStatsService } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Users, Clock, ShieldOff,
  Calendar, Heart, BookOpen, TrendingUp,
  ChevronRight,
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, color, to }: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; to?: string;
}) {
  const content = (
    <Card className={`p-5 flex items-center gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 truncate">{label}</p>
      </div>
      {to && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function DeanDashboard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: stats, isLoading } = useFetch(
    ['dean-stats', schoolId],
    () => deanStatsService.getStats(schoolId),
    { enabled: !!schoolId },
  );

  const statCards = [
    { label: 'Incidents This Week', value: stats?.total_incidents_week ?? 0, icon: AlertTriangle, color: 'bg-red-500', to: '/dean/incidents' },
    { label: 'Open Incidents', value: stats?.open_incidents ?? 0, icon: Clock, color: 'bg-orange-500', to: '/dean/incidents' },
    { label: 'Pending Referrals', value: stats?.pending_referrals ?? 0, icon: Users, color: 'bg-yellow-500', to: '/dean/referrals' },
    { label: 'Active Suspensions', value: stats?.active_suspensions ?? 0, icon: ShieldOff, color: 'bg-rose-600', to: '/dean/suspensions' },
    { label: 'Upcoming Meetings', value: stats?.upcoming_meetings ?? 0, icon: Calendar, color: 'bg-blue-500', to: '/dean/meetings' },
    { label: 'Welfare Flags', value: stats?.welfare_flags ?? 0, icon: Heart, color: 'bg-purple-500', to: '/dean/welfare' },
    { label: 'Counselor Referrals', value: stats?.pending_counselor_referrals ?? 0, icon: BookOpen, color: 'bg-teal-500', to: '/dean/referrals' },
  ];

  const quickActions = [
    { label: 'Log New Incident', desc: 'Record a disciplinary incident', to: '/dean/incidents', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
    { label: 'Teacher Referrals', desc: 'Review referrals from teachers', to: '/dean/referrals', icon: Users, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { label: 'Issue Suspension', desc: 'Record a student suspension', to: '/dean/suspensions', icon: ShieldOff, color: 'text-rose-700 bg-rose-50 border-rose-200' },
    { label: 'Schedule Meeting', desc: 'Set up a parent meeting', to: '/dean/meetings', icon: Calendar, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Welfare Flags', desc: 'Mark at-risk students', to: '/dean/welfare', icon: Heart, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { label: 'Attendance Monitor', desc: 'View attendance concerns', to: '/dean/attendance', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dean of Students' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dean of Students</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome, {user?.full_name ?? 'Dean'}. Here is your school overview for today.
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Alerts */}
      {!isLoading && (stats?.open_incidents ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            You have <strong>{stats?.open_incidents}</strong> open incident{(stats?.open_incidents ?? 0) > 1 ? 's' : ''} requiring action.{' '}
            <Link to="/dean/incidents" className="underline font-medium">Review now</Link>
          </span>
        </div>
      )}
      {!isLoading && (stats?.pending_referrals ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <Users className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{stats?.pending_referrals}</strong> teacher referral{(stats?.pending_referrals ?? 0) > 1 ? 's' : ''} waiting for your review.{' '}
            <Link to="/dean/referrals" className="underline font-medium">View referrals</Link>
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`flex items-start gap-3 rounded-xl border p-4 transition-all hover:shadow-sm ${a.color}`}
            >
              <a.icon className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
