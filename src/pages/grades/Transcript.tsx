import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { itAdminSiteService } from '@/services/itAdminService';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Printer, FileText, Search, User } from 'lucide-react';
import type { Grade } from '@/types/grade.types';
import type { School } from '@/types/school.types';
import { ACADEMIC_YEAR_TERMS } from '@/utils/constants';

// ── Term labels ────────────────────────────────────────────────────────────────
const TERM_LABELS: Record<string, string> = {
  [ACADEMIC_YEAR_TERMS.FIRST_SEMESTER]:  'First Term',
  [ACADEMIC_YEAR_TERMS.SECOND_SEMESTER]: 'Second Term',
  [ACADEMIC_YEAR_TERMS.THIRD_TERM]:      'Third Term',
};

const TERM_OPTIONS = Object.entries(TERM_LABELS).map(([value, label]) => ({ value, label }));

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtDob(iso: string | null): { month: string; date: string; year: string } {
  if (!iso) return { month: '—', date: '—', year: '—' };
  const d = new Date(iso);
  return {
    month: d.toLocaleString('en-US', { month: 'long' }),
    date:  String(d.getDate()),
    year:  String(d.getFullYear()),
  };
}

type ScopeType = 'full' | 'year' | 'term';

interface TranscriptColumn {
  key: string;          // grade_level or academic_year
  label: string;        // display label, e.g. "GRADE 10"
  academicYear: string;
}

interface TranscriptRow {
  subjectName: string;
  sortOrder: number;
  scores: Record<string, number | null>; // column.key → avg score
}

// ── Build printable data from raw grades ───────────────────────────────────────

