import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { GRADE_SCALE, MARKING_PERIOD_LIST } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Save, BookOpen, Info } from 'lucide-react';

// ── Grade component maximums ───────────────────────────────────────────
const COMPONENT_MAX = {
  assignment: 20,
  quiz:       20,
  test:       20,
  exam:       40,
} as const;

type ComponentKey = keyof typeof COMPONENT_MAX;

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
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeTotal(row: StudentGradeRow): number | null {
  const a = row.assignmentScore !== '' ? Number(row.assignmentScore) : null;
  const q = row.quizScore       !== '' ? Number(row.quizScore)       : null;
  const t = row.testScore       !== '' ? Number(row.testScore)       : null;
  const e = row.examScore       !== '' ? Number(row.examScore)       : null;
  if (a === null && q === null && t === null && e === null) return null;
  return (a ?? 0) + (q ?? 0) + (t ?? 0) + (e ?? 0);
}

function letterFromScore(score: number): string {
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (score >= range.min && score <= range.max) return letter;
  }
  return 'F';
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 font-bold';
  if (score >= 80) return 'text-blue-600 font-bold';
  if (score >= 70) return 'text-amber-600 font-bold';
  if (score >= 50) return 'text-orange-500 font-semibold';
  return 'text-red-600 font-bold';
}

function clampedInput(value: string, max: number): string {
  if (value === '') return '';
  const n = Number(value);
  if (isNaN(n) || n < 0) return '';
  return n > max ? String(max) : value;
}

// ── Period / year options ──────────────────────────────────────────────

const semesterOptions = MARKING_PERIOD_LIST.map((p) => ({ label: p.label, value: p.value }));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 2 + i;
  return { label: `${y}-${y + 1}`, value: `${y}-${y + 1}` };
});

// ── Main Component ─────────────────────────────────────────────────────

