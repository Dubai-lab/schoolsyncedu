import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { incidentService, suspensionService, referralService, parentMeetingService } from '@/services/deanService';
import type { Incident, Suspension, TeacherReferral, ParentMeeting } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { BarChart2, AlertTriangle, ShieldOff, Users, Calendar, TrendingUp } from 'lucide-react';

interface StatRow {
  label: string;
  value: number;
  color: string;
}

function StatBar({ rows, total }: { rows: StatRow[]; total: number }) {
  if (total === 0) return <p className="text-xs text-slate-400">No data</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-36 shrink-0">{r.label}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.min(100, (r.value / total) * 100)}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-6 text-right">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: number; sub?: string; color: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

export default function DeanReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: incidents = [] } = useFetch(['dean-incidents', schoolId], () => incidentService.list(schoolId), { enabled: !!schoolId });
  const { data: suspensions = [] } = useFetch(['dean-suspensions', schoolId], () => suspensionService.list(schoolId), { enabled: !!schoolId });
  const { data: referrals = [] } = useFetch(['dean-referrals', schoolId], () => referralService.list(schoolId), { enabled: !!schoolId });
  const { data: meetings = [] } = useFetch(['dean-meetings', schoolId], () => parentMeetingService.list(schoolId), { enabled: !!schoolId });

  const incidentList = incidents as Incident[];
  const suspensionList = suspensions as Suspension[];
  const referralList = referrals as TeacherReferral[];
  const meetingList = meetings as ParentMeeting[];

  // Incident breakdown by type
  const incidentByType = incidentList.reduce<Record<string, number>>((acc, i) => {
    acc[i.incident_type] = (acc[i.incident_type] ?? 0) + 1;
    return acc;
  }, {});

  // Incident breakdown by status
  const openCount = incidentList.filter((i) => i.status === 'open').length;
  const reviewCount = incidentList.filter((i) => i.status === 'under_review').length;
  const resolvedCount = incidentList.filter((i) => i.status === 'resolved').length;

  // Suspension stats
  const activeSuspensions = suspensionList.filter((s) => s.status === 'active' && new Date(s.end_date) >= new Date()).length;
  const completedSuspensions = suspensionList.filter((s) => s.status === 'completed' || new Date(s.end_date) < new Date()).length;

  // Meetings
  const completedMeetings = meetingList.filter((m) => m.status === 'completed').length;
  const noShowMeetings = meetingList.filter((m) => m.status === 'no_show').length;
  const parentAttendanceRate = completedMeetings > 0
    ? Math.round((meetingList.filter((m) => m.status === 'completed' && m.parent_attended).length / completedMeetings) * 100)
    : 0;

  // Monthly incident trend (last 6 months)
  const now = new Date();
  const monthLabels: string[] = [];
  const monthCounts: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(d.toLocaleString('default', { month: 'short' }));
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthCounts.push(incidentList.filter((inc) => {
      const dt = new Date(inc.incident_date);
      return dt >= d && dt < next;
    }).length);
  }
  const maxMonthCount = Math.max(...monthCounts, 1);

  // Top incident types sorted
  const topTypes = Object.entries(incidentByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value, color: 'bg-primary-500' }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Reports' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Dean Reports</h1>
        <p className="text-sm text-slate-500">Overview of disciplinary activity and student welfare statistics.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={AlertTriangle} label="Total Incidents" value={incidentList.length} sub={`${openCount} open`} color="bg-red-100 text-red-600" />
        <SummaryCard icon={ShieldOff} label="Total Suspensions" value={suspensionList.length} sub={`${activeSuspensions} active`} color="bg-rose-100 text-rose-600" />
        <SummaryCard icon={Users} label="Teacher Referrals" value={referralList.length} sub={`${referralList.filter((r) => r.status === 'pending').length} pending`} color="bg-amber-100 text-amber-600" />
        <SummaryCard icon={Calendar} label="Parent Meetings" value={meetingList.length} sub={`${parentAttendanceRate}% attendance rate`} color="bg-blue-100 text-blue-600" />
      </div>

      {/* Incident trend + breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Monthly Incidents (6 months)</h3>
          </div>
          <div className="flex items-end gap-2 h-28">
            {monthCounts.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-slate-700">{count || ''}</span>
                <div className="w-full rounded-t-md bg-primary-500 transition-all" style={{ height: `${(count / maxMonthCount) * 80}px`, minHeight: count > 0 ? '4px' : '0' }} />
                <span className="text-xs text-slate-400">{monthLabels[i]}</span>
              </div>
            ))}
          </div>
          {incidentList.length === 0 && <p className="text-xs text-center text-slate-400">No incidents recorded yet</p>}
        </Card>

        {/* Incident status breakdown */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Incident Status Breakdown</h3>
          </div>
          <StatBar
            total={incidentList.length}
            rows={[
              { label: 'Open', value: openCount, color: 'bg-red-500' },
              { label: 'Under Review', value: reviewCount, color: 'bg-amber-400' },
              { label: 'Resolved', value: resolvedCount, color: 'bg-emerald-500' },
            ]}
          />
          <div className="pt-2 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
            <span>Resolution rate: <strong className="text-slate-700">{incidentList.length > 0 ? Math.round((resolvedCount / incidentList.length) * 100) : 0}%</strong></span>
          </div>
        </Card>
      </div>

      {/* Incident types + Suspension / Referral breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Top Incident Types</h3>
          {topTypes.length > 0 ? (
            <StatBar rows={topTypes} total={incidentList.length} />
          ) : (
            <p className="text-xs text-slate-400">No incidents logged</p>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Referral & Meeting Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Referrals resolved</span>
              <span className="font-semibold text-slate-900">
                {referralList.filter((r) => r.status === 'resolved').length} / {referralList.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Referrals dismissed</span>
              <span className="font-semibold text-slate-900">
                {referralList.filter((r) => r.status === 'dismissed').length}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between text-sm">
              <span className="text-slate-600">Meetings completed</span>
              <span className="font-semibold text-slate-900">{completedMeetings} / {meetingList.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Parent no-shows</span>
              <span className="font-semibold text-red-600">{noShowMeetings}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Parent attendance rate</span>
              <span className={`font-semibold ${parentAttendanceRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {parentAttendanceRate}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Suspension summary */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800">Suspension Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold text-slate-900">{suspensionList.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Issued</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-50">
            <p className="text-2xl font-bold text-red-700">{activeSuspensions}</p>
            <p className="text-xs text-slate-500 mt-0.5">Currently Active</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50">
            <p className="text-2xl font-bold text-slate-700">{completedSuspensions}</p>
            <p className="text-xs text-slate-500 mt-0.5">Completed</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-50">
            <p className="text-2xl font-bold text-amber-700">
              {suspensionList.filter((s) => !s.parent_notified).length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Parent Not Notified</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
