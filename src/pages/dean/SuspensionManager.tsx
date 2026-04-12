import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { suspensionService, deanStudentService } from '@/services/deanService';
import type { Suspension } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Plus, ShieldOff, CheckCircle2, Bell } from 'lucide-react';

export default function SuspensionManager() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showCreate, setShowCreate] = useState(false);
  const [reinstating, setReinstating] = useState<Suspension | null>(null);
  const [reinstateNotes, setReinstateNotes] = useState('');
  const [form, setForm] = useState({
    student_id: '', start_date: '', end_date: '', reason: '', parent_notified: false,
  });

  const { data: suspensions = [], isLoading } = useFetch(
    ['dean-suspensions', schoolId],
    () => suspensionService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: students = [] } = useFetch(
    ['dean-students', schoolId],
    () => deanStudentService.list(schoolId),
    { enabled: !!schoolId },
  );

  const createMutation = useMutate(
    () => suspensionService.create(schoolId, { ...form, issued_by: user?.id ?? '', parent_notified: form.parent_notified }),
    [['dean-suspensions'], ['dean-stats']],
    {
      onSuccess: () => {
        notify.success('Suspension recorded');
        setShowCreate(false);
        setForm({ student_id: '', start_date: '', end_date: '', reason: '', parent_notified: false });
      },
    },
  );

  const reinstateMutation = useMutate(
    () => suspensionService.reinstate(reinstating!.id, reinstateNotes),
    [['dean-suspensions'], ['dean-stats']],
    { onSuccess: () => { notify.success('Student reinstated'); setReinstating(null); setReinstateNotes(''); } },
  );

  const notifyMutation = useMutate(
    (id: string) => suspensionService.markParentNotified(id),
    [['dean-suspensions']],
    { onSuccess: () => notify.success('Parent notification recorded') },
  );

  const studentOptions = (students as { id: string; first_name: string; last_name: string; current_grade_level: string }[])
    .map((s) => ({ value: s.id, label: `${s.last_name}, ${s.first_name} — Grade ${s.current_grade_level}` }));

  const active = (suspensions as Suspension[]).filter((s) => s.status === 'active' && new Date(s.end_date) >= new Date());
  const past = (suspensions as Suspension[]).filter((s) => s.status !== 'active' || new Date(s.end_date) < new Date());

  const canCreate = form.student_id && form.start_date && form.end_date && form.reason;

  function SuspensionCard({ s }: { s: Suspension }) {
    const isActive = s.status === 'active' && new Date(s.end_date) >= new Date();
    const daysLeft = isActive ? Math.ceil((new Date(s.end_date).getTime() - Date.now()) / 86400000) : 0;
    return (
      <Card className={`p-4 ${isActive ? 'border-rose-200 bg-rose-50/30' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-rose-100' : 'bg-slate-100'}`}>
            <ShieldOff className={`h-5 w-5 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900 text-sm">
                {s.students ? `${s.students.last_name}, ${s.students.first_name}` : 'Unknown'}
              </p>
              <span className="text-xs text-slate-400">Grade {s.students?.current_grade_level}</span>
              <Badge variant={isActive ? 'danger' : 'default'} size="sm">
                {isActive ? `Active — ${daysLeft}d left` : s.status.replace(/_/g, ' ')}
              </Badge>
              {isActive && !s.parent_notified && (
                <Badge variant="warning" size="sm">Parent not notified</Badge>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{s.reason}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(s.start_date).toLocaleDateString()} — {new Date(s.end_date).toLocaleDateString()}
            </p>
          </div>
          {isActive && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {!s.parent_notified && (
                <Button size="sm" variant="outline" onClick={() => notifyMutation.mutate(s.id)}>
                  <Bell className="h-3.5 w-3.5 mr-1" /> Notify
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setReinstating(s); setReinstateNotes(''); }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Reinstate
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Suspensions' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suspension Manager</h1>
          <p className="text-sm text-slate-500">Track active and historical student suspensions.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Issue Suspension
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-rose-700 uppercase tracking-wider">Active ({active.length})</h2>
              {active.map((s) => <SuspensionCard key={s.id} s={s} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">History</h2>
              {past.map((s) => <SuspensionCard key={s.id} s={s} />)}
            </div>
          )}
          {suspensions.length === 0 && (
            <Card className="p-16 text-center">
              <ShieldOff className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No suspensions recorded.</p>
            </Card>
          )}
        </>
      )}

      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} className="max-w-lg">
          <DialogHeader><DialogTitle>Issue Suspension</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Select label="Student *" options={studentOptions} value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="Select student" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date *" type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <Input label="End Date *" type="date" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
              <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Reason for suspension..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.parent_notified}
                onChange={(e) => setForm({ ...form, parent_notified: e.target.checked })}
                className="rounded border-slate-300 text-primary-600" />
              <span className="text-sm text-slate-600">Parent has been notified</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(undefined)} loading={createMutation.isPending} disabled={!canCreate}>
              Issue Suspension
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {reinstating && (
        <Dialog open onClose={() => setReinstating(null)} className="max-w-md">
          <DialogHeader><DialogTitle>Early Reinstatement</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Reinstating <strong>{reinstating.students?.first_name} {reinstating.students?.last_name}</strong> before the suspension ends ({new Date(reinstating.end_date).toLocaleDateString()}).
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reinstatement Notes</label>
              <textarea rows={3} value={reinstateNotes} onChange={(e) => setReinstateNotes(e.target.value)}
                placeholder="Reason for early reinstatement..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReinstating(null)}>Cancel</Button>
            <Button onClick={() => reinstateMutation.mutate(undefined)} loading={reinstateMutation.isPending}>
              Confirm Reinstatement
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
