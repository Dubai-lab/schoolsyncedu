import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';

import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { FileText, Printer, Search } from 'lucide-react';

function gradeBadgeVariant(letter: string) {
  if (letter === 'A') return 'success' as const;
  if (letter === 'B') return 'info' as const;
  if (letter === 'C') return 'default' as const;
  if (letter === 'D') return 'warning' as const;
  return 'danger' as const;
}

export default function TranscriptPage() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Student list from report summary
  const { data: summaries, isLoading: summaryLoading } = useFetch(
    ['report-summaries', schoolId],
    () => gradeService.getReportSummary(schoolId),
    { enabled: !!schoolId },
  );

  // All grades for the selected student (all terms)
  const { data: allGrades, isLoading: gradesLoading } = useFetch(
    ['student-all-grades', selectedStudentId],
    () =>
      gradeService.list(selectedStudentId ? (summaries?.find((s) => s.student_id === selectedStudentId)?.school_id ?? schoolId) : schoolId, {
        studentId: selectedStudentId,
        pageSize: 500,
      }),
    { enabled: !!selectedStudentId },
  );

  // Existing transcripts
  const { data: transcripts } = useFetch(
    ['transcripts', selectedStudentId],
    () => gradeService.listTranscripts(selectedStudentId),
    { enabled: !!selectedStudentId },
  );

  // Generate transcript
  const generateMutation = useMutate(
    () => {
      const grades = allGrades?.data ?? [];
      const overallGpa = grades.length > 0
        ? grades.reduce((s, g) => s + (g.gpa_points ?? 0), 0) / grades.length
        : 0;

      // Group by year + semester
      const record: Record<string, unknown> = {};
      for (const g of grades) {
        const key = `${g.academic_year}_${g.semester}`;
        if (!record[key]) record[key] = [];
        (record[key] as unknown[]).push({
          subject: (g as unknown as Record<string, unknown>).subjects,
          score: g.score,
          letter_grade: g.letter_grade,
          gpa_points: g.gpa_points,
        });
      }

      return gradeService.generateTranscript({
        student_id: selectedStudentId,
        academic_record: record,
        overall_gpa: Number(overallGpa.toFixed(2)),
        generated_by: userId,
      });
    },
    [['transcripts']],
    { onSuccess: () => notify.success('Transcript generated') },
  );

  const filteredSummaries = (summaries ?? []).filter((s) => {
    if (!studentSearch) return true;
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase());
  });

  const selectedStudent = summaries?.find((s) => s.student_id === selectedStudentId);
  const grades = allGrades?.data ?? [];

  // Group grades by academic year + semester
  const grouped = new Map<string, typeof grades>();
  for (const g of grades) {
    const key = `${g.academic_year} — ${(g.semester ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(g);
  }

  // Overall GPA
  const overallGpa = grades.length > 0 ? grades.reduce((s, g) => s + (g.gpa_points ?? 0), 0) / grades.length : 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Transcript' }]} />

      <h1 className="text-xl font-bold text-slate-900">Student Transcript</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Student list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <Input
              placeholder="Search student..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </CardHeader>
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
                      <p className="text-xs text-slate-400">{s.class_name ?? 'No class'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'Select a Student'}
              </CardTitle>
              {selectedStudentId && (
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
            {!selectedStudentId ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-400">Select a student to view their full transcript.</p>
              </div>
            ) : gradesLoading ? (
              <LoadingSpinner label="Loading transcript..." fullPage={false} />
            ) : grades.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">No grades recorded for this student.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall GPA banner */}
                <div className="rounded-lg bg-primary-50 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-700">Cumulative GPA</span>
                  <span className="text-xl font-bold text-primary-800">{overallGpa.toFixed(2)}</span>
                </div>

                {/* Grouped by term */}
                {Array.from(grouped.entries()).map(([termLabel, termGrades]) => {
                  const termAvg = termGrades.reduce((s, g) => s + (g.gpa_points ?? 0), 0) / termGrades.length;
                  return (
                    <div key={termLabel}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-700">{termLabel}</h3>
                        <span className="text-xs text-slate-400">Term GPA: {termAvg.toFixed(2)}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-slate-500">
                            <th className="pb-1.5 pr-4 font-medium">Subject</th>
                            <th className="pb-1.5 pr-4 font-medium text-center">Score</th>
                            <th className="pb-1.5 pr-4 font-medium text-center">Grade</th>
                            <th className="pb-1.5 font-medium text-center">GPA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {termGrades.map((g) => {
                            const subj = (g as unknown as Record<string, unknown>).subjects as Record<string, string> | undefined;
                            return (
                              <tr key={g.id} className="border-b last:border-0">
                                <td className="py-1.5 pr-4 text-slate-900">{subj?.name ?? '—'}</td>
                                <td className="py-1.5 pr-4 text-center">{g.score}</td>
                                <td className="py-1.5 pr-4 text-center">
                                  <Badge variant={gradeBadgeVariant(g.letter_grade)} size="sm">{g.letter_grade}</Badge>
                                </td>
                                <td className="py-1.5 text-center text-slate-600">{g.gpa_points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Previous transcripts */}
                {transcripts && transcripts.length > 0 && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Generated Transcripts</p>
                    <div className="space-y-1">
                      {transcripts.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs text-slate-500">
                          <span>GPA: {t.overall_gpa}</span>
                          <span>{new Date(t.generated_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}