export default function GradeEntry() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId   = user?.id ?? '';

  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [academicYear,    setAcademicYear]    = useState(`${currentYear}-${currentYear + 1}`);
  const [semester,        setSemester]        = useState('');
  const [rows,            setRows]            = useState<StudentGradeRow[]>([]);

  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => gradeService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  const { data: classSubjects } = useFetch(
    ['class-subjects', selectedClass],
    () => gradeService.getClassSubjects(selectedClass),
    { enabled: !!selectedClass },
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

  // Build rows when students load
  useEffect(() => {
    if (!classStudents) return;
    const studentRows: StudentGradeRow[] = classStudents
      .map((a) => ({
        studentId:       a.students.id,
        firstName:       a.students.first_name,
        lastName:        a.students.last_name,
        idNumber:        a.students.registration_number,
        assignmentScore: '',
        quizScore:       '',
        testScore:       '',
        examScore:       '',
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
    setRows(studentRows);
  }, [classStudents]);

  // Pre-fill component scores from existing grades
  useEffect(() => {
    if (!existingGrades || existingGrades.length === 0 || rows.length === 0) return;
    type GradeRow = {
      student_id: string;
      assignment_score: number | null;
      quiz_score: number | null;
      test_score: number | null;
      exam_score: number | null;
    };
    const gradeMap = new Map(
      (existingGrades as GradeRow[]).map((g) => [g.student_id, g]),
    );
    setRows((prev) =>
      prev.map((r) => {
        const g = gradeMap.get(r.studentId);
        if (!g) return r;
        return {
          ...r,
          assignmentScore: g.assignment_score !== null && g.assignment_score !== undefined ? String(g.assignment_score) : '',
          quizScore:       g.quiz_score       !== null && g.quiz_score       !== undefined ? String(g.quiz_score)       : '',
          testScore:       g.test_score       !== null && g.test_score       !== undefined ? String(g.test_score)       : '',
          examScore:       g.exam_score       !== null && g.exam_score       !== undefined ? String(g.exam_score)       : '',
        };
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingGrades]);

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

  const saveMutation = useMutate(
    async () => {
      const grades = rows
        .filter((r) => computeTotal(r) !== null)
        .map((r) => ({
          studentId:       r.studentId,
          assignmentScore: r.assignmentScore !== '' ? Number(r.assignmentScore) : null,
          quizScore:       r.quizScore       !== '' ? Number(r.quizScore)       : null,
          testScore:       r.testScore       !== '' ? Number(r.testScore)       : null,
          examScore:       r.examScore       !== '' ? Number(r.examScore)       : null,
        }));
      if (grades.length === 0) throw new Error('No valid grades to save');
      return gradeService.bulkUpsertGrades(schoolId, selectedClass, selectedSubject, academicYear, semester, grades, userId);
    },
    [['grades']],
    { onSuccess: (data) => notify.success(`Saved ${(data as unknown[]).length} grades`) },
  );

  const canSave = !!(selectedClass && selectedSubject && academicYear && semester && rows.some((r) => computeTotal(r) !== null));
  const filledRows = rows.filter((r) => computeTotal(r) !== null);
  const totals = filledRows.map((r) => computeTotal(r)!);
  const avgScore = totals.length > 0 ? totals.reduce((s, n) => s + n, 0) / totals.length : 0;

  const classOptions   = (classes       ?? []).map((c)  => ({ label: `${c.name} — ${c.grade_level || ''}`, value: c.id }));
  const subjectOptions = (classSubjects ?? []).map((cs) => ({ label: cs.subjects.name, value: cs.subjects.id }));
  const ready = selectedClass && selectedSubject && semester;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Enter Grades' }]} />
      <h1 className="text-xl font-bold text-slate-900">Enter Grades</h1>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <Select label="Class"         options={classOptions}   value={selectedClass}   onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }} placeholder="Select class"    className="w-56" />
        <Select label="Subject"       options={subjectOptions} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} placeholder="Select subject"  className="w-56" disabled={!selectedClass} />
        <Select label="Academic Year" options={yearOptions}    value={academicYear}    onChange={(e) => setAcademicYear(e.target.value)}    className="w-40" />
        <Select label="Marking Period" options={semesterOptions} value={semester}       onChange={(e) => setSemester(e.target.value)}         placeholder="Select period"   className="w-52" />
      </div>

      {ready && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Enter each component separately — total is calculated automatically.&nbsp;
            <strong>Assignment /20 + Quiz /20 + Test /20 + Exam /40 = 100</strong>
          </span>
        </div>
      )}

      {!ready ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Select class, subject, and marking period to start entering grades.</p>
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
          <div className="flex gap-4 text-sm text-slate-500">
            <span>{rows.length} students</span>
            <span>{filledRows.length} graded</span>
            {filledRows.length > 0 && (
              <span>Class avg: <span className={`font-semibold ${scoreColor(avgScore)}`}>{avgScore.toFixed(1)}/100</span></span>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle>Student Grades — Component Entry</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                      <th className="py-3 pl-4 pr-2 text-left font-medium w-6">#</th>
                      <th className="py-3 pr-4 text-left font-medium">Student</th>
                      <th className="py-3 px-2 text-center font-medium"><div className="text-xs">Assignment</div><div className="text-[10px] text-slate-400 font-normal">/{COMPONENT_MAX.assignment}</div></th>
                      <th className="py-3 px-2 text-center font-medium"><div className="text-xs">Quiz</div><div className="text-[10px] text-slate-400 font-normal">/{COMPONENT_MAX.quiz}</div></th>
                      <th className="py-3 px-2 text-center font-medium"><div className="text-xs">Test</div><div className="text-[10px] text-slate-400 font-normal">/{COMPONENT_MAX.test}</div></th>
                      <th className="py-3 px-2 text-center font-medium"><div className="text-xs">Exam</div><div className="text-[10px] text-slate-400 font-normal">/{COMPONENT_MAX.exam}</div></th>
                      <th className="py-3 px-3 text-center font-medium"><div className="text-xs">Total</div><div className="text-[10px] text-slate-400 font-normal">/100</div></th>
                      <th className="py-3 px-3 text-center font-medium text-xs">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const total  = computeTotal(row);
                      const letter = total !== null ? letterFromScore(total) : '';
                      return (
                        <tr key={row.studentId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 pl-4 pr-2 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="py-2.5 pr-4 min-w-[140px]">
                            <p className="font-medium text-slate-900">{row.lastName}, {row.firstName}</p>
                            {row.idNumber && <p className="text-xs text-slate-400">{row.idNumber}</p>}
                          </td>
                          {(
                            [
                              { key: 'assignment', score: row.assignmentScore },
                              { key: 'quiz',       score: row.quizScore       },
                              { key: 'test',       score: row.testScore       },
                              { key: 'exam',       score: row.examScore       },
                            ] as { key: ComponentKey; score: string }[]
                          ).map(({ key, score }) => (
                            <td key={key} className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={COMPONENT_MAX[key]}
                                step={0.5}
                                value={score}
                                onChange={(e) => handleComponentChange(row.studentId, key, clampedInput(e.target.value, COMPONENT_MAX[key]))}
                                placeholder="—"
                                className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                              />
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-center">
                            {total !== null
                              ? <span className={`text-sm ${scoreColor(total)}`}>{total % 1 === 0 ? total : total.toFixed(1)}</span>
                              : <span className="text-slate-300 text-xs">—</span>
                            }
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {letter && (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                letter === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                letter === 'B' ? 'bg-blue-100 text-blue-700' :
                                letter === 'C' ? 'bg-slate-100 text-slate-700' :
                                letter === 'D' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>{letter}</span>
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

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate(undefined)} loading={saveMutation.isPending} disabled={!canSave}>
              <Save className="h-4 w-4 mr-1" /> Save Grades
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
