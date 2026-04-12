import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { incidentService, incidentActionService } from '@/services/guidanceService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Trash2, AlertTriangle, Shield, ChevronRight } from 'lucide-react';

const SEVERITY_OPTIONS = [
  { label: 'All Severities', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

const INCIDENT_TYPES = [
  { label: 'Behavioral', value: 'behavioral' },
  { label: 'Academic Dishonesty', value: 'academic_dishonesty' },
  { label: 'Bullying', value: 'bullying' },
  { label: 'Fighting', value: 'fighting' },
  { label: 'Vandalism', value: 'vandalism' },
  { label: 'Truancy', value: 'truancy' },
  { label: 'Dress Code', value: 'dress_code' },
  { label: 'Other', value: 'other' },
];

const severityColor = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
  switch (s) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'danger';
    case 'critical': return 'danger';
    default: return 'default';
  }
};

type IncidentRow = {
  id: string;
  incident_date: string;
  incident_type: string;
  description: string;
  severity: string;
  students: { id: string; first_name: string; last_name: string; registration_number: string };
  users: { id: string; first_name: string; last_name: string };
};

type ActionRow = {
  id: string;
  action_type: string;
  description: string | null;
  action_date: string;
  users: { first_name: string; last_name: string } | null;
};

export default function StudentIncidents() {
  const { user } = useAuth();
  const [severityFilter, setSeverityFilter] = useState('');

  const { data, isLoading } = useFetch(
    ['student-incidents', severityFilter],
    () => incidentService.list(severityFilter ? { severity: severityFilter } : undefined),
  );

  const incidents = (data?.data ?? []) as unknown as IncidentRow[];

  // Detail panel
  const [selected, setSelected] = useState<IncidentRow | null>(null);

  const { data: actions } = useFetch(
    ['incident-actions', selected?.id ?? ''],
    () => incidentActionService.listByIncident(selected!.id),
    { enabled: !!selected },
  );

  // Report dialog
  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState({
    student_id: '', incident_date: new Date().toISOString().slice(0, 10),
    incident_type: 'behavioral', description: '', severity: 'medium',
  });

  const createIncident = useMutate(
    () => incidentService.create({
      student_id: form.student_id,
      incident_date: form.incident_date,
      incident_type: form.incident_type,
      description: form.description,
      severity: form.severity,
      reported_by: user?.id ?? '',
    }),
    [['student-incidents']],
    {
      onSuccess: () => {
        notify.success('Incident reported');
        setShowReport(false);
        setForm({ student_id: '', incident_date: new Date().toISOString().slice(0, 10), incident_type: 'behavioral', description: '', severity: 'medium' });
      },
    },
  );

  const deleteIncident = useMutate(
    (id: string) => incidentService.delete(id),
    [['student-incidents']],
    { onSuccess: () => { notify.success('Incident deleted'); setSelected(null); } },
  );

  // Add action to incident
  const [showAddAction, setShowAddAction] = useState(false);
  const [actionForm, setActionForm] = useState({ action_type: 'warning', description: '', action_date: new Date().toISOString().slice(0, 10) });

  const addAction = useMutate(
    () => incidentActionService.create({
      incident_id: selected!.id,
      action_type: actionForm.action_type,
      description: actionForm.description || undefined,
      approved_by: user?.id,
      action_date: actionForm.action_date,
    }),
    [['incident-actions']],
    { onSuccess: () => { notify.success('Action added'); setShowAddAction(false); setActionForm({ action_type: 'warning', description: '', action_date: new Date().toISOString().slice(0, 10) }); } },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const columns: Column<IncidentRow>[] = [
    {
      key: 'incident_date', header: 'Date',
      render: (r) => (
        <button onClick={() => setSelected(r)} className="text-blue-600 hover:underline font-medium">
          {new Date(r.incident_date).toLocaleDateString()}
        </button>
      ),
    },
    {
      key: 'student', header: 'Student',
      render: (r) => <span>{r.students.first_name} {r.students.last_name}</span>,
    },
    {
      key: 'incident_type', header: 'Type',
      render: (r) => <Badge variant="info" size="sm">{r.incident_type.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'severity', header: 'Severity',
      render: (r) => <Badge variant={severityColor(r.severity)} size="sm">{r.severity}</Badge>,
    },
    {
      key: 'description', header: 'Description',
      render: (r) => <span className="text-sm text-slate-600 truncate max-w-xs block">{r.description}</span>,
    },
    {
      key: 'reported_by', header: 'Reported By',
      render: (r) => <span className="text-sm">{r.users.first_name} {r.users.last_name}</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Guidance', href: '/guidance' }, { label: 'Student Incidents' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Student Incidents
        </h1>
        <Button onClick={() => setShowReport(true)}>
          <Plus className="h-4 w-4 mr-1" /> Report Incident
        </Button>
      </div>

      {/* Severity Filter */}
      <div className="w-48">
        <Select options={SEVERITY_OPTIONS} value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)} />
      </div>

      <Table columns={columns} data={incidents} keyExtractor={(r) => r.id} loading={isLoading}
        emptyMessage="No incidents reported." />

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-xl border-l border-slate-200 z-50 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Incident Details</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={severityColor(selected.severity)}>{selected.severity}</Badge>
                <Badge variant="info">{selected.incident_type.replace(/_/g, ' ')}</Badge>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Student</p>
                <p className="font-medium">{selected.students.first_name} {selected.students.last_name}</p>
                <p className="text-xs text-slate-400 font-mono">{selected.students.registration_number}</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm">{new Date(selected.incident_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Reported By</p>
                  <p className="text-sm">{selected.users.first_name} {selected.users.last_name}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.description}</p>
              </div>

              {/* Actions taken */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" /> Actions Taken
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowAddAction(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {(actions as unknown as ActionRow[] ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">No actions recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {(actions as unknown as ActionRow[]).map((a) => (
                      <Card key={a.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="warning" size="sm">{a.action_type}</Badge>
                          <span className="text-xs text-slate-400">{new Date(a.action_date).toLocaleDateString()}</span>
                        </div>
                        {a.description && <p className="text-sm text-slate-600 mt-1">{a.description}</p>}
                        {a.users && <p className="text-xs text-slate-400 mt-1">Approved by: {a.users.first_name} {a.users.last_name}</p>}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 w-full"
                onClick={() => deleteIncident.mutate(selected.id)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete Incident
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report Incident Dialog */}
      <Dialog open={showReport} onClose={() => setShowReport(false)}>
        <DialogHeader><DialogTitle>Report New Incident</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Student ID *" value={form.student_id} onChange={(e) => set('student_id', e.target.value)} placeholder="Student UUID" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date *" type="date" value={form.incident_date} onChange={(e) => set('incident_date', e.target.value)} />
              <Select label="Severity *" options={SEVERITY_OPTIONS.slice(1)} value={form.severity}
                onChange={(e) => set('severity', e.target.value)} />
            </div>
            <Select label="Incident Type *" options={INCIDENT_TYPES} value={form.incident_type}
              onChange={(e) => set('incident_type', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <textarea rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the incident in detail..." />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowReport(false)}>Cancel</Button>
          <Button onClick={() => createIncident.mutate(undefined)} loading={createIncident.isPending}
            disabled={!form.student_id || !form.description}>
            Report
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Action Dialog */}
      <Dialog open={showAddAction} onClose={() => setShowAddAction(false)}>
        <DialogHeader><DialogTitle>Add Action</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Action Type *" options={[
              { label: 'Warning', value: 'warning' },
              { label: 'Detention', value: 'detention' },
              { label: 'Suspension', value: 'suspension' },
              { label: 'Parent Conference', value: 'parent_conference' },
              { label: 'Counseling Referral', value: 'counseling_referral' },
              { label: 'Community Service', value: 'community_service' },
              { label: 'Other', value: 'other' },
            ]} value={actionForm.action_type}
              onChange={(e) => setActionForm((f) => ({ ...f, action_type: e.target.value }))} />
            <Input label="Date" type="date" value={actionForm.action_date}
              onChange={(e) => setActionForm((f) => ({ ...f, action_date: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={actionForm.description} onChange={(e) => setActionForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddAction(false)}>Cancel</Button>
          <Button onClick={() => addAction.mutate(undefined)} loading={addAction.isPending}>
            Add Action
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}