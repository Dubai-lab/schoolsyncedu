import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { welfareFlagService, counselorReferralService, deanStudentService } from '@/services/deanService';
import type { WelfareFlag, CounselorReferral } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Heart, Plus, CheckCircle2, BookOpen } from 'lucide-react';

const RISK_TYPES = [
  { value: 'academic', label: 'Academic Difficulty' },
  { value: 'behavioral', label: 'Behavioral Issues' },
  { value: 'social', label: 'Social / Peer Issues' },
  { value: 'family', label: 'Family Situation' },
  { value: 'health', label: 'Health / Medical' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const RISK_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700',
  behavioral: 'bg-orange-100 text-orange-700',
  social: 'bg-purple-100 text-purple-700',
  family: 'bg-yellow-100 text-yellow-700',
  health: 'bg-red-100 text-red-700',
  other: 'bg-slate-100 text-slate-600',
};

export default function StudentWelfare() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [activeTab, setActiveTab] = useState<'welfare' | 'counselor'>('welfare');
  const [showWelfareCreate, setShowWelfareCreate] = useState(false);
  const [showCounselorCreate, setShowCounselorCreate] = useState(false);
  const [resolving, setResolving] = useState<WelfareFlag | null>(null);

  const [welfareForm, setWelfareForm] = useState({ student_id: '', risk_type: '', notes: '', action_plan: '', review_date: '' });
  const [counselorForm, setCounselorForm] = useState({ student_id: '', reason: '', urgency: 'normal' as CounselorReferral['urgency'] });

  const { data: flags = [], isLoading: flagsLoading } = useFetch(
    ['dean-welfare', schoolId],
    () => welfareFlagService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: referrals = [], isLoading: refsLoading } = useFetch(
    ['dean-counselor-referrals', schoolId],
    () => counselorReferralService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: students = [] } = useFetch(
    ['dean-students', schoolId],
    () => deanStudentService.list(schoolId),
    { enabled: !!schoolId },
  );

  const createWelfareMutation = useMutate(
    () => welfareFlagService.create(schoolId, { ...welfareForm, flagged_by: user?.id ?? '', action_plan: welfareForm.action_plan || undefined, review_date: welfareForm.review_date || undefined }),
    [['dean-welfare'], ['dean-stats']],
    { onSuccess: () => { notify.success('Welfare flag added'); setShowWelfareCreate(false); setWelfareForm({ student_id: '', risk_type: '', notes: '', action_plan: '', review_date: '' }); } },
  );

  const resolveFlagMutation = useMutate(
    () => welfareFlagService.resolve(resolving!.id),
    [['dean-welfare'], ['dean-stats']],
    { onSuccess: () => { notify.success('Flag resolved'); setResolving(null); } },
  );

  const createCounselorMutation = useMutate(
    () => counselorReferralService.create(schoolId, { ...counselorForm, referred_by: user?.id ?? '' }),
    [['dean-counselor-referrals'], ['dean-stats']],
    { onSuccess: () => { notify.success('Referred to counselor'); setShowCounselorCreate(false); setCounselorForm({ student_id: '', reason: '', urgency: 'normal' }); } },
  );

  const studentOptions = (students as { id: string; first_name: string; last_name: string; current_grade_level: string }[])
    .map((s) => ({ value: s.id, label: `${s.last_name}, ${s.first_name} — Grade ${s.current_grade_level}` }));

  const activeFlags = (flags as WelfareFlag[]).filter((f) => f.status === 'active');
  const monitoringFlags = (flags as WelfareFlag[]).filter((f) => f.status === 'monitoring');
  const resolvedFlags = (flags as WelfareFlag[]).filter((f) => f.status === 'resolved');

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Student Welfare' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Welfare</h1>
          <p className="text-sm text-slate-500">Monitor at-risk students and manage counselor referrals.</p>
        </div>
        <Button onClick={() => activeTab === 'welfare' ? setShowWelfareCreate(true) : setShowCounselorCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> {activeTab === 'welfare' ? 'Add Welfare Flag' : 'Refer to Counselor'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'welfare' as const, label: `Welfare Flags (${activeFlags.length + monitoringFlags.length})`, icon: Heart },
          { id: 'counselor' as const, label: `Counselor Referrals (${(referrals as CounselorReferral[]).filter((r) => r.status === 'pending').length} pending)`, icon: BookOpen },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Welfare Flags Tab */}
      {activeTab === 'welfare' && (
        flagsLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-5">
            {activeFlags.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wider">At Risk ({activeFlags.length})</h2>
                {activeFlags.map((f) => (
                  <Card key={f.id} className="p-4 border-red-100 bg-red-50/20">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${RISK_COLORS[f.risk_type] ?? 'bg-slate-100 text-slate-600'}`}>
                        {RISK_TYPES.find((r) => r.value === f.risk_type)?.label ?? f.risk_type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {f.students ? `${f.students.last_name}, ${f.students.first_name}` : 'Unknown'} — Grade {f.students?.current_grade_level}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">{f.notes}</p>
                        {f.action_plan && <p className="text-xs text-slate-400 mt-0.5">Plan: {f.action_plan}</p>}
                        {f.review_date && <p className="text-xs text-slate-400 mt-0.5">Review: {new Date(f.review_date).toLocaleDateString()}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setResolving(f)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {monitoringFlags.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">Monitoring ({monitoringFlags.length})</h2>
                {monitoringFlags.map((f) => (
                  <Card key={f.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${RISK_COLORS[f.risk_type] ?? 'bg-slate-100 text-slate-600'}`}>
                        {RISK_TYPES.find((r) => r.value === f.risk_type)?.label ?? f.risk_type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{f.students ? `${f.students.last_name}, ${f.students.first_name}` : 'Unknown'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{f.notes}</p>
                      </div>
                      <Badge variant="warning" size="sm">Monitoring</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {resolvedFlags.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resolved ({resolvedFlags.length})</h2>
                {resolvedFlags.slice(0, 5).map((f) => (
                  <Card key={f.id} className="p-3 opacity-60">
                    <p className="text-sm text-slate-600">{f.students?.first_name} {f.students?.last_name} — {RISK_TYPES.find((r) => r.value === f.risk_type)?.label}</p>
                  </Card>
                ))}
              </div>
            )}
            {flags.length === 0 && (
              <Card className="p-16 text-center">
                <Heart className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No welfare flags. All students are accounted for.</p>
              </Card>
            )}
          </div>
        )
      )}

      {/* Counselor Referrals Tab */}
      {activeTab === 'counselor' && (
        refsLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {(referrals as CounselorReferral[]).map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${r.status === 'pending' ? 'bg-teal-100' : r.status === 'in_session' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <BookOpen className={`h-4 w-4 ${r.status === 'pending' ? 'text-teal-600' : r.status === 'in_session' ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">
                        {r.students ? `${r.students.last_name}, ${r.students.first_name}` : 'Unknown'}
                      </p>
                      <Badge variant={r.urgency === 'urgent' ? 'danger' : r.urgency === 'high' ? 'warning' : 'default'} size="sm">
                        {r.urgency}
                      </Badge>
                      <Badge variant={r.status === 'pending' ? 'info' : r.status === 'in_session' ? 'warning' : 'success'} size="sm">
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{r.reason}</p>
                    {r.counselor_outcome && <p className="text-xs text-slate-500 mt-0.5 italic">Counselor: {r.counselor_outcome}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            ))}
            {referrals.length === 0 && (
              <Card className="p-16 text-center">
                <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No counselor referrals yet.</p>
              </Card>
            )}
          </div>
        )
      )}

      {/* Welfare Flag Create Dialog */}
      {showWelfareCreate && (
        <Dialog open onClose={() => setShowWelfareCreate(false)} className="max-w-lg">
          <DialogHeader><DialogTitle>Add Welfare Flag</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Select label="Student *" options={studentOptions} value={welfareForm.student_id}
              onChange={(e) => setWelfareForm({ ...welfareForm, student_id: e.target.value })} placeholder="Select student" />
            <Select label="Risk Type *" options={RISK_TYPES} value={welfareForm.risk_type}
              onChange={(e) => setWelfareForm({ ...welfareForm, risk_type: e.target.value })} placeholder="Select type" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes *</label>
              <textarea rows={3} value={welfareForm.notes} onChange={(e) => setWelfareForm({ ...welfareForm, notes: e.target.value })}
                placeholder="Describe the concern..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Action Plan (optional)</label>
              <textarea rows={2} value={welfareForm.action_plan} onChange={(e) => setWelfareForm({ ...welfareForm, action_plan: e.target.value })}
                placeholder="Steps to support this student..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
            <Input label="Review Date (optional)" type="date" value={welfareForm.review_date}
              onChange={(e) => setWelfareForm({ ...welfareForm, review_date: e.target.value })} />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWelfareCreate(false)}>Cancel</Button>
            <Button onClick={() => createWelfareMutation.mutate(undefined)} loading={createWelfareMutation.isPending}
              disabled={!welfareForm.student_id || !welfareForm.risk_type || !welfareForm.notes}>
              Add Flag
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Counselor Referral Create Dialog */}
      {showCounselorCreate && (
        <Dialog open onClose={() => setShowCounselorCreate(false)} className="max-w-lg">
          <DialogHeader><DialogTitle>Refer to Counselor</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Select label="Student *" options={studentOptions} value={counselorForm.student_id}
              onChange={(e) => setCounselorForm({ ...counselorForm, student_id: e.target.value })} placeholder="Select student" />
            <Select label="Urgency" options={URGENCY_OPTIONS} value={counselorForm.urgency}
              onChange={(e) => setCounselorForm({ ...counselorForm, urgency: e.target.value as CounselorReferral['urgency'] })} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
              <textarea rows={3} value={counselorForm.reason} onChange={(e) => setCounselorForm({ ...counselorForm, reason: e.target.value })}
                placeholder="Why is this student being referred..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCounselorCreate(false)}>Cancel</Button>
            <Button onClick={() => createCounselorMutation.mutate(undefined)} loading={createCounselorMutation.isPending}
              disabled={!counselorForm.student_id || !counselorForm.reason}>
              Submit Referral
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {resolving && (
        <Dialog open onClose={() => setResolving(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Resolve Welfare Flag</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-slate-600">
              Mark the welfare flag for <strong>{resolving.students?.first_name} {resolving.students?.last_name}</strong> as resolved?
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={() => resolveFlagMutation.mutate(undefined)} loading={resolveFlagMutation.isPending}>
              Yes, Resolve
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
