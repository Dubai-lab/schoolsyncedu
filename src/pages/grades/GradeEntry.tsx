import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { GRADE_SCALE, ACADEMIC_YEAR_TERMS } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Save, BookOpen } from 'lucide-react';

interface StudentGradeRow {
  studentId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  score: string; // string for input control
}

const semesterOptions = Object.entries(ACADEMIC_YEAR_TERMS).map(([, v]) => ({
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  value: v,
}));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 2 + i;
  return { label: `${y}-${y + 1}`, value: `${y}-${y + 1}` };
});

function letterFromScore(score: number): string {
  for (const [letter, range] of Object.entries(GRADE_SCALE)) {
    if (score >= range.min && score <= range.max) return letter;
  }
  return 'F';
}

export default function GradeEntry() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [academicYear, setAcademicYear] = useState(`${currentYear}-${currentYear + 1}`);
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<StudentGradeRow[]>([]);

  // Fetch classes
  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => gradeService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch subjects for selected class
  const { data: classSubjects } = useFetch(
    ['class-subjects', selectedClass],
    () => gradeService.getClassSubjects(selectedClass),
    { enabled: !!selectedClass },
  );

  // Fetch students in selected class
  const { data: classStudents, isLoading: studentsLoading } = useFetch(
    ['class-students', selectedClass],
    () => gradeService.getClassStudents(selectedClass),
    { enabled: !!selectedClass },
  );

  // Fetch existing grades for pre-fill
  const { data: existingGrades } = useFetch(
    ['class-grades', selectedClass, selectedSubject, academicYear, semester],
    () => gradeService.getClassGrades(selectedClass, selectedSubject, academicYear, semester),
    { enabled: !!selectedClass && !!selectedSubject && !!academicYear && !!semester },
  );

  // Build rows when students load
  useEffect(() => {
    if (!classStudents) return;
    const studentRows: StudentGradeRow[] = classStudents.map((a) => ({
      studentId: a.students.id,
      firstName: a.students.first_name,
      lastName: a.students.last_name,
      idNumber: a.students.registration_number,
      score: '',
    }));
    // Sort by last name
    studentRows.sort((a, b) => a.lastName.localeCompare(b.lastName));
    setRows(studentRows);
  }, [classStudents]);

  // Pre-fill when existing grades load
  useEffect(() => {
    if (!existingGrades || existingGrades.length === 0 || rows.length === 0) return;
    const gradeMap = new Map(existingGrades.map((g) => [g.student_id, g.score]));
    setRows((prev) =>
      prev.map((r) => {
        const existing = gradeMap.get(r.studentId);
        return existing !== undefined ? { ...r, score: String(existing) } : r;
      }),
    );
    // Only run once when existingGrades change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingGrades]);

  const handleScoreChange = useCallback((studentId: string, value: string) => {
    // Allow empty or valid number 0-100
    if (value !== '' && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 100)) return;
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, score: value } : r)));
  }, []);

  // Save mutation
  const saveMutation = useMutate(
    async () => {
      const grades = rows
        .filter((r) => r.score !== '' && !isNaN(Number(r.score)))
        .map((r) => ({ studentId: r.studentId, score: Number(r.score) }));
      if (grades.length === 0) throw new Error('No valid grades to save');
      return gradeService.bulkUpsertGrades(schoolId, selectedClass, selectedSubject, academicYear, semester, grades, userId);
    },
    [['grades']],
    { onSuccess: () => notify.success(`Saved ${rows.filter((r) => r.score !== '').length} grades`) },
  );

  const canSave = selectedClass && selectedSubject && academicYear && semester && rows.some((r) => r.score !== '');

  const classOptions = (classes ?? []).map((c) => ({ label: `${c.name} — ${c.grade_level || ''}`, value: c.id }));
  const subjectOptions = (classSubjects ?? []).map((cs) => ({ label: cs.subjects.name, value: cs.subjects.id }));

  // Stats
  const filledRows = rows.filter((r) => r.score !== '' && !isNaN(Number(r.score)));
  const avgScore = filledRows.length > 0 ? filledRows.reduce((sum, r) => sum + Number(r.score), 0) / filledRows.length : 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Enter Grades' }]} />

      <h1 className="text-xl font-bold text-slate-900">Enter Grades</h1>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <Select label="Class" options={classOptions} value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }} placeholder="Select class" className="w-56" />
        <Select label="Subject" options={subjectOptions} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} placeholder="Select subject" className="w-56" disabled={!selectedClass} />
        <Select label="Academic Year" options={yearOptions} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-40" />
        <Select label="Semester" options={semesterOptions} value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Select semester" className="w-44" />
      </div>

      {!selectedClass || !selectedSubject || !semester ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Select class, subject, and semester to start entering grades.</p>
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
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">{rows.length} students</span>
            <span className="text-slate-500">{filledRows.length} graded</span>
            {filledRows.length > 0 && (
              <span className="text-slate-500">Avg: <span className="font-medium text-slate-700">{avgScore.toFixed(1)}</span></span>
            )}
          </div>

          {/* Grade entry table */}
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

          {/* Save */}
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