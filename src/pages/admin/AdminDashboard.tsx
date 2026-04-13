import { useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { adminDashboardService } from '@/services/adminService';
import type { ActiveSubscription } from '@/types/report.types';
import type { SystemLog } from '@/types/user.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  Building2,
  CreditCard,
  Activity,
  ArrowRight,
  Server,
  Users,
  AlertTriangle,
  DollarSign,
  Tag,
  Bell,
  Sparkles,
  Clock,
  ShieldOff,
  CheckCircle2,
  Mail,
  TrendingUp,
} from 'lucide-react';

// Map event_type → human label + colour
const EVENT_META: Record<string, { label: string; color: string }> = {
  welcome:            { label: 'Welcome',           color: 'bg-blue-100 text-blue-700' },
  trial_reminder_3:   { label: 'Trial -3d',         color: 'bg-amber-100 text-amber-700' },
  trial_reminder_1:   { label: 'Trial -1d',         color: 'bg-orange-100 text-orange-700' },
  expiry_reminder_7:  { label: 'Expiry -7d',        color: 'bg-yellow-100 text-yellow-700' },
  expiry_reminder_3:  { label: 'Expiry -3d',        color: 'bg-amber-100 text-amber-700' },
  expiry_reminder_1:  { label: 'Expiry -1d',        color: 'bg-orange-100 text-orange-700' },
  grace_start:        { label: 'Grace Start',       color: 'bg-purple-100 text-purple-700' },
  grace_reminder_2:   { label: 'Grace -2d',         color: 'bg-red-100 text-red-700' },
  suspended:          { label: 'Suspended',         color: 'bg-red-100 text-red-700' },
  reactivated:        { label: 'Reactivated',       color: 'bg-green-100 text-green-700' },
  payment_confirmed:  { label: 'Payment ✓',         color: 'bg-emerald-100 text-emerald-700' },
  payment_failed:     { label: 'Payment ✗',         color: 'bg-red-100 text-red-700' },
  staff_welcome:      { label: 'Staff Welcome',     color: 'bg-sky-100 text-sky-700' },
};

