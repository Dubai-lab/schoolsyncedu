import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { incidentService, deanStudentService } from '@/services/deanService';
import type { Incident } from '@/services/deanService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Plus, AlertTriangle, CheckCircle2, Clock, Search, Filter } from 'lucide-react';

const INCIDENT_TYPES = [
  { value: 'tardiness', label: 'Tardiness' },
  { value: 'truancy', label: 'Truancy / Skipping Class' },
  { value: 'disruptive_behavior', label: 'Disruptive Behavior' },
  { value: 'fighting', label: 'Fighting' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'theft', label: 'Theft' },
  { value: 'cheating', label: 'Cheating / Academic Dishonesty' },
  { value: 'insubordination', label: 'Insubordination' },
  { value: 'other', label: 'Other' },
];

const ACTION_OPTIONS = [
  { value: 'none', label: 'No Action Yet' },
  { value: 'verbal_warning', label: 'Verbal Warning' },
  { value: 'written_warning', label: 'Written Warning' },
  { value: 'detention', label: 'Detention' },
  { value: 'parent_call', label: 'Parent Called' },
  { value: 'suspension', label: 'Suspension Issued' },
  { value: 'expulsion_recommendation', label: 'Expulsion Recommended' },
];

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  open: 'danger',
  under_review: 'warning',
  resolved: 'success',
};

function incidentTypeLabel(type: string) {
  return INCIDENT_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, ' ');
}
function actionLabel(action: string) {
  return ACTION_OPTIONS.find((a) => a.value === action)?.label ?? action.replace(/_/g, ' ');
}

export default function IncidentLog() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  // Form state
  const [form, setForm] = useState({
    student_id: '', incident_type: '', description: '',
    incident_date: new Date().toISOString().split('T')[0], action_taken: 'none',
  });

  const { data: incidents = [], isLoading } = useFetch(
    ['dean-incidents', schoolId],
    () => incidentService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: students = [] } = useFetch(
    ['dean-students', schoolId],
    () => deanStudentService.list(schoolId),
    { enabled: !!schoolId },
  );

  const createMutation = useMutate(
    () => incidentService.create(schoolId, { ...form, reported_by: user?.id ?? '' }),
    [['dean-incidents'], ['dean-stats']],
    {
      onSuccess: () => {
        notify.success('Incident logged successfully');
        setShowCreate(false);
        setForm({ student_id: '', incident_type: '', description: '', incident_date: new Date().toISOString().split('T')[0], action_taken: 'none' });
      },
    },
  );

  const resolveMutation = useMutate(
    () => incidentService.resolve(resolving!.id, resolveNotes),
    [['dean-incidents'], ['dean-stats']],
    {
      onSuccess: () => {
        notify.success('Incident resolved');
        setResolving(null);
        setResolveNotes('');
      },
    },
  );

  const studentOptions = (students as { id: string; first_name: string; last_name: string; current_grade_level: string }[])
    .map((s) => ({ value: s.id, label: `${s.last_name}, ${s.first_name} — Grade ${s.current_grade_level}` }));

  const filtered = (incidents as Incident[]).filter((inc) => {
    const student = inc.students;
    const name = student ? `${student.first_name} ${student.last_name}`.toLowerCase() : '';
    const matchSearch = !search || name.includes(search.toLowerCase()) || incidentTypeLabel(inc.incident_type).toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || inc.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const canCreate = form.student_id && form.incident_type && form.description && form.incident_date;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Dean', href: '/dean' }, { label: 'Incident Log' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Incident Log</h1>
          <p className="text-sm text-slate-500">Record and manage all student disciplinary incidents.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Log Incident
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or type..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'open', label: 'Open' },
            { value: 'under_review', label: 'Under Review' },
            { value: 'resolved', label: 'Resolved' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
          label=""
          placeholder=""
        />
        <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
          <Filter className="h-3.5 w-3.5" />
          {filtered.length} of {incidents.length} incidents
        </div>
      </div>

      {/* Incidents list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-16 text-center">
          <AlertTriangle className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No incidents found.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Log First Incident
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => (
            <Card key={inc.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${inc.status === 'resolved' ? 'bg-emerald-100' : inc.status === 'under_review' ? 'bg-amber-100' : 'bg-red-100'}`}>
                  {inc.status === 'resolved'
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : inc.status === 'under_review'
                    ? <Clock className="h-5 w-5 text-amber-600" />
                    : <AlertTriangle className="h-5 w-5 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">
                      {inc.students ? `${inc.students.last_name}, ${inc.students.first_name}` : 'Unknown Student'}
                    </p>
                    <span className="text-xs text-slate-400">Grade {inc.students?.current_grade_level}</span>
                    <Badge variant={STATUS_COLORS[inc.status] ?? 'default'} size="sm">
                      {inc.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{incidentTypeLabel(inc.incident_type)}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{inc.description}</p>
                  <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
                    <span>{new Date(inc.incident_date).toLocaleDateString()}</span>
                    <span>Action: {actionLabel(inc.action_taken)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {inc.status !== 'resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setResolving(inc); setResolveNotes(inc.dean_notes ?? ''); }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} className="max-w-lg">
          <DialogHeader><DialogTitle>Log New Incident</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Select
              label="Student *"
              options={studentOptions}
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              placeholder="Select student"
            />
            <Select
              label="Incident Type *"
              options={INCIDENT_TYPES}
              value={form.incident_type}
              onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              placeholder="Select type"
            />
            <Input
              label="Incident Date *"
              type="date"
              value={form.incident_date}
              onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what happened..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
              />
            </div>
            <Select
              label="Action Taken"
              options={ACTION_OPTIONS}
              value={form.action_taken}
              onChange={(e) => setForm({ ...form, action_taken: e.target.value })}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(undefined)} loading={createMutation.isPending} disabled={!canCreate}>
              Log Incident
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Resolve Dialog */}
      {resolving && (
        <Dialog open onClose={() => setResolving(null)} className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Incident</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Resolving incident for <strong>{resolving.students?.first_name} {resolving.students?.last_name}</strong>: {incidentTypeLabel(resolving.incident_type)}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Notes</label>
              <textarea
                rows={3}
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Describe how this was resolved..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
            <Button onClick={() => resolveMutation.mutate(undefined)} loading={resolveMutation.isPending}>
              Mark Resolved
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
