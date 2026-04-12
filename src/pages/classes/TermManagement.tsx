import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { academicCalendarService } from '@/services/classService';
import { registrarService } from '@/services/registrarService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import type { AcademicCalendar } from '@/types/school.types';
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';

const TERM_OPTIONS = [
  { label: 'First Term', value: 'first_term' },
  { label: 'Second Term', value: 'second_term' },
  { label: 'Third Term', value: 'third_term' },
];

interface TermForm {
  term_name: string;
  start_date: string;
  end_date: string;
}

const emptyForm: TermForm = { term_name: '', start_date: '', end_date: '' };

export default function TermManagement() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [form, setForm] = useState<TermForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: academicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const { data: terms = [], refetch } = useFetch(
    ['academic-calendar', schoolId, (academicYear ?? '') as string],
    () => academicCalendarService.list(schoolId),
    { enabled: !!schoolId },
  );

  const yearString = academicYear as string | undefined;

  // Only show terms for the current academic year
  const currentTerms = (terms as unknown as AcademicCalendar[]).filter(
    (t) => t.academic_year === yearString,
  );

  // Which term names already exist this year
  const existingTermNames = new Set(currentTerms.map((t) => t.term_name));
  const availableTermOptions = TERM_OPTIONS.filter((o) => !existingTermNames.has(o.value));

  const handleSave = async () => {
    if (!form.term_name || !form.start_date || !form.end_date || !yearString) return;
    if (form.start_date >= form.end_date) {
      notify.error('End date must be after start date');
      return;
    }
    setSaving(true);
    try {
      await academicCalendarService.create(schoolId, {
        academic_year: yearString,
        term_name: form.term_name,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      notify.success('Term created successfully');
      setForm(emptyForm);
      setShowForm(false);
      refetch();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to create term');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Teachers will lose access to this term for grade entry.`)) return;
    setDeleting(id);
    try {
      await academicCalendarService.delete(id);
      notify.success('Term deleted');
      refetch();
    } catch {
      notify.error('Failed to delete term');
    } finally {
      setDeleting(null);
    }
  };

  const termLabel = (name: string) =>
    TERM_OPTIONS.find((o) => o.value === name)?.label ?? name.replace(/_/g, ' ');

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Academic', href: '/classes' }, { label: 'Terms' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Term Management</h1>
          <p className="text-sm text-slate-500">
            {academicYear
              ? `Academic Year: ${academicYear}`
              : 'No academic year set — ask IT Admin to configure it in School Settings'}
          </p>
        </div>
        {availableTermOptions.length > 0 && academicYear && (
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Add Term'}
          </Button>
        )}
      </div>

      {!academicYear && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Academic year is not set. IT Admin must configure it in School Settings before terms can be created.
        </div>
      )}

      {/* Create Form */}
      {showForm && academicYear && (
        <Card className="p-5 border-primary-200 bg-primary-50/30">
          <h2 className="text-base font-semibold text-slate-900 mb-4">New Term</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Term *</label>
              <select
                value={form.term_name}
                onChange={(e) => setForm({ ...form, term_name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              >
                <option value="">Select term</option>
                {availableTermOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Start Date *"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End Date *"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={!form.term_name || !form.start_date || !form.end_date}
              onClick={handleSave}
            >
              Save Term
            </Button>
          </div>
        </Card>
      )}

      {/* Terms List */}
      {currentTerms.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No terms created yet for {academicYear || 'this year'}</p>
          <p className="mt-1 text-xs text-slate-400">
            Create First Term, Second Term, and Third Term. Teachers will use these for grade entry.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {TERM_OPTIONS.map((termOpt) => {
            const term = currentTerms.find((t) => t.term_name === termOpt.value);
            if (!term) {
              return (
                <div key={termOpt.value} className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-400">{termOpt.label}</p>
                    <p className="text-xs text-slate-300">Not created yet</p>
                  </div>
                  <Badge variant="default" size="sm">Pending</Badge>
                </div>
              );
            }
            const start = new Date(term.start_date);
            const end = new Date(term.end_date);
            const now = new Date();
            const isActive = now >= start && now <= end;
            const isPast = now > end;
            return (
              <div key={term.id} className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${isActive ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <Calendar className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{termLabel(term.term_name)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {start.toLocaleDateString()} — {end.toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={isActive ? 'success' : isPast ? 'default' : 'info'} size="sm">
                  {isActive ? 'Active' : isPast ? 'Completed' : 'Upcoming'}
                </Badge>
                <button
                  onClick={() => handleDelete(term.id, termLabel(term.term_name))}
                  disabled={deleting === term.id}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete term"
                >
                  {deleting === term.id
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      {currentTerms.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          <strong>How terms work:</strong> Teachers see only these terms when entering grades. The active term (today falls between start and end date) is highlighted. Create all three terms at the start of the academic year.
        </div>
      )}
    </div>
  );
}
