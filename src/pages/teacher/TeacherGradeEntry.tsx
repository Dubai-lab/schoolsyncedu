import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { academicCalendarService } from '@/services/classService';
import type { AcademicCalendar } from '@/types/school.types';
import { GRADE_SCALE, MARKING_PERIOD_LABELS } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Save, BookOpen, SendHorizontal, Info } from 'lucide-react';

// ── Period structure ───────────────────────────────────────────────────
// P1/P2/P4/P5 (regular):      Assignment/20 + Quiz/20 + Test/50 + Attendance/10 = 100
// P3/P6 (Semester Exam):      Exam/100 only
const EXAM_PERIODS = new Set(['p3', 'p6']);

const COMPONENT_MAX = {
  assignment: 20,
  quiz:       20,
  test:       50,
  attendance: 10,
  exam:       100,
} as const;

type ComponentKey = keyof typeof COMPONENT_MAX;

function maxTotal(_period: string) { return 100; }
// 'attendance' is NOT in this list — it's auto-computed and shown in its own read-only column
function activeComponents(period: string): ComponentKey[] {
  return EXAM_PERIODS.has(period)
    ? ['exam']
    : ['assignment', 'quiz', 'test'];
}

// ── Types ──────────────────────────────────────────────────────────────

interface StudentGradeRow {
  studentId:       string;
  firstName:       string;
  lastName:        string;
  idNumber:        string | null;
  assignmentScore: string;
  quizScore:       string;
  testScore:       string;
  examScore:       string;
  // attendanceScore is computed from attendance records — not editable
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeTotal(row: StudentGradeRow, period: string, attendanceScore: number | null): number | null {
  if (EXAM_PERIODS.has(period)) {
    if (row.examScore === '') return null;
    return Number(row.examScore);
  }
  const a = row.assignmentScore !== '' ? Number(row.assignmentScore) : null;
  const q = row.quizScore       !== '' ? Number(row.quizScore)       : null;
  const t = row.testScore       !== '' ? Number(row.testScore)       : null;
  if ([a, q, t].every((v) => v === null)) return null;
  return (a ?? 0) + (q ?? 0) + (t ?? 0) + (attendanceScore ?? 0);
}

// Letter grade is based on percentage of period max
function letterFromScore(score: number, period: string): string {
  const pct = (score / maxTotal(period)) * 100;
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (pct >= range.min && pct <= range.max) return letter;
  }
  return 'F';
}

function scoreColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-600 font-bold';
  if (pct >= 80) return 'text-blue-600 font-bold';
  if (pct >= 70) return 'text-amber-600 font-bold';
  if (pct >= 50) return 'text-orange-500 font-semibold';
  return 'text-red-600 font-bold';
}