function eventBadge(eventType: string) {
  const m = EVENT_META[eventType] ?? { label: eventType, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.color}`}>
      {m.label}
    </span>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: schoolCount = 0 } = useFetch<number>(
    ['admin-school-count'],
    () => adminDashboardService.getSchoolCount()
  );

  const { data: subscriptions = [] } = useFetch<ActiveSubscription[]>(
    ['admin-active-subs'],
    () => adminDashboardService.getActiveSubscriptions()
  );

  const { data: logs = [] } = useFetch<SystemLog[]>(
    ['admin-recent-logs'],
    () => adminDashboardService.getRecentSystemLogs(10)
  );

  const { data: totalRevenue = 0 } = useFetch<number>(
    ['admin-total-revenue'],
    () => adminDashboardService.getTotalRevenue()
  );

  const { data: discountCount = 0 } = useFetch<number>(
    ['admin-discount-count'],
    () => adminDashboardService.getDiscountCount()
  );

  const { data: subStatusCounts = { trial: 0, active: 0, grace: 0, suspended: 0, expired: 0 } } = useFetch(
    ['admin-sub-status-counts'],
    () => adminDashboardService.getSubscriptionStatusCounts()
  );

  const { data: enterpriseCount = 0 } = useFetch<number>(
    ['admin-enterprise-inquiry-count'],
    () => adminDashboardService.getEnterpriseInquiryCount()
  );

  const { data: notifStats = { sent_last_30_days: 0 } } = useFetch(
    ['admin-notif-stats'],
    () => adminDashboardService.getNotificationStats()
  );

  const { data: recentNotifications = [] } = useFetch(
    ['admin-recent-notifs'],
    () => adminDashboardService.getRecentNotifications(8)
  );

  const errorLogs = logs.filter((l) => l.log_level === 'ERROR').length;

  const statCards = [
    { label: 'Schools',          value: schoolCount,                        icon: Building2,    color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Revenue',    value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign,   color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Active',           value: subStatusCounts.active,             icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
    { label: 'Trial',            value: subStatusCounts.trial,              icon: Clock,        color: 'bg-amber-100 text-amber-600' },
    { label: 'Grace Period',     value: subStatusCounts.grace,              icon: TrendingUp,   color: 'bg-orange-100 text-orange-600' },
    { label: 'Suspended',        value: subStatusCounts.suspended,          icon: ShieldOff,    color: 'bg-red-100 text-red-600' },
    { label: 'Emails (30d)',     value: notifStats.sent_last_30_days,       icon: Bell,         color: 'bg-violet-100 text-violet-600' },
    { label: 'Active Discounts', value: discountCount,                      icon: Tag,          color: 'bg-pink-100 text-pink-600' },
    { label: 'New Inquiries',    value: enterpriseCount,                    icon: Sparkles,     color: 'bg-indigo-100 text-indigo-600' },
    { label: 'System Errors',    value: errorLogs,                          icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  ];

  const quickLinks = [
    { label: 'Manage Schools',       path: '/admin/schools',   icon: Building2, color: 'bg-blue-100 text-blue-600' },
    { label: 'Pricing Plans',        path: '/admin/pricing',   icon: CreditCard, color: 'bg-green-100 text-green-600' },
    { label: 'Billing Center',       path: '/admin/billing',   icon: DollarSign, color: 'bg-amber-100 text-amber-600' },
    { label: 'Discounts',            path: '/admin/discounts', icon: Tag,        color: 'bg-pink-100 text-pink-600' },
    { label: 'Enterprise Inquiries', path: '/admin/billing',   icon: Sparkles,   color: 'bg-indigo-100 text-indigo-600' },
    { label: 'System Health',        path: '/admin/health',    icon: Server,     color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin Panel' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform-wide management for SchoolSync / EduLiberia.
        </p>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickLinks.map((link) => (
          <Card
            key={link.label}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(link.path)}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className={`p-3 rounded-xl ${link.color}`}><link.icon className="w-5 h-5" /></div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">{link.label}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Two-column lower section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Subscriptions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Active Subscriptions</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/billing')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Status breakdown pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { label: 'Active',    count: subStatusCounts.active,    cls: 'bg-green-100 text-green-700' },
              { label: 'Trial',     count: subStatusCounts.trial,     cls: 'bg-amber-100 text-amber-700' },
              { label: 'Grace',     count: subStatusCounts.grace,     cls: 'bg-orange-100 text-orange-700' },
              { label: 'Suspended', count: subStatusCounts.suspended, cls: 'bg-red-100 text-red-700' },
            ].map(({ label, count, cls }) => (
              <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
                {label} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>

          {subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500">No active subscriptions.</p>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {subscriptions.slice(0, 6).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 mr-3">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{sub.school_name}</p>
                    <p className="text-xs text-gray-500">{sub.plan_name} · {sub.student_limit} students</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="success">{sub.display_status}</Badge>
                    <p className="text-xs text-gray-500 mt-1">{sub.time_remaining}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Notification Emails */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Notifications</h2>
              <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                {notifStats.sent_last_30_days} this month
              </span>
            </div>
          </div>

          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Mail className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500">No notification emails sent yet.</p>
              <p className="text-xs text-gray-400">They will appear here once the notification processor runs.</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {(recentNotifications as any[]).map((n) => (
                <div key={n.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {eventBadge(n.event_type)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {n.schools?.name ?? n.recipient_email}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{n.recipient_email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {new Date(n.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Enterprise Inquiries alert (if any new) ── */}
      {enterpriseCount > 0 && (
        <Card className="p-4 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                  {enterpriseCount} new enterprise {enterpriseCount === 1 ? 'inquiry' : 'inquiries'} waiting
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Review and respond to enterprise plan requests from the Billing Center.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/admin/billing')}>
              Review <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* ── Recent System Logs ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent System Logs</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/health')}>
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No recent logs.</p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0 mr-3">
                  <Badge
                    variant={
                      log.log_level === 'ERROR' ? 'danger' :
                      log.log_level === 'WARN' ? 'warning' : 'info'
                    }
                  >
                    {log.log_level}
                  </Badge>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{log.message}</span>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
