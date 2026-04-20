import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { academicCalendarService } from '@/services/classService';
import { registrarService } from '@/services/registrarService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import type { AcademicCalendar } from '@/types/school.types';
import { Calendar, AlertCircle, Edit2, Check, X } from 'lucide-react';
import { MARKING_PERIOD_LABELS, SEMESTER_LABELS } from '@/utils/constants';

// Fixed display order for the two-semester layout
const SEMESTER_STRUCTURE = [
  {
    semesterKey: 'semester_1',
    periods: ['p1', 'p2', 'p3'],
  },
  {
    semesterKey: 'semester_2',
    periods: ['p4', 'p5', 'p6'],
  },
] as const;

function rowStatus(row: AcademicCalendar): 'active' | 'completed' | 'upcoming' | 'no-dates' {
  if (!row.start_date || !row.end_date) return 'no-dates';
  const now = new Date();
  const start = new Date(row.start_date);
  const end = new Date(row.end_date);
  if (now >= start && now <= end) return 'active';
  if (now > end) return 'completed';
  return 'upcoming';
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EditState {
  id: string;
  start: string;
  end: string;
}

interface CalendarRowProps {
  row: AcademicCalendar;
  label: string;
  indent?: boolean;
  onSaved: () => void;
}

function CalendarRow({ row, label, indent = false, onSaved }: CalendarRowProps) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const status = rowStatus(row);

  const startEdit = () =>
    setEditing({ id: row.id, start: row.start_date ?? '', end: row.end_date ?? '' });

  const cancelEdit = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    if (editing.start && editing.end && editing.start >= editing.end) {
      notify.error('End date must be after start date');
      return;
    }
    setSaving(true);
    try {
      await academicCalendarService.updateDates(
        editing.id,
        editing.start || null,
        editing.end || null,
      );
      notify.success('Dates saved');
      setEditing(null);
      onSaved();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save dates');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = {
    active: { variant: 'success' as const, label: 'Active' },
    completed: { variant: 'default' as const, label: 'Completed' },
    upcoming: { variant: 'info' as const, label: 'Upcoming' },
    'no-dates': { variant: 'warning' as const, label: 'No Dates Set' },
  }[status];

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors
        ${indent ? 'ml-6' : ''}
        ${status === 'active'
          ? 'border-emerald-200 bg-emerald-50/50'
          : status === 'no-dates'
            ? 'border-dashed border-slate-200 bg-slate-50/40'
            : 'border-slate-200 bg-white'}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
          ${status === 'active' ? 'bg-emerald-100' : 'bg-slate-100'}`}
      >
        <Calendar className={`h-4 w-4 ${status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${status === 'active' ? 'text-emerald-800' : 'text-slate-800'}`}>
          {label}
        </p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <input
              type="date"
              value={editing.start}
              onChange={(e) => setEditing({ ...editing, start: e.target.value })}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={editing.end}
              onChange={(e) => setEditing({ ...editing, end: e.target.value })}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5">
            {row.start_date && row.end_date
              ? `${formatDate(row.start_date)} — ${formatDate(row.end_date)}`
              : 'Dates not set yet'}
          </p>
        )}
      </div>

      <Badge variant={statusBadge.variant} size="sm">{statusBadge.label}</Badge>

      {editing ? (
        <div className="flex items-center gap-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {saving
              ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={cancelEdit}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="rounded-md p-1.5 text-slate-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
          title="Edit dates"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function SemesterPeriodManagement() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const initialized = useRef(false);

  const { data: academicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const yearString = academicYear as string | undefined;

  const { data: rows = [], refetch } = useFetch(
    ['academic-calendar', schoolId, yearString ?? ''],
    () => academicCalendarService.list(schoolId),
    { enabled: !!schoolId && !!yearString },
  );

  // Auto-initialize semesters + periods when academic year is set
  useEffect(() => {
    if (!schoolId || !yearString || initialized.current) return;
    initialized.current = true;
    academicCalendarService.initializeForYear(schoolId, yearString).then(() => {
      refetch();
    }).catch(() => {
      // Silently ignore — rows likely already exist
    });
  }, [schoolId, yearString, refetch]);

  const calRows = rows as unknown as AcademicCalendar[];
  const yearRows = calRows.filter((r) => r.academic_year === yearString);
  const byTermName = Object.fromEntries(yearRows.map((r) => [r.term_name, r]));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Academic', href: '/classes' }, { label: 'Semesters & Periods' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Semesters &amp; Periods</h1>
        <p className="text-sm text-slate-500">
          {yearString
            ? `Academic Year: ${yearString}`
            : 'No academic year set — ask IT Admin to configure it in School Settings'}
        </p>
      </div>

      {!yearString && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Academic year is not set. IT Admin must configure it in School Settings before dates can be entered.
        </div>
      )}

      {yearString && SEMESTER_STRUCTURE.map(({ semesterKey, periods }) => {
        const semRow = byTermName[semesterKey];
        return (
          <Card key={semesterKey} className="p-4 space-y-3">
            {/* Semester header row */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                {SEMESTER_LABELS[semesterKey] ?? semesterKey}
              </span>
            </div>
            {semRow ? (
              <CalendarRow
                row={semRow}
                label={SEMESTER_LABELS[semesterKey] ?? semesterKey}
                onSaved={refetch}
              />
            ) : (
              <div className="ml-0 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-400">
                <Calendar className="h-4 w-4" />
                Initializing…
              </div>
            )}

            {/* Marking period rows */}
            <div className="space-y-2">
              {periods.map((p) => {
                const periodRow = byTermName[p];
                if (!periodRow) return (
                  <div key={p} className="ml-6 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-400">
                    <Calendar className="h-4 w-4" />
                    {MARKING_PERIOD_LABELS[p] ?? p} — Initializing…
                  </div>
                );
                return (
                  <CalendarRow
                    key={p}
                    row={periodRow}
                    label={MARKING_PERIOD_LABELS[p] ?? p}
                    indent
                    onSaved={refetch}
                  />
                );
              })}
            </div>
          </Card>
        );
      })}

      {yearString && yearRows.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          <strong>How this works:</strong> Set start and end dates for each semester and marking period.
          Teachers enter grades by marking period (P1–P6). Report cards show period grades and semester averages.
          The currently active period is highlighted in green.
        </div>
      )}
    </div>
  );
}
