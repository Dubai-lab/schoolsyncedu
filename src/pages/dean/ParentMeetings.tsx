import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { parentMeetingService, deanStudentService } from '@/services/deanService';
import type { ParentMeeting } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Plus, Calendar, CheckCircle2, XCircle, UserX } from 'lucide-react';

const STATUS_COLORS: Record<string, 'info' | 'success' | 'default' | 'error'> = {
  scheduled: 'info', completed: 'success', cancelled: 'default', no_show: 'error',
};

export default function ParentMeetings() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showCreate, setShowCreate] = useState(false);
  const [completing, setCompleting] = useState<ParentMeeting | null>(null);
  const [outcome, setOutcome] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [attended, setAttended] = useState(true);
  const [form, setForm] = useState({ student_id: '', scheduled_at: '', purpose: '' });

  const { data: meetings = [], isLoading } = useFetch(
    ['dean-meetings', schoolId],
    () => parentMeetingService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: students = [] } = useFetch(
    ['dean-students', schoolId],
    () => deanStudentService.list(schoolId),
    { enabled: !!schoolId },
  );

  const createMutation = useMutate(
    () => parentMeetingService.create(schoolId, { ...form, dean_id: user?.id ?? '' }),
    [['dean-meetings'], ['dean-stats']],
    {
      onSuccess: () => {
        notify.success('Meeting scheduled');
        setShowCreate(false);
        setForm({ student_id: '', scheduled_at: '', purpose: '' });
      },
    },
  );

  const completeMutation = useMutate(
    () => parentMeetingService.complete(completing!.id, { outcome, parent_attended: attended, follow_up: followUp || undefined }),
    [['dean-meetings'], ['dean-stats']],
    { onSuccess: () => { notify.success('Meeting recorded as completed'); setCompleting(null); } },
  );

  const cancelMutation = useMutate(
    (id: string) => parentMeetingService.updateStatus(id, 'cancelled'),
    [['dean-meetings']],
    { onSuccess: () => notify.success('Meeting cancelled') },
  );

  const studentOptions = (students as { id: string; first_name: string; last_name: string; current_grade_level: string }[])
    .map((s) => ({ value: s.id, label: `${s.last_name}, ${s.first_name} — Grade ${s.current_grade_level}` }));

  const upcoming = (meetings as ParentMeeting[]).filter((m) => m.status === 'scheduled' && new Date(m.scheduled_at) >= new Date());
  const past = (meetings as ParentMeeting[]).filter((m) => m.status !== 'scheduled' || new Date(m.scheduled_at) < new Date());
  const canCreate = form.student_id && form.scheduled_at && form.purpose;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Parent Meetings' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Parent Meetings</h1>
          <p className="text-sm text-slate-500">Schedule and track meetings with parents.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Schedule Meeting
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider">Upcoming ({upcoming.length})</h2>
              {upcoming.map((m) => (
                <Card key={m.id} className="p-4 border-blue-100 bg-blue-50/30">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">
                          {m.students ? `${m.students.last_name}, ${m.students.first_name}` : 'Unknown'} — Parent Meeting
                        </p>
                        <Badge variant="info" size="sm">Scheduled</Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{m.purpose}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        {new Date(m.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => { setCompleting(m); setOutcome(''); setFollowUp(''); setAttended(true); }}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Record
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(m.id)}>
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">History</h2>
              {past.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${m.status === 'completed' ? 'bg-emerald-100' : m.status === 'no_show' ? 'bg-red-100' : 'bg-slate-100'}`}>
                      {m.status === 'no_show' ? <UserX className="h-5 w-5 text-red-500" /> : <Calendar className={`h-5 w-5 ${m.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">
                          {m.students ? `${m.students.last_name}, ${m.students.first_name}` : 'Unknown'}
                        </p>
                        <Badge variant={STATUS_COLORS[m.status] ?? 'default'} size="sm">{m.status.replace(/_/g, ' ')}</Badge>
                        {m.status === 'completed' && (
                          <span className="text-xs text-slate-400">{m.parent_attended ? 'Parent attended' : 'Parent absent'}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{m.purpose}</p>
                      {m.outcome && <p className="text-xs text-slate-500 mt-0.5 italic">Outcome: {m.outcome}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(m.scheduled_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {meetings.length === 0 && (
            <Card className="p-16 text-center">
              <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No meetings scheduled yet.</p>
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Schedule First Meeting
              </Button>
            </Card>
          )}
        </>
      )}

      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Parent Meeting</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Select label="Student *" options={studentOptions} value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="Select student" />
            <Input label="Date & Time *" type="datetime-local" value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purpose *</label>
              <textarea rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Reason for meeting..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(undefined)} loading={createMutation.isPending} disabled={!canCreate}>
              Schedule Meeting
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {completing && (
        <Dialog open onClose={() => setCompleting(null)} className="max-w-md">
          <DialogHeader><DialogTitle>Record Meeting Outcome</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)}
                className="rounded border-slate-300 text-primary-600" />
              <span className="text-sm text-slate-700">Parent attended the meeting</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Outcome / Discussion Notes</label>
              <textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)}
                placeholder="What was discussed and agreed upon..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Actions (optional)</label>
              <textarea rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Any follow-up actions required..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button onClick={() => completeMutation.mutate(undefined)} loading={completeMutation.isPending}>Save Outcome</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
