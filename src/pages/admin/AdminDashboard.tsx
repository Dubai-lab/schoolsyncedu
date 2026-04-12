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
} from 'lucide-react';

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

  const errorLogs = logs.filter((l) => l.log_level === 'ERROR').length;

  const quickLinks = [
    { label: 'Manage Schools', path: '/admin/schools', icon: Building2, color: 'bg-blue-100 text-blue-600' },
    { label: 'Pricing Plans', path: '/admin/pricing', icon: CreditCard, color: 'bg-green-100 text-green-600' },
    { label: 'Billing Center', path: '/admin/billing', icon: DollarSign, color: 'bg-amber-100 text-amber-600' },
    { label: 'Discounts', path: '/admin/discounts', icon: Tag, color: 'bg-pink-100 text-pink-600' },
    { label: 'System Health', path: '/admin/health', icon: Server, color: 'bg-purple-100 text-purple-600' },
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Building2 className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Schools</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{schoolCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Active Subs</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{subscriptions.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-100 text-pink-600"><Tag className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Discounts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{discountCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600"><Activity className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Logs</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{logs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Errors</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{errorLogs}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {quickLinks.map((link) => (
          <Card key={link.path} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(link.path)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${link.color}`}><link.icon className="w-5 h-5" /></div>
                <span className="font-medium text-gray-900 dark:text-white">{link.label}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </Card>
        ))}
      </div>

      {/* Active Subscriptions Preview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Subscriptions</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/billing')}>
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {subscriptions.slice(0, 5).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{sub.school_name}</p>
                  <p className="text-sm text-gray-500">{sub.plan_name} — {sub.student_limit} students</p>
                </div>
                <div className="text-right">
                  <Badge variant="success">{sub.display_status}</Badge>
                  <p className="text-xs text-gray-500 mt-1">{sub.time_remaining}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Logs Preview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent System Logs</h2>
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
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      log.log_level === 'ERROR' ? 'danger' :
                      log.log_level === 'WARN' ? 'warning' : 'info'
                    }
                  >
                    {log.log_level}
                  </Badge>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{log.message}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