function clampedInput(value: string, max: number): string {
  if (value === '') return '';
  const n = Number(value);
  if (isNaN(n) || n < 0) return '';
  if (n > max) return String(max);
  return value;
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function TeacherGradeEntry() {
  const { user } = useAuth();
  const location = useLocation();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const [selectedClass,    setSelectedClass]    = useState((location.state as { classId?: string })?.classId ?? '');
  const [selectedSubject,  setSelectedSubject]  = useState('');
  const [academicYear,     setAcademicYear]     = useState('');
  const [semester,         setSemester]         = useState('');
  const [rows,             setRows]             = useState<StudentGradeRow[]>([]);
  const [savedGradeIds,    setSavedGradeIds]    = useState<string[]>([]);
  // Computed attendance scores: studentId → score /10 (null = no records)
  const [attendanceScores, setAttendanceScores] = useState<Record<string, number | null>>({});

  // Fetch school's current academic year
  const { data: schoolYear } = useFetch(
    ['school-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  useEffect(() => {
    if (schoolYear && !academicYear) setAcademicYear(schoolYear as string);
  }, [schoolYear, academicYear]);

  // Marking periods for this academic year (p1–p6 only)
  const { data: dbPeriods = [] } = useFetch(
    ['academic-calendar-periods', schoolId, academicYear],
    () => academicCalendarService.listPeriods(schoolId, academicYear),
    { enabled: !!schoolId && !!academicYear },
  );

  const periods = (dbPeriods as unknown as AcademicCalendar[])
    .sort((a, b) => (a.period_number ?? 0) - (b.period_number ?? 0));

  const termOptions = periods.map((t) => ({
    label: MARKING_PERIOD_LABELS[t.term_name] ?? t.term_name.toUpperCase(),
    value: t.term_name,
  }));

  // Dates for the currently selected period (needed to fetch attendance)
  const activePeriod = periods.find((p) => p.term_name === semester);
  const periodDateFrom = activePeriod?.start_date ?? null;
  const periodDateTo   = activePeriod?.end_date   ?? null;

  // Auto-fetch attendance scores for this class + subject + period (regular periods only)
  const { data: fetchedAttendance } = useFetch(
    ['attendance-scores', selectedClass, selectedSubject, periodDateFrom, periodDateTo],
    () => gradeService.getClassAttendanceScores(selectedClass, selectedSubject, periodDateFrom!, periodDateTo!),
    { enabled: !!selectedClass && !!selectedSubject && !!periodDateFrom && !!periodDateTo && !EXAM_PERIODS.has(semester) },
  );

  useEffect(() => {
    if (fetchedAttendance) {
      setAttendanceScores(fetchedAttendance as Record<string, number | null>);
    } else if (EXAM_PERIODS.has(semester)) {
      setAttendanceScores({});
    }
  }, [fetchedAttendance, semester]);

  const { data: myClasses } = useFetch(
    ['teacher-classes', schoolId, teacherId],
    () => teacherService.getMyClasses(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const { data: mySubjects } = useFetch(
    ['teacher-subjects', schoolId, teacherId],
    () => teacherService.getMySubjects(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const { data: classStudents, isLoading: studentsLoading } = useFetch(
    ['class-students', selectedClass],
    () => gradeService.getClassStudents(selectedClass),
    { enabled: !!selectedClass },
  );

  const { data: existingGrades } = useFetch(
    ['class-grades', selectedClass, selectedSubject, academicYear, semester],
    () => gradeService.getClassGrades(selectedClass, selectedSubject, academicYear, semester),
    { enabled: !!selectedClass && !!selectedSubject && !!academicYear && !!semester },
  );

  const classSubjectOptions = (mySubjects ?? [])
    .filter((s) => s.class_id === selectedClass)
    .map((s) => ({ label: s.subject_name, value: s.subject_id }));

  const classOptions = (myClasses ?? []).map((c) => ({
    label: `${c.name} — ${c.grade_level || ''}${c.section ? ` (${c.section})` : ''}`,
    value: c.id,
  }));

  // Build rows from students
  useEffect(() => {
    if (!classStudents) return;
    const studentRows: StudentGradeRow[] = classStudents.map((a) => ({
      studentId:       a.students.id,
      firstName:       a.students.first_name,
      lastName:        a.students.last_name,
      idNumber:        (a.students as Record<string, unknown>).registration_number as string | null,
      assignmentScore: '',
      quizScore:       '',
      testScore:       '',
      examScore:       '',
    }));
    studentRows.sort((a, b) => a.lastName.localeCompare(b.lastName));
    setRows(studentRows);
    setSavedGradeIds([]);
  }, [classStudents]);

  // Clear all scores when period changes so P1 grades don't bleed into P2/P3
  useEffect(() => {
    setRows((prev) => prev.map((r) => ({
      ...r,
      assignmentScore: '',
      quizScore:       '',
      testScore:       '',
      examScore:       '',
    })));
    setSavedGradeIds([]);
  }, [semester]);

  // Pre-fill existing grades (component scores)
  useEffect(() => {
    if (!existingGrades || existingGrades.length === 0 || rows.length === 0) return;
    type GradeRow = {
      student_id: string;
      assignment_score: number | null;
      quiz_score: number | null;
      test_score: number | null;
      exam_score: number | null;
      attendance_score: number | null;
    };
    const gradeMap = new Map(
      (existingGrades as GradeRow[]).map((g) => [g.student_id, g]),
    );
    setRows((prev) =>
      prev.map((r) => {
        const g = gradeMap.get(r.studentId);
        if (!g) return r;
        const str = (v: number | null | undefined) => (v !== null && v !== undefined ? String(v) : '');
        return {
          ...r,
          assignmentScore: str(g.assignment_score),
          quizScore:       str(g.quiz_score),
          testScore:       str(g.test_score),
          examScore:       str(g.exam_score),
        };
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingGrades]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleComponentChange = useCallback(
    (studentId: string, component: ComponentKey, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.studentId !== studentId) return r;
          const key = `${component}Score` as
            | 'assignmentScore'
            | 'quizScore'
            | 'testScore'
            | 'examScore';
          return { ...r, [key]: value };
        }),
      );
    },
    [],
  );

  // ── Save / Submit ──────────────────────────────────────────────────────

  const saveMutation = useMutate(
    async () => {
      const grades = rows
        .filter((r) => computeTotal(r, semester, attendanceScores[r.studentId] ?? null) !== null)
        .map((r) => ({
          studentId:       r.studentId,
          assignmentScore: r.assignmentScore !== '' ? Number(r.assignmentScore) : null,
          quizScore:       r.quizScore       !== '' ? Number(r.quizScore)       : null,
          testScore:       r.testScore       !== '' ? Number(r.testScore)       : null,
          examScore:       r.examScore       !== '' ? Number(r.examScore)       : null,
          attendanceScore: attendanceScores[r.studentId] ?? null,
        }));
      if (grades.length === 0) throw new Error('No grades to save');
      return gradeService.bulkUpsertGrades(
        schoolId, selectedClass, selectedSubject,
        academicYear, semester, grades, teacherId,
      );
    },
    [['grades']],
    {
      onSuccess: (data) => {
        notify.success(`Saved ${(data as { id: string }[]).length} grades as draft`);
        setSavedGradeIds((data as { id: string }[]).map((g) => g.id));
      },
    },
  );

  const submitMutation = useMutate(
    async () => {
      if (savedGradeIds.length === 0) throw new Error('Save grades first');
      return gradeService.submitGradesForApproval(savedGradeIds);
    },
    [['grades']],
    {
      onSuccess: () => {
        notify.success('Grades submitted for principal approval');
        setSavedGradeIds([]);
      },
    },
  );

  // ── Stats ──────────────────────────────────────────────────────────────

  const isExamPeriod = EXAM_PERIODS.has(semester);
  const periodMax    = maxTotal(semester);
  const components   = activeComponents(semester);

  const filledRows = rows.filter((r) => computeTotal(r, semester, attendanceScores[r.studentId] ?? null) !== null);
  const totals     = filledRows.map((r) => computeTotal(r, semester, attendanceScores[r.studentId] ?? null)!);
  const avgRaw     = totals.length > 0 ? totals.reduce((s, n) => s + n, 0) / totals.length : 0;
  const avgPct     = periodMax > 0 ? (avgRaw / periodMax) * 100 : 0;
  const canSave    = !!(selectedClass && selectedSubject && academicYear && semester && filledRows.length > 0);

  const ready = selectedClass && selectedSubject && semester;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Teacher Portal', href: '/teacher' }, { label: 'Enter Grades' }]} />

      <h1 className="text-xl font-bold text-slate-900">Enter Grades</h1>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <Select
          label="My Class"
          options={classOptions}
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
          placeholder="Select your class"
          className="w-56"
        />
        <Select
          label="My Subject"
          options={classSubjectOptions}
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          placeholder="Select subject"
          className="w-56"
          disabled={!selectedClass}
        />
        <Select
          label="Marking Period"
          options={termOptions}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder={termOptions.length === 0 ? 'No periods set yet' : 'Select period'}
          className="w-52"
          disabled={termOptions.length === 0}
        />
      </div>

      {/* Grade breakdown info banner */}
      {ready && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {isExamPeriod
              ? <><strong>Semester Exam Period</strong> — Exam /100 only</>
              : <>Assignment /20 + Quiz /20 + Test /50 + Attendance /10 = <strong>100</strong></>
            }
          </span>
        </div>
      )}

      {!ready ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Select class, subject, and term to start entering grades.</p>
            {termOptions.length === 0 && academicYear && (
              <p className="mt-1 text-xs text-amber-500">
                No marking periods have been set up yet. Ask the Principal to configure Semesters &amp; Periods for {academicYear}.
              </p>
            )}
          </CardContent>
        </Card>
      ) : studentsLoading ? (
        <LoadingSpinner label="Loading students..." fullPage={false} />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-400">No students found in this class.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex gap-4 text-sm text-slate-500">
            <span>{rows.length} students</span>
            <span>{filledRows.length} graded</span>
            {filledRows.length > 0 && (
              <span>
                Class avg:{' '}
                <span className={`font-semibold ${scoreColor(avgPct)}`}>
                  {avgRaw.toFixed(1)}/{periodMax}
                </span>
              </span>
            )}
          </div>

          {/* Grade entry table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Student Grades — {isExamPeriod ? 'Semester Exam Period' : 'Component Entry'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                      <th className="py-3 pl-4 pr-2 text-left font-medium w-6">#</th>
                      <th className="py-3 pr-4 text-left font-medium">Student</th>
                      {components.map((c) => (
                        <th key={c} className="py-3 px-2 text-center font-medium">
                          <div className="text-xs capitalize">{c}</div>
                          <div className="text-[10px] text-slate-400 font-normal">/{COMPONENT_MAX[c]}</div>
                        </th>
                      ))}
                      {!isExamPeriod && (
                        <th className="py-3 px-2 text-center font-medium">
                          <div className="text-xs">Attendance</div>
                          <div className="text-[10px] text-slate-400 font-normal">/10 (auto)</div>
                        </th>
                      )}
                      <th className="py-3 px-3 text-center font-medium">
                        <div className="text-xs">Total</div>
                        <div className="text-[10px] text-slate-400 font-normal">/{periodMax}</div>
                      </th>
                      <th className="py-3 px-3 text-center font-medium text-xs">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const attScore = attendanceScores[row.studentId] ?? null;
                      const total    = computeTotal(row, semester, attScore);
                      const pct      = total !== null ? (total / periodMax) * 100 : null;
                      const letter   = total !== null ? letterFromScore(total, semester) : '';
                      return (
                        <tr key={row.studentId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 pl-4 pr-2 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="py-2.5 pr-4 min-w-[140px]">
                            <p className="font-medium text-slate-900">{row.lastName}, {row.firstName}</p>
                            {row.idNumber && <p className="text-xs text-slate-400">{row.idNumber}</p>}
                          </td>

                          {components.map((c) => {
                            const scoreKey = `${c}Score` as 'assignmentScore' | 'quizScore' | 'testScore' | 'examScore';
                            return (
                              <td key={c} className="py-2.5 px-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={COMPONENT_MAX[c]}
                                  step={0.5}
                                  value={row[scoreKey]}
                                  onChange={(e) => handleComponentChange(row.studentId, c, clampedInput(e.target.value, COMPONENT_MAX[c]))}
                                  placeholder="—"
                                  className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                                />
                              </td>
                            );
                          })}

                          {!isExamPeriod && (
                            <td className="py-2.5 px-2 text-center">
                              {attScore !== null ? (
                                <span className={`text-sm font-medium ${attScore >= 8 ? 'text-emerald-600' : attScore >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {attScore % 1 === 0 ? attScore : attScore.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs" title="No attendance records for this period">—</span>
                              )}
                            </td>
                          )}

                          <td className="py-2.5 px-3 text-center">
                            {total !== null ? (
                              <span className={`text-sm ${scoreColor(pct!)}`}>
                                {total % 1 === 0 ? total : total.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {letter && (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                letter === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                letter === 'B' ? 'bg-blue-100 text-blue-700' :
                                letter === 'C' ? 'bg-slate-100 text-slate-700' :
                                letter === 'D' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {letter}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Save as draft first, then submit to the Principal for approval.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => saveMutation.mutate(undefined)}
                loading={saveMutation.isPending}
                disabled={!canSave}
                variant="outline"
              >
                <Save className="h-4 w-4 mr-1" /> Save Draft
              </Button>
              <Button
                onClick={() => {
                  if (savedGradeIds.length > 0) {
                    submitMutation.mutate(undefined);
                  } else {
                    saveMutation.mutate(undefined, {
                      onSuccess: (data) => {
                        const ids = (data as { id: string }[]).map((g) => g.id);
                        gradeService.submitGradesForApproval(ids).then(() => {
                          notify.success('Grades submitted for principal approval');
                        });
                      },
                    });
                  }
                }}
                loading={submitMutation.isPending}
                disabled={!canSave}
              >
                <SendHorizontal className="h-4 w-4 mr-1" /> Submit for Approval
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
