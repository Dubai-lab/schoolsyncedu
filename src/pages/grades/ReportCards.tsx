import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { supabase } from '@/lib/supabase';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FileText, Printer, Search, User } from 'lucide-react';

// Semester → three marking-period keys
const SEMESTER_CONFIG = [
  { value: 'semester_1', label: 'First Semester',  ordinal: '1st', periods: ['p1', 'p2', 'p3'] as const },
  { value: 'semester_2', label: 'Second Semester', ordinal: '2nd', periods: ['p4', 'p5', 'p6'] as const },
];

function conductLabel(avg: number): string {
  if (avg >= 90) return 'Excellent';
  if (avg >= 80) return 'V.Good';
  if (avg >= 70) return 'Good';
  if (avg >= 60) return 'Fair';
  return 'Poor';
}

function fmt(n: number | null | undefined, decimals = 1): string {
  return n != null ? n.toFixed(decimals) : '';
}

function colAvg(rows: { pd1?: number; pd2?: number; exam?: number }[], key: 'pd1' | 'pd2' | 'exam'): number | null {
  const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export default function ReportCards() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [studentSearch,    setStudentSearch]    = useState('');
  const [debouncedSearch,  setDebouncedSearch]  = useState('');
  const [selectedId,       setSelectedId]       = useState('');
  const [selectedName,     setSelectedName]     = useState('');
  const [academicYear,     setAcademicYear]     = useState('');
  const [semesterKey,      setSemesterKey]      = useState('semester_1');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(studentSearch), 350);
    return () => clearTimeout(t);
  }, [studentSearch]);

  // Academic year from settings
  const { data: settingYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );
  useEffect(() => { if (settingYear && !academicYear) setAcademicYear(settingYear as string); }, [settingYear, academicYear]);

  // School info for the letterhead
  const { data: school } = useFetch(
    ['school-info', schoolId],
    async () => {
      const { data } = await supabase
        .from('schools')
        .select('name, address, city, phone, email, logo_url')
        .eq('id', schoolId)
        .single();
      return data as { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; logo_url: string | null } | null;
    },
    { enabled: !!schoolId },
  );

  // Student list search
  const { data: students = [], isLoading: studentsLoading } = useFetch(
    ['students-search', schoolId, debouncedSearch],
    () => gradeService.searchStudents(schoolId, debouncedSearch),
    { enabled: !!schoolId },
  );

  // Student detail (class name + class id for ranking)
  const { data: studentDetail } = useFetch(
    ['student-report-detail', selectedId],
    async () => {
      if (!selectedId) return null;
      const { data } = await supabase
        .from('students')
        .select('current_class_id, current_grade_level, classes:current_class_id(name, grade_level)')
        .eq('id', selectedId)
        .single();
      return data as { current_class_id: string | null; current_grade_level: string | null; classes: { name: string; grade_level: string } | null } | null;
    },
    { enabled: !!selectedId },
  );

  const classId = studentDetail?.current_class_id ?? '';

  // Active semester config
  const semConfig = SEMESTER_CONFIG.find((s) => s.value === semesterKey) ?? SEMESTER_CONFIG[0];
  const [pd1Key, pd2Key, examKey] = semConfig.periods;

  // Fetch grades for all 3 periods in parallel
  const { data: pd1Raw, isLoading: l1 } = useFetch(
    ['grades', selectedId, academicYear, pd1Key],
    () => gradeService.getStudentTermGrades(selectedId, academicYear, pd1Key),
    { enabled: !!selectedId && !!academicYear },
  );
  const { data: pd2Raw, isLoading: l2 } = useFetch(
    ['grades', selectedId, academicYear, pd2Key],
    () => gradeService.getStudentTermGrades(selectedId, academicYear, pd2Key),
    { enabled: !!selectedId && !!academicYear },
  );
  const { data: examRaw, isLoading: l3 } = useFetch(
    ['grades', selectedId, academicYear, examKey],
    () => gradeService.getStudentTermGrades(selectedId, academicYear, examKey),
    { enabled: !!selectedId && !!academicYear },
  );

  const gradesLoading = l1 || l2 || l3;

  // Fetch all grades for the whole class (needed for rank computation)
  const fetchClassPeriodGrades = async (cId: string, year: string, sem: string) => {
    const { data: assignments } = await supabase
      .from('class_assignments')
      .select('student_id')
      .eq('class_id', cId)
      .is('removed_at', null);
    const ids = (assignments ?? []).map((a: { student_id: string }) => a.student_id);
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from('grades')
      .select('student_id, score')
      .eq('academic_year', year)
      .eq('semester', sem)
      .in('student_id', ids);
    return (data ?? []) as { student_id: string; score: number | null }[];
  };

  const { data: classPd1 = [] } = useFetch(
    ['class-grades', classId, academicYear, pd1Key],
    () => fetchClassPeriodGrades(classId, academicYear, pd1Key),
    { enabled: !!classId && !!academicYear },
  );
  const { data: classPd2 = [] } = useFetch(
    ['class-grades', classId, academicYear, pd2Key],
    () => fetchClassPeriodGrades(classId, academicYear, pd2Key),
    { enabled: !!classId && !!academicYear },
  );
  const { data: classExam = [] } = useFetch(
    ['class-grades', classId, academicYear, examKey],
    () => fetchClassPeriodGrades(classId, academicYear, examKey),
    { enabled: !!classId && !!academicYear },
  );

  // Build rank map: group scores by student → average → sort desc → assign rank
  function buildRankMap(grades: { student_id: string; score: number | null }[]): Map<string, { rank: number; total: number }> {
    const acc = new Map<string, { sum: number; cnt: number }>();
    for (const g of grades) {
      if (g.score == null) continue;
      const cur = acc.get(g.student_id) ?? { sum: 0, cnt: 0 };
      acc.set(g.student_id, { sum: cur.sum + g.score, cnt: cur.cnt + 1 });
    }
    const sorted = [...acc.entries()]
      .map(([id, { sum, cnt }]) => ({ id, avg: sum / cnt }))
      .sort((a, b) => b.avg - a.avg);
    const total = sorted.length;
    const out = new Map<string, { rank: number; total: number }>();
    let curRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].avg < sorted[i - 1].avg) curRank = i + 1;
      out.set(sorted[i].id, { rank: curRank, total });
    }
    return out;
  }

  const pd1RankMap  = buildRankMap(classPd1);
  const pd2RankMap  = buildRankMap(classPd2);
  const examRankMap = buildRankMap(classExam);
  // Semester rank: combine all 3 periods (same student weighting as colAvg logic)
  const semRankMap  = buildRankMap([...classPd1, ...classPd2, ...classExam]);

  const pd1RankInfo  = pd1RankMap.get(selectedId);
  const pd2RankInfo  = pd2RankMap.get(selectedId);
  const examRankInfo = examRankMap.get(selectedId);
  const semRankInfo  = semRankMap.get(selectedId);

  function fmtRank(info?: { rank: number; total: number }): string {
    return info ? `${info.rank}/${info.total}` : '—';
  }

  // Merge all 3 periods into a subject map
  type SubjectRow = { id: string; name: string; pd1?: number; pd2?: number; exam?: number };
  const subjectMap = new Map<string, SubjectRow>();

  const merge = (grades: typeof pd1Raw, col: 'pd1' | 'pd2' | 'exam') => {
    grades?.forEach((g) => {
      const name = g.subjects?.name ?? 'Unknown';
      if (!subjectMap.has(name)) subjectMap.set(name, { id: g.subjects.id, name });
      const entry = subjectMap.get(name)!;
      if (g.score != null) entry[col] = g.score;
    });
  };
  merge(pd1Raw, 'pd1');
  merge(pd2Raw, 'pd2');
  merge(examRaw, 'exam');

  const rows = Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Per-subject semester average
  const subjectSemAvgs = rows.map((r) => {
    const vals = [r.pd1, r.pd2, r.exam].filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  // Column averages (across all subjects)
  const pd1ColAvg  = colAvg(rows, 'pd1');
  const pd2ColAvg  = colAvg(rows, 'pd2');
  const examColAvg = colAvg(rows, 'exam');
  const validAvgs  = subjectSemAvgs.filter((v): v is number => v != null);
  const semColAvg  = validAvgs.length ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : null;

  const hasGrades = rows.length > 0;

  const className =
    (studentDetail?.classes as { name?: string } | null)?.name
    ?? studentDetail?.current_grade_level
    ?? '—';

  const schoolName    = school?.name ?? 'School Name';
  const schoolAddress = [school?.address, school?.city].filter(Boolean).join(', ') || '';
  const schoolContact = school?.phone ?? school?.email ?? '';
  const schoolLogo    = school?.logo_url ?? null;

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Report Cards' }]} />

      <h1 className="text-xl font-bold text-slate-900 print:hidden">Report Cards</h1>

      {/* Filters — hidden when printing */}
      <div className="flex flex-wrap gap-3 items-end print:hidden">
        <div className="w-64">
          <Input
            label="Search Student"
            value={studentSearch}
            onChange={(e) => { setStudentSearch(e.target.value); setSelectedId(''); setSelectedName(''); }}
            placeholder="Name or registration number..."
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="e.g. 2025-2026"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <Select
          label="Semester"
          options={SEMESTER_CONFIG.map((s) => ({ label: s.label, value: s.value }))}
          value={semesterKey}
          onChange={(e) => setSemesterKey(e.target.value)}
          className="w-48"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 print:block">

        {/* Student list — hidden when printing */}
        <Card className="lg:col-span-1 print:hidden">
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardContent className="max-h-[540px] overflow-y-auto p-0">
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
                      onClick={() => { setSelectedId(s.id); setSelectedName(`${s.first_name} ${s.last_name}`); }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedId === s.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.registration_number ?? '—'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Report card area */}
        <div className="lg:col-span-2">
          {!selectedId ? (
            <Card className="print:hidden">
              <CardContent>
                <div className="py-14 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400">Select a student to view their report card.</p>
                </div>
              </CardContent>
            </Card>
          ) : gradesLoading ? (
            <Card><CardContent><LoadingSpinner label="Loading grades…" fullPage={false} /></CardContent></Card>
          ) : (
            <>
              {/* Print button */}
              <div className="flex justify-end mb-3 print:hidden">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Report Card
                </Button>
              </div>

              {/* ── PRINTABLE REPORT CARD ───────────────────────────────────── */}
              <div
                className="bg-white border border-slate-300 rounded-lg print:border-0 print:rounded-none"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >

                {/* ── LETTERHEAD ─────────────────────────────────────────────── */}
                <div className="border-b-2 border-black px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Logo left */}
                    <div className="flex-shrink-0">
                      {schoolLogo
                        ? <img src={schoolLogo} alt="logo" className="h-16 w-16 object-contain" />
                        : <div className="h-16 w-16 rounded-full border-2 border-black flex items-center justify-center text-[10px] text-center leading-tight p-1 font-bold">SCHOOL<br/>LOGO</div>
                      }
                    </div>

                    {/* School info centred */}
                    <div className="flex-1 text-center">
                      <p className="text-lg font-extrabold uppercase tracking-wide leading-snug">{schoolName}</p>
                      {schoolAddress && <p className="text-xs mt-0.5">{schoolAddress}</p>}
                      {schoolContact && <p className="text-xs">Contact: {schoolContact}</p>}
                    </div>

                    {/* Logo right */}
                    <div className="flex-shrink-0">
                      {schoolLogo
                        ? <img src={schoolLogo} alt="logo" className="h-16 w-16 object-contain" />
                        : <div className="h-16 w-16 rounded-full border-2 border-black flex items-center justify-center text-[10px] text-center leading-tight p-1 font-bold">SCHOOL<br/>LOGO</div>
                      }
                    </div>
                  </div>
                </div>

                {/* ── REPORT TITLE ───────────────────────────────────────────── */}
                <div className="text-center py-1.5 border-b border-black">
                  <p className="text-sm font-bold uppercase underline tracking-wide">
                    {semConfig.label.toUpperCase()} REPORT
                  </p>
                </div>

                {/* ── STUDENT INFO ───────────────────────────────────────────── */}
                <div className="px-5 py-2 border-b border-black">
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                    <div className="flex items-baseline gap-2 flex-1 min-w-0">
                      <span className="font-bold whitespace-nowrap">Student's Name:</span>
                      <span className="border-b border-black flex-1 pl-1">{selectedName}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold whitespace-nowrap">Class:</span>
                      <span className="border-b border-black min-w-[90px] pl-1">{className}</span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 text-sm">
                    <span className="font-bold whitespace-nowrap">Academic Year:</span>
                    <span className="border-b border-black min-w-[100px] pl-1">{academicYear || '—'}</span>
                  </div>
                </div>

                {/* ── GRADE TABLE ────────────────────────────────────────────── */}
                <div className="px-1">
                  {!hasGrades ? (
                    <div className="py-10 text-center">
                      <User className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">
                        No grades recorded for {semConfig.label}, {academicYear || '—'}.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Teachers enter grades via the Grade Entry page.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th
                            className="border border-black px-3 py-1 text-left font-bold uppercase text-xs align-bottom"
                            rowSpan={2}
                            style={{ width: '38%' }}
                          >
                            Subjects
                          </th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">
                            1<sup>st</sup>
                          </th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">
                            2<sup>nd</sup>
                          </th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">
                            {semConfig.ordinal} Sem
                          </th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">
                            {semConfig.ordinal} Sem
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">PD</th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">PD</th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">Exam</th>
                          <th className="border border-black px-1 py-0.5 text-center text-[11px] font-bold">Ave</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.id}>
                            <td className="border border-black px-3 py-0.5 font-medium text-xs">{row.name}</td>
                            <td className="border border-black px-1 py-0.5 text-center text-sm">{row.pd1 ?? ''}</td>
                            <td className="border border-black px-1 py-0.5 text-center text-sm">{row.pd2 ?? ''}</td>
                            <td className="border border-black px-1 py-0.5 text-center text-sm">{row.exam ?? ''}</td>
                            <td className="border border-black px-1 py-0.5 text-center text-sm font-semibold">
                              {fmt(subjectSemAvgs[i])}
                            </td>
                          </tr>
                        ))}

                        {/* Average row */}
                        <tr className="bg-gray-50 font-bold">
                          <td className="border border-black px-3 py-0.5 text-xs font-bold">Average</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmt(pd1ColAvg)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmt(pd2ColAvg)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmt(examColAvg)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmt(semColAvg)}</td>
                        </tr>

                        {/* Conduct row */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 text-xs font-bold">Conduct</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">
                            {pd1ColAvg != null ? conductLabel(pd1ColAvg) : ''}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">
                            {pd2ColAvg != null ? conductLabel(pd2ColAvg) : ''}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">
                            {examColAvg != null ? conductLabel(examColAvg) : ''}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs font-semibold">
                            {semColAvg != null ? conductLabel(semColAvg) : ''}
                          </td>
                        </tr>

                        {/* Rank row */}
                        <tr>
                          <td className="border border-black px-3 py-0.5 text-xs font-bold">Rank</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmtRank(pd1RankInfo)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmtRank(pd2RankInfo)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs">{fmtRank(examRankInfo)}</td>
                          <td className="border border-black px-1 py-0.5 text-center text-xs font-semibold">{fmtRank(semRankInfo)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* ── SIGNATURE SECTION ──────────────────────────────────────── */}
                <div className="px-6 py-5 space-y-5 border-t border-black mt-1">
                  <div className="flex items-end gap-3">
                    <span className="text-sm font-bold whitespace-nowrap">Signed:</span>
                    <span className="border-b border-black flex-1 min-w-[160px]" />
                    <span className="text-sm whitespace-nowrap">Class Sponsor</span>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-sm font-bold whitespace-nowrap">Approved:</span>
                    <span className="border-b border-black flex-1 min-w-[160px]" />
                  </div>
                </div>

              </div>
              {/* /REPORT CARD */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
