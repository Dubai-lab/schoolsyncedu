import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { counselingService } from '@/services/guidanceService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Trash2, Eye, Clock, FileText } from 'lucide-react';

type SessionRow = {
  id: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  notes: string | null;
  issues_discussed: string[];
  action_items: Record<string, unknown>[];
  students: { id: string; first_name: string; last_name: string; registration_number: string };
  users: { id: string; first_name: string; last_name: string };
};

export default function CounselingRecords() {
  const { user } = useAuth();

  const { data, isLoading } = useFetch(
    ['counseling-sessions'],
    () => counselingService.list(),
  );

  const sessions = (data?.data ?? []) as unknown as SessionRow[];

  // Detail view
  const [selected, setSelected] = useState<SessionRow | null>(null);

  // New session dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    student_id: '', session_date: new Date().toISOString().slice(0, 10),
    session_time: '09:00', duration_minutes: '30', notes: '', issues: '',
  });

  const createSession = useMutate(
    () => counselingService.create({
      student_id: form.student_id,
      counselor_id: user?.id ?? '',
      session_date: form.session_date,
      session_time: form.session_time,
      duration_minutes: Number(form.duration_minutes),
      notes: form.notes || undefined,
      issues_discussed: form.issues ? form.issues.split(',').map((s) => s.trim()) : [],
    }),
    [['counseling-sessions']],
    {
      onSuccess: () => {
        notify.success('Session recorded');
        setShowCreate(false);
        setForm({ student_id: '', session_date: new Date().toISOString().slice(0, 10), session_time: '09:00', duration_minutes: '30', notes: '', issues: '' });
      },
    },
  );

  const deleteSession = useMutate(
    (id: string) => counselingService.delete(id),
    [['counseling-sessions']],
    { onSuccess: () => { notify.success('Session deleted'); setSelected(null); } },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const columns: Column<SessionRow>[] = [
    {
      key: 'session_date', header: 'Date',
      render: (r) => (
        <button onClick={() => setSelected(r)} className="text-blue-600 hover:underline font-medium">
          {new Date(r.session_date).toLocaleDateString()}
        </button>
      ),
    },
    {
      key: 'student', header: 'Student',
      render: (r) => <span>{r.students.first_name} {r.students.last_name}</span>,
    },
    {
      key: 'counselor', header: 'Counselor',
      render: (r) => <span>{r.users.first_name} {r.users.last_name}</span>,
    },
    {
      key: 'session_time', header: 'Time',
      render: (r) => <span className="text-slate-600">{r.session_time?.slice(0, 5) ?? '—'}</span>,
    },
    {
      key: 'duration_minutes', header: 'Duration',
      render: (r) => <Badge variant="info" size="sm">{r.duration_minutes} min</Badge>,
    },
    {
      key: 'issues', header: 'Issues',
      render: (r) => (
        <div className="flex gap-1 flex-wrap">
          {(r.issues_discussed ?? []).slice(0, 2).map((iss, i) => (
            <Badge key={i} variant="default" size="sm">{iss}</Badge>
          ))}
          {(r.issues_discussed ?? []).length > 2 && <Badge variant="default" size="sm">+{r.issues_discussed.length - 2}</Badge>}
        </div>
      ),
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => deleteSession.mutate(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Guidance', href: '/guidance' }, { label: 'Counseling Records' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Counseling Records</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Session
        </Button>
      </div>

      <Table columns={columns} data={sessions} keyExtractor={(r) => r.id} loading={isLoading}
        emptyMessage="No counseling sessions recorded yet." />

      {/* Detail Side Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-slate-200 z-50 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Session Details</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Student</p>
                <p className="font-medium">{selected.students.first_name} {selected.students.last_name}</p>
                <p className="text-xs text-slate-400 font-mono">{selected.students.registration_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Counselor</p>
                <p className="font-medium">{selected.users.first_name} {selected.users.last_name}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm">{new Date(selected.session_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Time</p>
                  <p className="text-sm flex items-center gap-1"><Clock className="h-3 w-3" /> {selected.session_time?.slice(0, 5) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Duration</p>
                  <p className="text-sm">{selected.duration_minutes} min</p>
                </div>
              </div>

              {(selected.issues_discussed ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Issues Discussed</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.issues_discussed.map((iss, i) => (
                      <Badge key={i} variant="warning" size="sm">{iss}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{selected.notes}</p>
                </div>
              )}

              {(selected.action_items ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Action Items</p>
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                    {selected.action_items.map((item, i) => (
                      <li key={i}>{JSON.stringify(item)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Session Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Record Counseling Session</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Student ID *" value={form.student_id} onChange={(e) => set('student_id', e.target.value)} placeholder="Student UUID" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date *" type="date" value={form.session_date} onChange={(e) => set('session_date', e.target.value)} />
              <Input label="Time" type="time" value={form.session_time} onChange={(e) => set('session_time', e.target.value)} />
            </div>
            <Input label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} />
            <Input label="Issues Discussed" value={form.issues} onChange={(e) => set('issues', e.target.value)} placeholder="Comma-separated: behavioral, academic, ..." />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Session notes..." />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createSession.mutate(undefined)} loading={createSession.isPending}
            disabled={!form.student_id || !form.session_date}>
            Save Session
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}