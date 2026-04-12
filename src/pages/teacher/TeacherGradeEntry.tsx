import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { academicCalendarService } from '@/services/classService';
import type { AcademicCalendar } from '@/types/school.types';
import { GRADE_SCALE } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Save, BookOpen, SendHorizontal } from 'lucide-react';

interface StudentGradeRow {
  studentId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  score: string;
}

function letterFromScore(score: number): string {
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (score >= range.min && score <= range.max) return letter;
  }
  return 'F';
}

export default function TeacherGradeEntry() {
  const { user } = useAuth();
  const location = useLocation();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const [selectedClass, setSelectedClass] = useState((location.state as { classId?: string })?.classId ?? '');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<StudentGradeRow[]>([]);

  // Fetch school's current academic year
  const { data: schoolYear } = useFetch(
    ['school-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  useEffect(() => {
    if (schoolYear && !academicYear) {
      setAcademicYear(schoolYear as string);
    }
  }, [schoolYear, academicYear]);

  // Fetch terms created by principal for this academic year
  const { data: dbTerms = [] } = useFetch(
    ['academic-calendar-terms', schoolId, academicYear],
    () => academicCalendarService.list(schoolId),
    { enabled: !!schoolId && !!academicYear },
  );

  const TERM_LABEL_MAP: Record<string, string> = {
    first_term: 'First Term',
    second_term: 'Second Term',
    third_term: 'Third Term',
  };

  const termOptions = (dbTerms as unknown as AcademicCalendar[])
    .filter((t) => t.academic_year === academicYear)
    .sort((a, b) => (a.term_name > b.term_name ? 1 : -1))
    .map((t) => ({
      label: TERM_LABEL_MAP[t.term_name] ?? t.term_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: t.term_name,
    }));

  // Only teacher's classes (school-scoped)
  const { data: myClasses } = useFetch(
    ['teacher-classes', schoolId, teacherId],
    () => teacherService.getMyClasses(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  // Only subjects the teacher teaches in the selected class
  const { data: mySubjects } = useFetch(
    ['teacher-subjects', schoolId, teacherId],
    () => teacherService.getMySubjects(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  // Students in the selected class
  const { data: classStudents, isLoading: studentsLoading } = useFetch(
    ['class-students', selectedClass],
    () => gradeService.getClassStudents(selectedClass),
    { enabled: !!selectedClass },
  );

  // Existing grades for pre-fill
  const { data: existingGrades } = useFetch(
    ['class-grades', selectedClass, selectedSubject, academicYear, semester],
    () => gradeService.getClassGrades(selectedClass, selectedSubject, academicYear, semester),
    { enabled: !!selectedClass && !!selectedSubject && !!academicYear && !!semester },
  );

  // Filter subjects to ones taught in the selected class
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
      studentId: a.students.id,
      firstName: a.students.first_name,
      lastName: a.students.last_name,
      idNumber: (a.students as Record<string, unknown>).registration_number as string | null,
      score: '',
    }));
    studentRows.sort((a, b) => a.lastName.localeCompare(b.lastName));
    setRows(studentRows);
  }, [classStudents]);

  // Pre-fill existing grades
  useEffect(() => {
    if (!existingGrades || existingGrades.length === 0 || rows.length === 0) return;
    const gradeMap = new Map(existingGrades.map((g) => [g.student_id, g.score]));
    setRows((prev) =>
      prev.map((r) => {
        const existing = gradeMap.get(r.studentId);
        return existing !== undefined ? { ...r, score: String(existing) } : r;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingGrades]);

  const handleScoreChange = useCallback((studentId: string, value: string) => {
    if (value !== '' && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 100)) return;
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, score: value } : r)));
  }, []);

  const saveMutation = useMutate(
    async () => {
      const grades = rows
        .filter((r) => r.score !== '' && !isNaN(Number(r.score)))
        .map((r) => ({ studentId: r.studentId, score: Number(r.score) }));
      if (grades.length === 0) throw new Error('No valid grades to save');
      return gradeService.bulkUpsertGrades(schoolId, selectedClass, selectedSubject, academicYear, semester, grades, teacherId);
    },
    [['grades']],
    { onSuccess: (data) => {
      notify.success(`Saved ${rows.filter((r) => r.score !== '').length} grades as draft`);
      setSavedGradeIds((data as { id: string }[]).map((g) => g.id));
    }},
  );

  const [savedGradeIds, setSavedGradeIds] = useState<string[]>([]);

  const submitMutation = useMutate(
    async () => {
      if (savedGradeIds.length === 0) throw new Error('Save grades first');
      return gradeService.submitGradesForApproval(savedGradeIds);
    },
    [['grades']],
    { onSuccess: () => {
      notify.success('Grades submitted for principal approval');
      setSavedGradeIds([]);
    }},
  );

  const canSave = selectedClass && selectedSubject && academicYear && semester && rows.some((r) => r.score !== '');
  const filledRows = rows.filter((r) => r.score !== '' && !isNaN(Number(r.score)));
  const avgScore = filledRows.length > 0 ? filledRows.reduce((sum, r) => sum + Number(r.score), 0) / filledRows.length : 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Teacher Portal', href: '/teacher' }, { label: 'Enter Grades' }]} />

      <h1 className="text-xl font-bold text-slate-900">Enter Grades</h1>

      {/* Selectors — scoped to teacher's classes & subjects */}
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
          label="Term"
          options={termOptions}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder={termOptions.length === 0 ? 'No terms created yet' : 'Select term'}
          className="w-44"
          disabled={termOptions.length === 0}
        />
      </div>

      {!selectedClass || !selectedSubject || !semester ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Select class, subject, and term to start entering grades.</p>
            {termOptions.length === 0 && academicYear && (
              <p className="mt-1 text-xs text-amber-500">No terms have been created yet. Ask the Principal to set up terms for {academicYear}.</p>
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
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">{rows.length} students</span>
            <span className="text-slate-500">{filledRows.length} graded</span>
            {filledRows.length > 0 && (
              <span className="text-slate-500">Avg: <span className="font-medium text-slate-700">{avgScore.toFixed(1)}</span></span>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Student Grades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-2 pr-4 font-medium">#</th>
                      <th className="pb-2 pr-4 font-medium">Student</th>
                      <th className="pb-2 pr-4 font-medium w-28">Score (0-100)</th>
                      <th className="pb-2 pr-4 font-medium w-16">Grade</th>
                      <th className="pb-2 font-medium w-16">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const score = row.score !== '' ? Number(row.score) : null;
                      const letter = score !== null ? letterFromScore(score) : '';
                      const gpa = score !== null ? GRADE_SCALE[letter as keyof typeof GRADE_SCALE]?.gpa ?? 0 : null;
                      return (
                        <tr key={row.studentId} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-2 pr-4 text-slate-400">{idx + 1}</td>
                          <td className="py-2 pr-4">
                            <p className="font-medium text-slate-900">{row.lastName}, {row.firstName}</p>
                            {row.idNumber && <p className="text-xs text-slate-400">{row.idNumber}</p>}
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.score}
                              onChange={(e) => handleScoreChange(row.studentId, e.target.value)}
                              className="w-24 rounded-md border border-slate-200 px-2 py-1 text-center text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                              placeholder="—"
                            />
                          </td>
                          <td className="py-2 pr-4">
                            {letter && (
                              <span className={`text-sm font-semibold ${letter === 'A' ? 'text-emerald-600' : letter === 'B' ? 'text-blue-600' : letter === 'C' ? 'text-slate-600' : letter === 'D' ? 'text-amber-600' : 'text-red-600'}`}>
                                {letter}
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-slate-500">{gpa !== null ? gpa.toFixed(1) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={() => saveMutation.mutate(undefined)} loading={saveMutation.isPending} disabled={!canSave} variant="outline">
              <Save className="h-4 w-4 mr-1" /> Save Draft
            </Button>
            <Button onClick={() => {
              if (savedGradeIds.length > 0) {
                submitMutation.mutate(undefined);
              } else {
                // Save first, then submit
                saveMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    const ids = (data as { id: string }[]).map((g) => g.id);
                    gradeService.submitGradesForApproval(ids).then(() => {
                      notify.success('Grades submitted for principal approval');
                    });
                  },
                });
              }
            }} loading={submitMutation.isPending} disabled={!canSave}>
              <SendHorizontal className="h-4 w-4 mr-1" /> Submit for Approval
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
