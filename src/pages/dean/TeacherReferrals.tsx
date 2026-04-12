import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { referralService } from '@/services/deanService';
import type { TeacherReferral } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Users, CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react';

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  pending: 'error',
  reviewed: 'warning',
  resolved: 'success',
  dismissed: 'default',
};

export default function TeacherReferrals() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [selected, setSelected] = useState<TeacherReferral | null>(null);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState<'reviewed' | 'resolved' | 'dismissed'>('reviewed');

  const { data: referrals = [], isLoading } = useFetch(
    ['dean-referrals', schoolId],
    () => referralService.list(schoolId),
    { enabled: !!schoolId },
  );

  const updateMutation = useMutate(
    () => referralService.updateStatus(selected!.id, action, notes),
    [['dean-referrals'], ['dean-stats']],
    {
      onSuccess: () => {
        notify.success(`Referral marked as ${action}`);
        setSelected(null);
        setNotes('');
      },
    },
  );

  const pending = (referrals as TeacherReferral[]).filter((r) => r.status === 'pending');
  const others = (referrals as TeacherReferral[]).filter((r) => r.status !== 'pending');

  function ReferralCard({ ref: r }: { ref: TeacherReferral }) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${r.status === 'pending' ? 'bg-yellow-100' : r.status === 'resolved' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
            <Users className={`h-4 w-4 ${r.status === 'pending' ? 'text-yellow-600' : r.status === 'resolved' ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900 text-sm">
                {r.students ? `${r.students.last_name}, ${r.students.first_name}` : 'Unknown'}
              </p>
              <span className="text-xs text-slate-400">Grade {r.students?.current_grade_level}</span>
              <Badge variant={STATUS_COLORS[r.status] ?? 'default'} size="sm">{r.status}</Badge>
            </div>
            <p className="text-xs font-medium text-slate-600 mt-0.5">By: {r.users?.full_name ?? 'Teacher'}</p>
            <p className="text-sm text-slate-700 mt-1">{r.reason}</p>
            {r.details && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{r.details}</p>}
            <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
          {r.status === 'pending' && (
            <Button size="sm" onClick={() => { setSelected(r); setAction('reviewed'); setNotes(''); }}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Respond
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Teacher Referrals' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Teacher Referrals</h1>
        <p className="text-sm text-slate-500">Referrals submitted by teachers requiring your attention.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" /> Pending ({pending.length})
              </h2>
              {pending.map((r) => <ReferralCard key={r.id} ref={r} />)}
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Previous Referrals</h2>
              {others.map((r) => <ReferralCard key={r.id} ref={r} />)}
            </div>
          )}

          {referrals.length === 0 && (
            <Card className="p-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No referrals yet. Teachers will submit referrals from their portal.</p>
            </Card>
          )}
        </>
      )}

      {selected && (
        <Dialog open onClose={() => setSelected(null)} className="max-w-md">
          <DialogHeader><DialogTitle>Respond to Referral</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-800">{selected.students?.first_name} {selected.students?.last_name}</p>
              <p className="text-slate-600 mt-1">{selected.reason}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Action</label>
              <div className="flex gap-2">
                {(['reviewed', 'resolved', 'dismissed'] as const).map((a) => (
                  <button key={a} onClick={() => setAction(a)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${action === a ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                  >
                    {a === 'reviewed' ? <><Clock className="h-3 w-3 inline mr-1" />Under Review</> :
                     a === 'resolved' ? <><CheckCircle2 className="h-3 w-3 inline mr-1" />Resolved</> :
                     <><XCircle className="h-3 w-3 inline mr-1" />Dismiss</>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dean Notes</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes or actions taken..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate(undefined)} loading={updateMutation.isPending}>Save Response</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
