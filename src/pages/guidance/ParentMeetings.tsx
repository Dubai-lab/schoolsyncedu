import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { parentMeetingService } from '@/services/guidanceService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Trash2, Users, Clock, FileText } from 'lucide-react';

type MeetingRow = {
  id: string;
  meeting_date: string;
  meeting_time: string;
  topics: string | null;
  notes: string | null;
  action_items: Record<string, unknown>[] | null;
  students: { id: string; first_name: string; last_name: string; registration_number: string };
  guardians: { id: string; first_name: string; last_name: string };
  users: { id: string; first_name: string; last_name: string } | null;
};

export default function ParentMeetings() {
  const { user } = useAuth();

  const { data, isLoading } = useFetch(
    ['parent-meetings'],
    () => parentMeetingService.list(),
  );

  const meetings = (data?.data ?? []) as unknown as MeetingRow[];

  // Detail
  const [selected, setSelected] = useState<MeetingRow | null>(null);

  // Schedule dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    student_id: '', parent_id: '', meeting_date: new Date().toISOString().slice(0, 10),
    meeting_time: '10:00', topics: '', notes: '',
  });

  const createMeeting = useMutate(
    () => parentMeetingService.create({
      student_id: form.student_id,
      parent_id: form.parent_id,
      staff_member_id: user?.id,
      meeting_date: form.meeting_date,
      meeting_time: form.meeting_time,
      topics: form.topics || undefined,
      notes: form.notes || undefined,
    }),
    [['parent-meetings']],
    {
      onSuccess: () => {
        notify.success('Meeting scheduled');
        setShowCreate(false);
        setForm({ student_id: '', parent_id: '', meeting_date: new Date().toISOString().slice(0, 10), meeting_time: '10:00', topics: '', notes: '' });
      },
    },
  );

  const deleteMeeting = useMutate(
    (id: string) => parentMeetingService.delete(id),
    [['parent-meetings']],
    { onSuccess: () => { notify.success('Meeting deleted'); setSelected(null); } },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Upcoming vs past
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings.filter((m) => m.meeting_date >= today);
  const past = meetings.filter((m) => m.meeting_date < today);

  const columns: Column<MeetingRow>[] = [
    {
      key: 'meeting_date', header: 'Date',
      render: (r) => (
        <button onClick={() => setSelected(r)} className="text-blue-600 hover:underline font-medium">
          {new Date(r.meeting_date).toLocaleDateString()}
        </button>
      ),
    },
    {
      key: 'meeting_time', header: 'Time',
      render: (r) => <span className="text-sm flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> {r.meeting_time?.slice(0, 5) ?? '—'}</span>,
    },
    {
      key: 'student', header: 'Student',
      render: (r) => <span>{r.students.first_name} {r.students.last_name}</span>,
    },
    {
      key: 'parent', header: 'Parent/Guardian',
      render: (r) => <span>{r.guardians.first_name} {r.guardians.last_name}</span>,
    },
    {
      key: 'staff', header: 'Staff Member',
      render: (r) => r.users ? <span>{r.users.first_name} {r.users.last_name}</span> : <span className="text-slate-400">—</span>,
    },
    {
      key: 'topics', header: 'Topics',
      render: (r) => <span className="text-sm text-slate-600 truncate max-w-xs block">{r.topics ?? '—'}</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><FileText className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => deleteMeeting.mutate(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Guidance', href: '/guidance' }, { label: 'Parent Meetings' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" /> Parent Meetings
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            Upcoming <Badge variant="info" size="sm">{upcoming.length}</Badge>
          </h2>
          <Table columns={columns} data={upcoming} keyExtractor={(r) => r.id} loading={isLoading} />
        </div>
      )}

      {/* Past */}
      <div>
        {upcoming.length > 0 && <h2 className="text-sm font-semibold text-slate-500 mb-2">Past Meetings</h2>}
        <Table columns={columns} data={past} keyExtractor={(r) => r.id} loading={isLoading && upcoming.length === 0}
          emptyMessage="No meetings recorded." />
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-slate-200 z-50 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Meeting Details</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm font-medium">{new Date(selected.meeting_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Time</p>
                  <p className="text-sm">{selected.meeting_time?.slice(0, 5) ?? '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Student</p>
                <p className="font-medium">{selected.students.first_name} {selected.students.last_name}</p>
                <p className="text-xs text-slate-400 font-mono">{selected.students.registration_number}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Parent/Guardian</p>
                <p className="font-medium">{selected.guardians.first_name} {selected.guardians.last_name}</p>
              </div>

              {selected.users && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Staff Member</p>
                  <p className="font-medium">{selected.users.first_name} {selected.users.last_name}</p>
                </div>
              )}

              {selected.topics && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Topics</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.topics}</p>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {(selected.action_items ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Action Items</p>
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                    {selected.action_items!.map((item, i) => (
                      <li key={i}>{JSON.stringify(item)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Schedule Parent Meeting</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Student ID *" value={form.student_id} onChange={(e) => set('student_id', e.target.value)} placeholder="Student UUID" />
            <Input label="Parent/Guardian ID *" value={form.parent_id} onChange={(e) => set('parent_id', e.target.value)} placeholder="Guardian UUID" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date *" type="date" value={form.meeting_date} onChange={(e) => set('meeting_date', e.target.value)} />
              <Input label="Time" type="time" value={form.meeting_time} onChange={(e) => set('meeting_time', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Topics</label>
              <textarea rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.topics} onChange={(e) => set('topics', e.target.value)} placeholder="Discussion topics..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Pre-meeting notes..." />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createMeeting.mutate(undefined)} loading={createMeeting.isPending}
            disabled={!form.student_id || !form.parent_id || !form.meeting_date}>
            Schedule
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}