import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { academicCalendarService } from '@/services/classService';
import type { AcademicCalendar } from '@/types/school.types';
import { GRADE_SCALE } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { FileText, Printer, Search, User } from 'lucide-react';

// Map academic_calendar.term_name → grades.semester stored value
// TermManagement creates terms as first_term/second_term/third_term
// Grades table stores first_semester/second_semester/third_term (from ACADEMIC_YEAR_TERMS)
const CALENDAR_TERM_TO_SEMESTER: Record<string, string> = {
  first_term:    'first_semester',
  second_term:   'second_semester',
  third_term:    'third_term',
};

const SEMESTER_LABEL: Record<string, string> = {
  first_semester:  'First Term',
  second_semester: 'Second Term',
  third_term:      'Third Term',
};

// Static fallback term options (Liberian: 3 terms per year)
const FALLBACK_TERM_OPTIONS = [
  { label: 'First Term',  value: 'first_semester' },
  { label: 'Second Term', value: 'second_semester' },
  { label: 'Third Term',  value: 'third_term' },
];

function gradeBadgeVariant(letter: string) {
  if (letter === 'A') return 'success' as const;
  if (letter === 'B') return 'info' as const;
  if (letter === 'C') return 'default' as const;
  if (letter === 'D') return 'warning' as const;
  return 'danger' as const;
}

