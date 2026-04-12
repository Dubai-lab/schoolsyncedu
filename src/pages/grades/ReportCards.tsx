import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { GRADE_SCALE, ACADEMIC_YEAR_TERMS } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { FileText, Printer, Search } from 'lucide-react';

const semesterOptions = Object.entries(ACADEMIC_YEAR_TERMS).map(([, v]) => ({
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  value: v,
}));

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 2 + i;
  return { label: `${y}-${y + 1}`, value: `${y}-${y + 1}` };
});

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
  const userId = user?.id ?? '';

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [academicYear, setAcademicYear] = useState(`${currentYear}-${currentYear + 1}`);
  const [semester, setSemester] = useState('');

  // Search for student by fetching grade report summary
  const { data: reportSummaries, isLoading: summaryLoading } = useFetch(
    ['report-summaries', schoolId],
    () => gradeService.getReportSummary(schoolId),
    { enabled: !!schoolId },
  );

  // Get student term grades once selected
  const { data: termGrades, isLoading: gradesLoading } = useFetch(
    ['student-term-grades', selectedStudentId, academicYear, semester],
    () => gradeService.getStudentTermGrades(selectedStudentId, academicYear, semester),
    { enabled: !!selectedStudentId && !!academicYear && !!semester },
  );

  // Generate report card mutation
  const generateMutation = useMutate(
    () => gradeService.generateReportCard({ student_id: selectedStudentId, academic_year: academicYear, semester, generated_by: userId }),
    [['report-cards']],
    { onSuccess: () => notify.success('Report card generated') },
  );

  // Filter summaries by search
  const filteredSummaries = (reportSummaries ?? []).filter((s) => {
    if (!studentSearch) return true;
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase());
  });

  // Selected student info
  const selectedStudent = reportSummaries?.find((s) => s.student_id === selectedStudentId);

  // Calculate totals
  const totalScore = (termGrades ?? []).reduce((s, g) => s + (g.score ?? 0), 0);
  const avgScore = termGrades && termGrades.length > 0 ? totalScore / termGrades.length : 0;
  const avgGpa = termGrades && termGrades.length > 0
    ? termGrades.reduce((s, g) => s + (g.gpa_points ?? 0), 0) / termGrades.length
    : 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Report Cards' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Report Cards</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            label="Search Student"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Student name..."
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select label="Academic Year" options={yearOptions} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-40" />
        <Select label="Semester" options={semesterOptions} value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Select semester" className="w-44" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: Student list */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto p-0">
            {summaryLoading ? (
              <LoadingSpinner label="Loading..." fullPage={false} />
            ) : filteredSummaries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No students found.</p>
            ) : (
              <ul className="divide-y">
                {filteredSummaries.map((s) => (
                  <li key={s.student_id}>
                    <button
                      onClick={() => setSelectedStudentId(s.student_id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedStudentId === s.student_id ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
                    >
                      <p className="text-sm font-medium text-slate-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400">{s.class_name ?? 'No class'} &middot; GPA {s.average_gpa ?? '—'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right: Report card detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedStudent
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name} — ${semester?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Select Semester'}`
                  : 'Select a Student'}
              </CardTitle>
              {selectedStudentId && semester && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1" /> Print
                  </Button>
                  <Button size="sm" onClick={() => generateMutation.mutate(undefined)} loading={generateMutation.isPending}>
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
                <p className="text-sm text-slate-400">Select a student and semester to view their report card.</p>
              </div>
            ) : gradesLoading ? (
              <LoadingSpinner label="Loading grades..." fullPage={false} />
            ) : !termGrades || termGrades.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">No grades recorded for this term.</p>
              </div>
            ) : (
              <div className="space-y-4">
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
                            {g.subjects.code && <p className="text-xs text-slate-400">{g.subjects.code}</p>}
                          </td>
                          <td className="py-2 pr-4 text-center font-medium">{g.score}</td>
                          <td className="py-2 pr-4 text-center">
                            <Badge variant={gradeBadgeVariant(g.letter_grade)} size="sm">{g.letter_grade}</Badge>
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
                          <Badge variant={gradeBadgeVariant(Object.entries(GRADE_SCALE).find(([, r]) => avgScore >= r.min && avgScore <= r.max)?.[0] ?? 'F')} size="sm">
                            {Object.entries(GRADE_SCALE).find(([, r]) => avgScore >= r.min && avgScore <= r.max)?.[0] ?? 'F'}
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
                        <span className="font-semibold text-slate-700">{letter}</span> = {info.min}–{info.max} ({info.description})
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