function buildTranscript(
  grades: Grade[],
  subjects: { id: string; name: string }[],
  yearLevelMap: Record<string, string | null>,
  scope: ScopeType,
  filterYear: string,
  filterTerm: string,
): { columns: TranscriptColumn[]; rows: TranscriptRow[]; totals: Record<string, { aggregate: number; count: number }> } {
  // Filter grades by scope
  let filtered = grades;
  if (scope === 'year' && filterYear) {
    filtered = grades.filter((g) => g.academic_year === filterYear);
  } else if (scope === 'term' && filterYear && filterTerm) {
    filtered = grades.filter((g) => g.academic_year === filterYear && g.semester === filterTerm);
  }

  // Determine columns (grade levels or academic years, de-duped and sorted)
  const colMap = new Map<string, TranscriptColumn>();
  for (const g of filtered) {
    const gradeLevel = yearLevelMap[g.academic_year];
    const colKey = gradeLevel ?? g.academic_year;
    if (!colMap.has(colKey)) {
      const termSuffix = scope === 'term' && filterTerm ? ` (${TERM_LABELS[filterTerm] ?? filterTerm})` : '';
      colMap.set(colKey, {
        key:          colKey,
        label:        `${gradeLevel ?? g.academic_year}${termSuffix}`.toUpperCase(),
        academicYear: g.academic_year,
      });
    }
  }

  // Sort columns numerically by grade level number, falling back to alphabetic
  const columns: TranscriptColumn[] = Array.from(colMap.values()).sort((a, b) => {
    const na = parseInt(a.key.replace(/\D/g, ''), 10);
    const nb = parseInt(b.key.replace(/\D/g, ''), 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.key.localeCompare(b.key);
  });

  // For each subject × column: collect scores then average them
  // scoreAccum[colKey][subjectId] = { sum, count }
  const scoreAccum: Record<string, Record<string, { sum: number; count: number }>> = {};
  for (const g of filtered) {
    const colKey = (yearLevelMap[g.academic_year] ?? g.academic_year);
    if (!scoreAccum[colKey]) scoreAccum[colKey] = {};
    if (!scoreAccum[colKey][g.subject_id]) scoreAccum[colKey][g.subject_id] = { sum: 0, count: 0 };
    if (g.score != null) {
      scoreAccum[colKey][g.subject_id].sum   += g.score;
      scoreAccum[colKey][g.subject_id].count += 1;
    }
  }

  // Build rows — only subjects that appear at least once in filtered grades
  const subjectIdsInData = new Set(filtered.map((g) => g.subject_id));
  const relevantSubjects = subjects
    .filter((s) => subjectIdsInData.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows: TranscriptRow[] = relevantSubjects.map((s) => {
    const scores: Record<string, number | null> = {};
    for (const col of columns) {
      const acc = scoreAccum[col.key]?.[s.id];
      scores[col.key] = acc && acc.count > 0 ? Math.round(acc.sum / acc.count) : null;
    }
    return { subjectName: s.name, sortOrder: 0, scores };
  });

  // Totals per column
  const totals: Record<string, { aggregate: number; count: number }> = {};
  for (const col of columns) {
    let agg = 0;
    let cnt = 0;
    for (const row of rows) {
      const s = row.scores[col.key];
      if (s != null) { agg += s; cnt++; }
    }
    totals[col.key] = { aggregate: agg, count: cnt };
  }

  return { columns, rows, totals };
}

// ── Print Document Component ───────────────────────────────────────────────────

interface PrintDocProps {
  student: {
    id: string; first_name: string; last_name: string;
    registration_number: string | null; date_of_birth: string | null;
    gender: string | null; enrollment_date: string | null; status: string;
  };
  school: School;
  columns: TranscriptColumn[];
  rows: TranscriptRow[];
  totals: Record<string, { aggregate: number; count: number }>;
  dateGenerated: string;
  scope: ScopeType;
}

function PrintDocument({ student, school, columns, rows, totals, dateGenerated }: PrintDocProps) {
  const dob = fmtDob(student.date_of_birth);
  const age = calcAge(student.date_of_birth);

  return (
    <div
      id="transcript-print"
      className="bg-white font-serif text-sm"
      style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}
    >
      {/* ── Header ── */}
      <div className="border-2 border-slate-800 mb-0">
        {/* School header */}
        <div className="bg-red-700 text-white text-center py-2 px-4">
          {school.motto && (
            <p className="text-xs uppercase tracking-widest opacity-80">{school.motto}</p>
          )}
          <h1 className="text-xl font-bold uppercase tracking-wide">{school.name}</h1>
          {school.address && (
            <p className="text-xs mt-0.5">{school.address}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-xs mt-0.5 flex-wrap">
            {school.phone && <span>{school.phone}</span>}
            {school.principal_email && <span>{school.principal_email}</span>}
          </div>
        </div>

        {/* "Office of the Registrar" + title */}
        <div className="border-t border-slate-300 bg-slate-50 px-6 py-2">
          <p className="italic text-slate-600 text-xs">Office of the Registrar</p>
        </div>
        <div className="text-center bg-white py-2 border-t border-slate-200">
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
            Official Transcript
          </h2>
        </div>

        {/* Date */}
        <div className="flex justify-end px-6 py-1 border-t border-slate-200">
          <span className="text-xs text-slate-600">Date: {dateGenerated}</span>
        </div>

        {/* Student info block */}
        <div className="border-t border-slate-300 px-6 py-3 space-y-2 bg-white">
          {/* Name row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-base font-semibold text-slate-900">{student.last_name}</p>
              <p className="text-xs uppercase text-slate-500 tracking-wider">Last Name</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-base font-semibold text-slate-900">{student.first_name}</p>
              <p className="text-xs uppercase text-slate-500 tracking-wider">First Name</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-base text-slate-400 italic">—</p>
              <p className="text-xs uppercase text-slate-500 tracking-wider">Middle Name</p>
            </div>
          </div>

          {/* DOB row */}
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-2 border-b border-slate-400 pb-0.5">
              <p className="text-sm font-medium text-slate-900">{dob.month}</p>
              <p className="text-xs uppercase text-slate-500">Month</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-sm font-medium text-slate-900">{dob.date}</p>
              <p className="text-xs uppercase text-slate-500">Date</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-sm font-medium text-slate-900">{dob.year}</p>
              <p className="text-xs uppercase text-slate-500">Year</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-sm font-medium text-slate-900">
                {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'}
              </p>
              <p className="text-xs uppercase text-slate-500">Sex</p>
            </div>
            <div className="border-b border-slate-400 pb-0.5">
              <p className="text-sm font-medium text-slate-900">{age ?? '—'}</p>
              <p className="text-xs uppercase text-slate-500">Age</p>
            </div>
          </div>

          {/* Entry / Leaving */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500 shrink-0">Date of Entry:</span>
              <span className="border-b border-slate-400 flex-1 text-sm">{fmtDate(student.enrollment_date)}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500 shrink-0">Date of Leaving:</span>
              <span className="border-b border-slate-400 flex-1 text-sm">
                {student.status === 'graduated' || student.status === 'withdrawn' ? '—' : 'Present'}
              </span>
            </div>
          </div>

          {/* Reason / Class */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500 shrink-0">Reason for Leaving:</span>
            <span className="border-b border-slate-400 flex-1 text-sm">
              {student.status === 'graduated' ? 'Prospective Graduate' : student.status === 'withdrawn' ? 'Withdrawn' : '—'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-500 shrink-0">Class:</span>
              <span className="border-b border-slate-400 flex-1 text-sm"> </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-500 shrink-0">Promoted To:</span>
              <span className="border-b border-slate-400 flex-1 text-sm"> </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-500 shrink-0">Retained In:</span>
              <span className="border-b border-slate-400 flex-1 text-sm"> </span>
            </div>
          </div>
        </div>

        {/* ── Grade Table ── */}
        <table className="w-full border-collapse border-t-2 border-slate-700 text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold text-slate-900 w-48">
                SUBJECTS
              </th>
              {columns.map((col) => (
                <th key={col.key} className="border border-slate-400 px-2 py-1.5 text-center font-bold text-slate-900">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="border border-slate-300 px-2 py-4 text-center text-slate-400 italic">
                  No grades recorded for the selected scope.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={row.subjectName} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 px-2 py-1 text-slate-800">{row.subjectName}</td>
                    {columns.map((col) => (
                      <td key={col.key} className="border border-slate-300 px-2 py-1 text-center text-slate-900">
                        {row.scores[col.key] != null ? row.scores[col.key] : ''}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Total Score */}
                <tr className="bg-slate-200 font-semibold">
                  <td className="border border-slate-400 px-2 py-1.5 text-slate-900">Total Score (Aggregate)</td>
                  {columns.map((col) => (
                    <td key={col.key} className="border border-slate-400 px-2 py-1.5 text-center text-slate-900">
                      {totals[col.key]?.aggregate ?? 0}
                    </td>
                  ))}
                </tr>

                {/* Average */}
                <tr className="bg-slate-200 font-semibold">
                  <td className="border border-slate-400 px-2 py-1.5 text-slate-900">Average / Division</td>
                  {columns.map((col) => {
                    const t = totals[col.key];
                    const avg = t && t.count > 0 ? (t.aggregate / t.count).toFixed(1) : '—';
                    return (
                      <td key={col.key} className="border border-slate-400 px-2 py-1.5 text-center text-slate-900">
                        {avg}%
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* ── Signatures ── */}
        <div className="grid grid-cols-2 gap-12 px-10 pt-6 pb-4 border-t border-slate-300 bg-white">
          <div className="text-center">
            <div className="border-b border-slate-700 mb-1 h-8" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Registrar</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-700 mb-1 h-8" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Principal</p>
          </div>
        </div>

        {/* Motto footer */}
        {school.motto && (
          <div className="text-center py-2 border-t border-slate-200 bg-slate-50">
            <p className="text-xs italic text-slate-600">
              MOTTO: {school.motto}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TranscriptPage() {
  const { user } = useAuth();
  const schoolId  = user?.school_id ?? '';
  const userId    = user?.id ?? '';

  const [search, setSearch]         = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [scope, setScope]           = useState<ScopeType>('full');
  const [filterYear, setFilterYear] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  // School details (for letterhead)
  const { data: school } = useFetch(
    ['school-info', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  // Student list
  const { data: students, isLoading: studentsLoading } = useFetch(
    ['students-search', schoolId, search],
    () => gradeService.searchStudents(schoolId, search),
    { enabled: !!schoolId },
  );

  // Selected student's details
  const selectedStudent = students?.find((s) => s.id === selectedId) ?? null;

  // All grades for selected student
  const { data: gradesResult, isLoading: gradesLoading } = useFetch(
    ['student-grades-all', selectedId],
    () => gradeService.list(schoolId, { studentId: selectedId, pageSize: 500 }),
    { enabled: !!selectedId },
  );

  // Grade level per academic year
  const { data: academicYears } = useFetch(
    ['student-academic-years', selectedId],
    () => gradeService.getStudentAcademicYears(selectedId),
    { enabled: !!selectedId },
  );

  // Subjects
  const { data: subjects } = useFetch(
    ['subjects', schoolId],
    () => gradeService.getSubjects(schoolId),
    { enabled: !!schoolId },
  );

  const grades = (gradesResult?.data ?? []) as unknown as Grade[];
  const yearLevelMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const y of academicYears ?? []) map[y.academic_year] = y.grade_level;
    return map;
  }, [academicYears]);

  // Available academic years for the dropdowns (derived from grades)
  const availableYears = useMemo(() => {
    const years = [...new Set(grades.map((g) => g.academic_year))].sort();
    return years.map((y) => ({ value: y, label: y }));
  }, [grades]);

  // Build transcript table data
  const { columns, rows, totals } = useMemo(() => {
    if (!grades.length || !subjects?.length) return { columns: [], rows: [], totals: {} };
    return buildTranscript(grades, subjects, yearLevelMap, scope, filterYear, filterTerm);
  }, [grades, subjects, yearLevelMap, scope, filterYear, filterTerm]);

  // Log / save transcript generation
  const saveMutation = useMutate(
    () =>
      gradeService.generateTranscript({
        student_id:      selectedId,
        academic_record: { scope, filterYear, filterTerm, columns, totals },
        overall_gpa:     0,
        generated_by:    userId,
      }),
    [],
    {
      onSuccess: () => {
        notify.success('Transcript logged');
        window.print();
      },
    },
  );

  const handlePrint = () => {
    if (!selectedStudent) return;
    saveMutation.mutate(undefined);
  };

  return (
    <>
      {/* ── Print CSS injected inline ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #transcript-print, #transcript-print * { visibility: visible; }
          #transcript-print {
            position: fixed; top: 0; left: 0;
            width: 100%; padding: 16px;
            font-size: 11px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-5">
        {/* Screen-only UI */}
        <div className="no-print">
          <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Transcript' }]} />

          <div className="flex items-center justify-between mt-4">
            <h1 className="text-xl font-bold text-slate-900">Official Transcript</h1>
            {selectedStudent && (
              <Button onClick={handlePrint} loading={saveMutation.isPending}>
                <Printer className="h-4 w-4 mr-1.5" />
                Print Transcript
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* ── Student search panel ── */}
            <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or reg. number…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                {studentsLoading ? (
                  <LoadingSpinner label="Loading…" fullPage={false} />
                ) : !students?.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No students found.</p>
                ) : (
                  students.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedId === s.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.last_name}, {s.first_name}</p>
                        <p className="text-xs text-slate-400">{s.registration_number ?? 'No reg. number'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ── Scope controls + preview ── */}
            <div className="lg:col-span-2 space-y-4">
              {selectedStudent ? (
                <>
                  {/* Scope selector */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Transcript Scope</p>
                    <div className="flex flex-wrap gap-3">
                      {(['full', 'year', 'term'] as ScopeType[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setScope(s)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium border transition-all ${
                            scope === s
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-slate-200 text-slate-600 hover:border-primary-300'
                          }`}
                        >
                          {s === 'full' ? 'Full Transcript' : s === 'year' ? 'Single Year' : 'Single Term'}
                        </button>
                      ))}
                    </div>

                    {(scope === 'year' || scope === 'term') && (
                      <div className="mt-3 flex gap-3">
                        <div className="w-48">
                          <Select
                            label="Academic Year"
                            options={[{ value: '', label: 'All years' }, ...availableYears]}
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                          />
                        </div>
                        {scope === 'term' && (
                          <div className="w-48">
                            <Select
                              label="Term"
                              options={[{ value: '', label: 'Select term' }, ...TERM_OPTIONS]}
                              value={filterTerm}
                              onChange={(e) => setFilterTerm(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Transcript preview */}
                  {gradesLoading ? (
                    <LoadingSpinner label="Loading grades…" fullPage={false} />
                  ) : !school ? (
                    <LoadingSpinner label="Loading school info…" fullPage={false} />
                  ) : (
                    <div className="overflow-auto border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <PrintDocument
                        student={selectedStudent}
                        school={school}
                        columns={columns}
                        rows={rows}
                        totals={totals}
                        dateGenerated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        scope={scope}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white h-64">
                  <FileText className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400">Select a student to generate their transcript.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Print-only document (also shown in preview above via PrintDocument) ── */}
        {/* The PrintDocument inside the preview is already visible on screen.
            When printing, the browser uses #transcript-print visibility. */}
      </div>
    </>
  );
}
