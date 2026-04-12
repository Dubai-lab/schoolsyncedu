import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import {
  proprietorDashboardService,
  proprietorSubscriptionService,
  proprietorBillingService,
  type AuditLog,
} from '@/services/proprietorService';
import type { Subscription, SubscriptionPlan, BillingInvoice } from '@/types/report.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  GraduationCap,
  Users,
  DollarSign,
  CreditCard,
  ArrowRight,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  Shield,
  Globe,
} from 'lucide-react';

export default function ProprietorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id;

  const { data: studentCount = 0 } = useFetch<number>(
    ['prop-students', schoolId!],
    () => proprietorDashboardService.getStudentCount(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: staffCount = 0 } = useFetch<number>(
    ['prop-staff', schoolId!],
    () => proprietorDashboardService.getStaffCount(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: revenue = 0 } = useFetch<number>(
    ['prop-revenue', schoolId!],
    () => proprietorDashboardService.getSchoolRevenue(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: subscription } = useFetch<(Subscription & { plan: SubscriptionPlan }) | null>(
    ['prop-subscription', schoolId!],
    () => proprietorSubscriptionService.getSubscription(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: invoices = [] } = useFetch<BillingInvoice[]>(
    ['prop-invoices', schoolId!],
    () => proprietorBillingService.getInvoices(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: recentLogs = [] } = useFetch<AuditLog[]>(
    ['prop-audit-recent', schoolId!],
    () => proprietorDashboardService.getRecentAuditLogs(schoolId!, 5),
    { enabled: !!schoolId }
  );

  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const [now] = useState(() => Date.now());
  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - now) / 86400000))
    : null;

  const subStatusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' => {
    switch (s) {
      case 'active': case 'premier': return 'success';
      case 'trial': case 'grace': return 'warning';
      case 'suspended': case 'cancelled': case 'archived': return 'danger';
      default: return 'info';
    }
  };

  const quickLinks = [
    { label: 'IT Admin', desc: 'Manage your school\'s IT administrator', path: '/proprietor/it-admin', icon: Shield, color: 'bg-blue-100 text-blue-600' },
    { label: 'Subscription', desc: 'Plan, billing & upgrades', path: '/proprietor/subscription', icon: CreditCard, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Financial Overview', desc: 'Revenue, fees & payments', path: '/proprietor/financial', icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { label: 'Audit Trail', desc: 'Activity log & compliance', path: '/proprietor/audit', icon: Shield, color: 'bg-purple-100 text-purple-600' },
    { label: 'School Settings', desc: 'Branding, colors & profile', path: '/settings', icon: Building2, color: 'bg-amber-100 text-amber-600' },
    { label: 'School Website', desc: 'Customize your public site', path: '/proprietor/site', icon: Globe, color: 'bg-cyan-100 text-cyan-600' },
    { label: 'School Setup', desc: 'Onboarding wizard', path: '/proprietor/setup', icon: Building2, color: 'bg-teal-100 text-teal-600' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor Dashboard' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proprietor Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back. Here's an overview of your school.
        </p>
      </div>

      {/* Subscription Banner */}
      {subscription && (
        <Card className="p-5 border-l-4 border-l-primary-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-primary-50 text-primary-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{subscription.plan.name}</h3>
                  <Badge variant={subStatusVariant(subscription.status)}>
                    {subscription.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {subscription.plan.student_limit} students &middot; ${subscription.plan.price_usd}/{subscription.plan.billing_cycle}
                  {daysRemaining !== null && (
                    <span className={daysRemaining <= 7 ? ' text-red-600 font-medium' : ''}>
                      {' '}&middot; {daysRemaining} days remaining
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/proprietor/subscription')}>
              Manage <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Alert: pending invoices */}
      {pendingInvoices.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            You have <strong>{pendingInvoices.length}</strong> pending invoice{pendingInvoices.length > 1 ? 's' : ''}.
          </p>
          <Button variant="ghost" size="sm" className="ml-auto text-amber-700" onClick={() => navigate('/proprietor/financial')}>
            View
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{studentCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Active Staff</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{staffCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${revenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Invoices Due</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{pendingInvoices.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Card key={link.path} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(link.path)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${link.color}`}><link.icon className="w-5 h-5" /></div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{link.label}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{link.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Audit Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/proprietor/audit')}>
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {log.description ?? `${log.entity_type} ${log.action}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
