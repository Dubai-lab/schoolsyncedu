import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { registrarService } from '@/services/registrarService';
import { useNavigate } from 'react-router-dom';
import type { StudentApplication } from '@/types/application.types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { promotionService } from '@/services/promotionService';
import type { PromotedPendingAssignment } from '@/services/promotionService';
import {
  ClipboardList,
  FileCheck,
  FileX,
  GraduationCap,
  Users,
  Clock,
  TrendingUp,
  ArrowRight,
  UserPlus,
  FileText,
  Mail,
  UserCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ==================== STAT CARD ====================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  trend?: string;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', value: 'text-slate-700' },
};

function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:shadow-slate-100 transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${c.value}`}>{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

// ==================== STATUS BADGE ====================

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  submitted: 'info',
  under_review: 'warning',
  documents_requested: 'warning',
  accepted: 'success',
  rejected: 'danger',
  waitlisted: 'default',
  enrolled: 'success',
  withdrawn: 'default',
};

// ==================== MAIN COMPONENT ====================

export default function RegistrarDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Promoted students awaiting class assignment
  const { data: promotedPending = [] } = useFetch(
    ['promoted-pending', schoolId],
    () => promotionService.listPendingAssignment(schoolId),
    { enabled: !!schoolId },
  );

  // Dashboard stats
  const { data: stats } = useFetch(
    ['registrar-stats', schoolId],
    () => registrarService.getDashboardStats(schoolId),
    { enabled: !!schoolId },
  );

  // Bulk-imported students awaiting Bursar clearance
  const { data: pendingImports = [], refetch: refetchPending } = useFetch(
    ['pending-import-students', schoolId],
    () => registrarService.getPendingImportStudents(schoolId),
    { enabled: !!schoolId },
  );

  // Recent applications
  const { data: recentApps } = useFetch(
    ['registrar-recent', schoolId],
    () => registrarService.getRecentApplications(schoolId, 8),
    { enabled: !!schoolId },
  );

  const confirmEnrollment = useMutate(
    (studentId: string) => registrarService.confirmImportEnrollment(studentId),
    [['registrar-stats', schoolId], ['pending-import-students', schoolId]],
    {
      onSuccess: (result) => {
        notify.success(result?.message ?? 'Enrollment confirmed');
        setEnrollingId(null);
        refetchPending();
      },
      onError: (err: Error) => {
        notify.error(err.message ?? 'Failed to confirm enrollment');
        setEnrollingId(null);
      },
    },
  );

  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Registrar' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.first_name || 'Registrar'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registrar Dashboard &mdash; Manage admissions, applications, and enrollment.
          </p>
        </div>
        <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/registrar/applications')}>
          Review Applications
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Applications" value={stats?.totalApplications ?? 0} icon={ClipboardList} color="blue" />
        <StatCard label="Pending Review" value={stats?.pendingReview ?? 0} icon={Clock} color="amber" />
        <StatCard label="Accepted" value={stats?.accepted ?? 0} icon={FileCheck} color="green" />
        <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={FileX} color="red" />
        <StatCard label="Total Students" value={stats?.totalStudents ?? 0} icon={GraduationCap} color="purple" />
        <StatCard label="Active Enrollments" value={stats?.activeEnrollments ?? 0} icon={Users} color="slate" />
        <StatCard
          label="Ready to Enroll"
          value={stats?.readyToEnroll ?? 0}
          icon={UserCheck}
          color="green"
          trend={stats?.readyToEnroll ? 'Fee paid — action needed' : undefined}
        />
        <StatCard
          label="Pending Import"
          value={stats?.pendingImportEnrollments ?? 0}
          icon={AlertCircle}
          color="amber"
          trend={(stats?.pendingImportEnrollments ?? 0) > 0 ? 'Awaiting Bursar clearance' : undefined}
        />
        <StatCard
          label="Promoted — Needs Class"
          value={(promotedPending as PromotedPendingAssignment[]).length}
          icon={GraduationCap}
          color="purple"
          trend={(promotedPending as PromotedPendingAssignment[]).length > 0 ? 'Assign class to activate' : undefined}
        />
      </div>

      {/* Ready to Enroll alert */}
      {(stats?.readyToEnroll ?? 0) > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <UserCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">
              {stats!.readyToEnroll} student{stats!.readyToEnroll !== 1 ? 's are' : ' is'} ready to enroll
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Registration fee paid — open each application and click <strong>Enroll Student</strong> to create their login account.
            </p>
          </div>
          <button
            onClick={() => navigate('/registrar/applications?status=accepted')}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            View <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Pending Import Enrollments ─────────────────────────────────────── */}
      {pendingImports.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white">
          <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3.5 rounded-t-xl">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {pendingImports.length} imported student{pendingImports.length !== 1 ? 's' : ''} awaiting enrollment confirmation
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                These students were uploaded via bulk import. The Bursar must record their registration fee payment before you can confirm enrollment.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="px-5 py-2.5 text-left">Student</th>
                  <th className="px-5 py-2.5 text-left">Class</th>
                  <th className="px-5 py-2.5 text-left">Reg No.</th>
                  <th className="px-5 py-2.5 text-left">Reg Fee</th>
                  <th className="px-5 py-2.5 text-left">Imported</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingImports.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-900">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{s.class_name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{s.registration_number}</td>
                    <td className="px-5 py-2.5">
                      {s.reg_fee_paid ? (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> Paid
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Pending ${s.reg_fee_amount.toFixed(2)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-400">
                      {new Date(s.imported_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Button
                        size="sm"
                        disabled={!s.reg_fee_paid || confirmEnrollment.isPending}
                        loading={enrollingId === s.student_id && confirmEnrollment.isPending}
                        title={s.reg_fee_paid ? 'Confirm enrollment' : 'Bursar must record registration fee payment first'}
                        onClick={() => {
                          setEnrollingId(s.student_id);
                          confirmEnrollment.mutate(s.student_id);
                        }}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        {s.reg_fee_paid ? 'Enroll' : 'Fee Pending'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Promoted Students Pending Class Assignment ────────────── */}
      {(promotedPending as PromotedPendingAssignment[]).length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-white">
          <div className="flex items-center gap-3 border-b border-purple-100 bg-purple-50 px-5 py-3.5 rounded-t-xl">
            <GraduationCap className="h-5 w-5 text-purple-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-800">
                {(promotedPending as PromotedPendingAssignment[]).length} promoted student{(promotedPending as PromotedPendingAssignment[]).length !== 1 ? 's' : ''} awaiting class assignment
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                Registration fee must be paid first; then assign each student to a class to activate their enrollment.
              </p>
            </div>
            <button
              onClick={() => navigate('/registrar/promoted')}
              className="shrink-0 flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Assign Classes <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="px-5 py-2.5 text-left">Student</th>
                  <th className="px-5 py-2.5 text-left">From Grade</th>
                  <th className="px-5 py-2.5 text-left">New Year</th>
                  <th className="px-5 py-2.5 text-left">Reg Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(promotedPending as PromotedPendingAssignment[]).slice(0, 5).map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-900">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{s.from_grade_level}</td>
                    <td className="px-5 py-2.5 text-slate-600">{s.next_year}</td>
                    <td className="px-5 py-2.5">
                      {s.reg_fee_paid ? (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> Paid
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Pending ${Number(s.reg_fee_amount).toFixed(2)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(promotedPending as PromotedPendingAssignment[]).length > 5 && (
              <div className="px-5 py-3 border-t border-slate-50 text-center">
                <button
                  onClick={() => navigate('/registrar/promoted')}
                  className="text-sm text-purple-600 font-medium hover:text-purple-700"
                >
                  View all {(promotedPending as PromotedPendingAssignment[]).length} students →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Review Applications', desc: 'View & process submissions', icon: ClipboardList, path: '/registrar/applications' },
            { label: 'Finalize Enrollments', desc: 'Enroll fee-paid students', icon: UserCheck, path: '/registrar/applications?status=accepted' },
            { label: 'Letters', desc: 'Acceptance & admin letters', icon: Mail, path: '/letters' },
            { label: 'Student Records', desc: 'View all students', icon: FileText, path: '/students' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-primary-200 hover:bg-primary-50/30 transition-all"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <action.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{action.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Applications */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent Applications</h2>
          <button
            onClick={() => navigate('/registrar/applications')}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            View All <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {!recentApps || recentApps.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No applications yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left font-medium text-slate-500">App #</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Name</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Class Applied</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Guardian</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentApps.map((app: StudentApplication) => (
                  <tr
                    key={app.id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => navigate(`/registrar/applications/${app.id}`)}
                  >
                    <td className="py-2.5 font-mono text-xs text-slate-600">{app.application_number}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                          {app.first_name[0]}{app.last_name[0]}
                        </div>
                        <span className="font-medium text-slate-800">{app.first_name} {app.last_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-600">{app.grade_level_applied}</td>
                    <td className="py-2.5 text-slate-600">{app.guardian_full_name}</td>
                    <td className="py-2.5">
                      <Badge variant={statusVariant[app.status] ?? 'default'} size="sm">
                        {app.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {new Date(app.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