export default function ReportCards() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId   = user?.id ?? '';

  const [studentSearch,    setStudentSearch]    = useState('');
  const [debouncedSearch,  setDebouncedSearch]  = useState('');
  const [selectedStudentId,   setSelectedStudentId]   = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [semester,     setSemester]     = useState('');

  // Debounce student search input (350 ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(studentSearch), 350);
    return () => clearTimeout(t);
  }, [studentSearch]);

  // ── Load current academic year from school settings ──────────────────────────
  const { data: settingYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  useEffect(() => {
    if (settingYear && !academicYear) {
      setAcademicYear(settingYear as string);
    }
  }, [settingYear, academicYear]);

  // ── Load academic calendar to auto-detect the current active term ─────────────
  const { data: calendarTerms = [] } = useFetch(
    ['academic-calendar', schoolId],
    () => academicCalendarService.list(schoolId),
    { enabled: !!schoolId },
  );

  useEffect(() => {
    if (!semester && academicYear && calendarTerms.length > 0) {
      const today  = new Date().toISOString().slice(0, 10);
      const active = (calendarTerms as AcademicCalendar[]).find(
        (t) =>
          t.academic_year === academicYear &&
          t.start_date <= today &&
          t.end_date >= today,
      );
      if (active) {
        // Map calendar term_name → grades semester value
        setSemester(CALENDAR_TERM_TO_SEMESTER[active.term_name] ?? active.term_name);
      }
    }
  }, [calendarTerms, academicYear, semester]);

  // Build term options from calendar for selected year; fall back to static list
  const calendarOptions = (calendarTerms as AcademicCalendar[])
    .filter((t) => t.academic_year === academicYear)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((t) => ({
      label: SEMESTER_LABEL[CALENDAR_TERM_TO_SEMESTER[t.term_name] ?? t.term_name] ?? t.term_name,
      value: CALENDAR_TERM_TO_SEMESTER[t.term_name] ?? t.term_name,
    }));

  const semesterOptions = calendarOptions.length > 0 ? calendarOptions : FALLBACK_TERM_OPTIONS;

  // ── Search ALL enrolled students (not just those with grades) ─────────────────
  const { data: students = [], isLoading: studentsLoading } = useFetch(
    ['students-search', schoolId, debouncedSearch],
    () => gradeService.searchStudents(schoolId, debouncedSearch),
    { enabled: !!schoolId },
  );

  // ── Load term grades for selected student ─────────────────────────────────────
  const { data: termGrades, isLoading: gradesLoading } = useFetch(
    ['student-term-grades', selectedStudentId, academicYear, semester],
    () => gradeService.getStudentTermGrades(selectedStudentId, academicYear, semester),
    { enabled: !!selectedStudentId && !!academicYear && !!semester },
  );

  // ── Generate report card record ───────────────────────────────────────────────
  const generateMutation = useMutate(
    () => gradeService.generateReportCard({
      student_id:    selectedStudentId,
      academic_year: academicYear,
      semester,
      generated_by:  userId,
    }),
    [['report-cards']],
    { onSuccess: () => notify.success('Report card generated') },
  );

  // Totals
  const avgScore = termGrades && termGrades.length > 0
    ? termGrades.reduce((s, g) => s + (g.score ?? 0), 0) / termGrades.length
    : 0;
  const avgGpa = termGrades && termGrades.length > 0
    ? termGrades.reduce((s, g) => s + (g.gpa_points ?? 0), 0) / termGrades.length
    : 0;
  const avgLetter =
    Object.entries(GRADE_SCALE).find(([, r]) => avgScore >= r.min && avgScore <= r.max)?.[0] ?? 'F';

  const termLabel = SEMESTER_LABEL[semester] ?? semester;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Report Cards' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Report Cards</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <Input
            label="Search Student"
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value);
              setSelectedStudentId('');
              setSelectedStudentName('');
            }}
            placeholder="Name or registration number..."
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => { setAcademicYear(e.target.value); setSemester(''); }}
            placeholder="e.g. 2025-2026"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <Select
          label="Term"
          options={semesterOptions}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder="Select term"
          className="w-44"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Left: Student list */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto p-0">
            {studentsLoading ? (
              <LoadingSpinner label="Searching..." fullPage={false} />
            ) : students.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {debouncedSearch ? 'No students found.' : 'Type a name or registration number to search.'}
              </p>
            ) : (
              <ul className="divide-y">
                {students.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setSelectedStudentName(`${s.first_name} ${s.last_name}`);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedStudentId === s.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{s.registration_number ?? '—'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right: Report card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedStudentId
                  ? `${selectedStudentName} — ${termLabel || 'Select Term'}`
                  : 'Select a Student'}
              </CardTitle>
              {selectedStudentId && semester && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1" /> Print
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => generateMutation.mutate(undefined)}
                    loading={generateMutation.isPending}
                  >
                    <FileText className="h-4 w-4 mr-1" /> Generate
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedStudentId || !semester ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-400">Select a student and term to view their report card.</p>
              </div>
            ) : gradesLoading ? (
              <LoadingSpinner label="Loading grades..." fullPage={false} />
            ) : !termGrades || termGrades.length === 0 ? (
              <div className="py-12 text-center">
                <User className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700">{selectedStudentName}</p>
                <p className="text-sm text-slate-400 mt-1">
                  No grades recorded for {termLabel}, {academicYear}.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Teachers enter grades via the Grade Entry page.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Student info row */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-slate-700">{selectedStudentName}</span>
                  <span>·</span>
                  <span>{academicYear}</span>
                  <span>·</span>
                  <span>{termLabel}</span>
                </div>

                {/* Grade table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Subject</th>
                        <th className="pb-2 pr-4 font-medium text-center">Score</th>
                        <th className="pb-2 pr-4 font-medium text-center">Grade</th>
                        <th className="pb-2 font-medium text-center">GPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termGrades.map((g) => (
                        <tr key={g.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <p className="font-medium text-slate-900">{g.subjects.name}</p>
                            {g.subjects.code && (
                              <p className="text-xs text-slate-400">{g.subjects.code}</p>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-center font-medium">{g.score}</td>
                          <td className="py-2 pr-4 text-center">
                            <Badge variant={gradeBadgeVariant(g.letter_grade)} size="sm">
                              {g.letter_grade}
                            </Badge>
                          </td>
                          <td className="py-2 text-center text-slate-600">{g.gpa_points}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-medium">
                        <td className="pt-3 pr-4 text-slate-900">Average</td>
                        <td className="pt-3 pr-4 text-center">{avgScore.toFixed(1)}</td>
                        <td className="pt-3 pr-4 text-center">
                          <Badge variant={gradeBadgeVariant(avgLetter)} size="sm">
                            {avgLetter}
                          </Badge>
                        </td>
                        <td className="pt-3 text-center">{avgGpa.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Grade scale legend */}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Grade Scale</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {Object.entries(GRADE_SCALE).map(([letter, info]) => (
                      <span key={letter} className="text-slate-500">
                        <span className="font-semibold text-slate-700">{letter}</span>{' '}
                        = {info.min}–{info.max} ({info.description})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
