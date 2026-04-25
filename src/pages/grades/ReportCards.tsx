import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { itAdminSiteService } from '@/services/itAdminService';
import { supabase } from '@/lib/supabase';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FileText, Printer, Search, User } from 'lucide-react';

type ReportMode = 'semester_1' | 'semester_2' | 'full_year';

const REPORT_MODE_OPTIONS: { value: ReportMode; label: string; title: string }[] = [
  { value: 'semester_1', label: 'First Semester',     title: 'FIRST SEMESTER REPORT' },
  { value: 'semester_2', label: 'Second Semester',    title: 'SECOND SEMESTER REPORT' },
  { value: 'full_year',  label: 'Full Academic Year', title: 'FULL ACADEMIC YEAR REPORT' },
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

function mean(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

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

function fmtRank(info?: { rank: number; total: number }): string {
  return info ? `${info.rank}/${info.total}` : '—';
}

type GradeRow = { score: number | null; subjects: { id: string; name: string } };
type PKey = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
type SubjectRow = { id: string; name: string; p1?: number; p2?: number; p3?: number; p4?: number; p5?: number; p6?: number };

const TD = 'border border-black px-1 py-0.5 text-center text-xs';
const TH = 'border border-black px-1 py-0.5 text-center text-[11px] font-bold';

export default function ReportCards() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [studentSearch,   setStudentSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId,      setSelectedId]      = useState('');
  const [selectedName,    setSelectedName]    = useState('');
  const [academicYear,    setAcademicYear]    = useState('');
  const [reportMode,      setReportMode]      = useState<ReportMode>('semester_1');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(studentSearch), 350);
    return () => clearTimeout(t);
  }, [studentSearch]);

  const modeConfig = REPORT_MODE_OPTIONS.find((m) => m.value === reportMode)!;
  const isSem1     = reportMode === 'semester_1';
  const isSem2     = reportMode === 'semester_2';
  const isFullYear = reportMode === 'full_year';

  // Academic year from settings
  const { data: settingYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );
  useEffect(() => { if (settingYear && !academicYear) setAcademicYear(settingYear as string); }, [settingYear, academicYear]);

  // School info — same service as Transcript
  const { data: school } = useFetch(
    ['school-info', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
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

  // Enable flags per mode
  const needSem1 = isSem1 || isFullYear;
  const needSem2 = isSem2 || isFullYear;

  // Per-student grade fetches for all 6 periods
  const { data: p1Raw, isLoading: lp1 } = useFetch(['grades', selectedId, academicYear, 'p1'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p1'), { enabled: !!selectedId && !!academicYear && needSem1 });
  const { data: p2Raw, isLoading: lp2 } = useFetch(['grades', selectedId, academicYear, 'p2'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p2'), { enabled: !!selectedId && !!academicYear && needSem1 });
  const { data: p3Raw, isLoading: lp3 } = useFetch(['grades', selectedId, academicYear, 'p3'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p3'), { enabled: !!selectedId && !!academicYear && needSem1 });
  const { data: p4Raw, isLoading: lp4 } = useFetch(['grades', selectedId, academicYear, 'p4'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p4'), { enabled: !!selectedId && !!academicYear && needSem2 });
  const { data: p5Raw, isLoading: lp5 } = useFetch(['grades', selectedId, academicYear, 'p5'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p5'), { enabled: !!selectedId && !!academicYear && needSem2 });
  const { data: p6Raw, isLoading: lp6 } = useFetch(['grades', selectedId, academicYear, 'p6'], () => gradeService.getStudentTermGrades(selectedId, academicYear, 'p6'), { enabled: !!selectedId && !!academicYear && needSem2 });

  const gradesLoading =
    (needSem1 && (lp1 || lp2 || lp3)) ||
    (needSem2 && (lp4 || lp5 || lp6));

  // Class-wide grade fetches for ranking
  const fetchClassGrades = async (cId: string, year: string, sem: string) => {
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

  const { data: cp1 = [] } = useFetch(['class-grades', classId, academicYear, 'p1'], () => fetchClassGrades(classId, academicYear, 'p1'), { enabled: !!classId && !!academicYear && needSem1 });
  const { data: cp2 = [] } = useFetch(['class-grades', classId, academicYear, 'p2'], () => fetchClassGrades(classId, academicYear, 'p2'), { enabled: !!classId && !!academicYear && needSem1 });
  const { data: cp3 = [] } = useFetch(['class-grades', classId, academicYear, 'p3'], () => fetchClassGrades(classId, academicYear, 'p3'), { enabled: !!classId && !!academicYear && needSem1 });
  const { data: cp4 = [] } = useFetch(['class-grades', classId, academicYear, 'p4'], () => fetchClassGrades(classId, academicYear, 'p4'), { enabled: !!classId && !!academicYear && needSem2 });
  const { data: cp5 = [] } = useFetch(['class-grades', classId, academicYear, 'p5'], () => fetchClassGrades(classId, academicYear, 'p5'), { enabled: !!classId && !!academicYear && needSem2 });
  const { data: cp6 = [] } = useFetch(['class-grades', classId, academicYear, 'p6'], () => fetchClassGrades(classId, academicYear, 'p6'), { enabled: !!classId && !!academicYear && needSem2 });

  // Rank maps
  const p1Ranks        = buildRankMap(cp1);
  const p2Ranks        = buildRankMap(cp2);
  const p3Ranks        = buildRankMap(cp3);
  const p4Ranks        = buildRankMap(cp4);
  const p5Ranks        = buildRankMap(cp5);
  const p6Ranks        = buildRankMap(cp6);
  const sem1Ranks      = buildRankMap([...cp1, ...cp2, ...cp3]);
  const sem2Ranks      = buildRankMap([...cp4, ...cp5, ...cp6]);
  const fullYearRanks  = buildRankMap([...cp1, ...cp2, ...cp3, ...cp4, ...cp5, ...cp6]);

  // Merge grades into subject map
  const subjectMap = new Map<string, SubjectRow>();
  const mergeGrades = (grades: GradeRow[] | undefined, col: PKey) => {
    grades?.forEach((g) => {
      const name = g.subjects?.name ?? 'Unknown';
      if (!subjectMap.has(name)) subjectMap.set(name, { id: g.subjects.id, name });
      const entry = subjectMap.get(name)!;
      if (g.score != null) entry[col] = g.score;
    });
  };
  mergeGrades(p1Raw, 'p1');
  mergeGrades(p2Raw, 'p2');
  mergeGrades(p3Raw, 'p3');
  mergeGrades(p4Raw, 'p4');
  mergeGrades(p5Raw, 'p5');
  mergeGrades(p6Raw, 'p6');

  const rows = Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Per-subject averages
  const s1Avgs    = rows.map((r) => mean([r.p1, r.p2, r.p3]));
  const s2Avgs    = rows.map((r) => mean([r.p4, r.p5, r.p6]));
  const finalAvgs = rows.map((_, i) => mean([s1Avgs[i], s2Avgs[i]]));

  // Column averages (across all subjects)
  const colP1   = mean(rows.map((r) => r.p1));
  const colP2   = mean(rows.map((r) => r.p2));
  const colP3   = mean(rows.map((r) => r.p3));
  const colP4   = mean(rows.map((r) => r.p4));
  const colP5   = mean(rows.map((r) => r.p5));
  const colP6   = mean(rows.map((r) => r.p6));
  const colS1   = mean(s1Avgs);
  const colS2   = mean(s2Avgs);
  const colFinal = mean(finalAvgs);

  const hasGrades = rows.length > 0;

  const className =
    (studentDetail?.classes as { name?: string } | null)?.name
    ?? studentDetail?.current_grade_level
    ?? '—';

  const schoolName    = school?.name ?? 'School Name';
  const schoolAddress = school?.address ?? '';
  const schoolContact = school?.phone ?? school?.principal_email ?? '';
  const schoolLogo    = school?.logo_url ?? null;

  // ── LETTERHEAD (shared) ─────────────────────────────────────────────────────
  const Letterhead = (
    <div className="border-b-2 border-black px-5 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {schoolLogo
            ? <img src={schoolLogo} alt="logo" className="h-16 w-16 object-contain" />
            : <div className="h-16 w-16 rounded-full border-2 border-black flex items-center justify-center text-[10px] text-center leading-tight p-1 font-bold">SCHOOL<br />LOGO</div>
          }
        </div>
        <div className="flex-1 text-center">
          <p className="text-lg font-extrabold uppercase tracking-wide leading-snug">{schoolName}</p>
          {schoolAddress && <p className="text-xs mt-0.5">{schoolAddress}</p>}
          {schoolContact && <p className="text-xs">Contact: {schoolContact}</p>}
        </div>
        <div className="flex-shrink-0">
          {schoolLogo
            ? <img src={schoolLogo} alt="logo" className="h-16 w-16 object-contain" />
            : <div className="h-16 w-16 rounded-full border-2 border-black flex items-center justify-center text-[10px] text-center leading-tight p-1 font-bold">SCHOOL<br />LOGO</div>
          }
        </div>
      </div>
    </div>
  );

  // ── STUDENT INFO (shared) ───────────────────────────────────────────────────
  const StudentInfo = (
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
  );

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Report Cards' }]} />
      <h1 className="text-xl font-bold text-slate-900 print:hidden">Report Cards</h1>

      {/* Filters */}
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
          label="Report Type"
          options={REPORT_MODE_OPTIONS.map((m) => ({ label: m.label, value: m.value }))}
          value={reportMode}
          onChange={(e) => setReportMode(e.target.value as ReportMode)}
          className="w-52"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 print:block">

        {/* Student list */}
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
              <div className="flex justify-end mb-3 print:hidden">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Report Card
                </Button>
              </div>

              {/* ── PRINTABLE REPORT CARD ──────────────────────────────────── */}
              <div
                className="bg-white border border-slate-300 rounded-lg print:border-0 print:rounded-none"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {Letterhead}

                {/* REPORT TITLE */}
                <div className="text-center py-1.5 border-b border-black">
                  <p className="text-sm font-bold uppercase underline tracking-wide">
                    {modeConfig.title}
                  </p>
                </div>

                {StudentInfo}

                {/* GRADE TABLE */}
                <div className="px-1">
                  {!hasGrades ? (
                    <div className="py-10 text-center">
                      <User className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">
                        No grades recorded for {modeConfig.label}, {academicYear || '—'}.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Teachers enter grades via the Grade Entry page.
                      </p>
                    </div>
                  ) : isFullYear ? (

                    /* ── FULL ACADEMIC YEAR TABLE ── */
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-black px-2 py-0.5 text-left font-bold text-xs" rowSpan={2} style={{ width: '24%' }}>
                            Subjects
                          </th>
                          <th className={`${TH} text-[10px]`} colSpan={4}>1<sup>st</sup> Semester</th>
                          <th className={`${TH} text-[10px]`} colSpan={4}>2<sup>nd</sup> Semester</th>
                          <th className={`${TH} text-[10px]`} rowSpan={2} style={{ verticalAlign: 'middle' }}>
                            Final<br />Ave
                          </th>
                        </tr>
                        <tr>
                          <th className={TH}>1st PD</th>
                          <th className={TH}>2nd PD</th>
                          <th className={TH}>Exam</th>
                          <th className={TH}>Ave</th>
                          <th className={TH}>3rd PD</th>
                          <th className={TH}>4th PD</th>
                          <th className={TH}>Exam</th>
                          <th className={TH}>Ave</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.id}>
                            <td className="border border-black px-2 py-0.5 font-medium text-xs">{row.name}</td>
                            <td className={TD}>{row.p1 ?? ''}</td>
                            <td className={TD}>{row.p2 ?? ''}</td>
                            <td className={TD}>{row.p3 ?? ''}</td>
                            <td className={`${TD} font-semibold`}>{fmt(s1Avgs[i])}</td>
                            <td className={TD}>{row.p4 ?? ''}</td>
                            <td className={TD}>{row.p5 ?? ''}</td>
                            <td className={TD}>{row.p6 ?? ''}</td>
                            <td className={`${TD} font-semibold`}>{fmt(s2Avgs[i])}</td>
                            <td className={`${TD} font-bold`}>{fmt(finalAvgs[i])}</td>
                          </tr>
                        ))}

                        {/* Average row */}
                        <tr className="bg-gray-50">
                          <td className="border border-black px-2 py-0.5 text-xs font-bold">Average</td>
                          <td className={TD}>{fmt(colP1)}</td>
                          <td className={TD}>{fmt(colP2)}</td>
                          <td className={TD}>{fmt(colP3)}</td>
                          <td className={`${TD} font-semibold`}>{fmt(colS1)}</td>
                          <td className={TD}>{fmt(colP4)}</td>
                          <td className={TD}>{fmt(colP5)}</td>
                          <td className={TD}>{fmt(colP6)}</td>
                          <td className={`${TD} font-semibold`}>{fmt(colS2)}</td>
                          <td className={`${TD} font-bold`}>{fmt(colFinal)}</td>
                        </tr>

                        {/* Conduct row */}
                        <tr>
                          <td className="border border-black px-2 py-0.5 text-xs font-bold">Conduct</td>
                          <td className={TD}>{colP1  != null ? conductLabel(colP1)  : ''}</td>
                          <td className={TD}>{colP2  != null ? conductLabel(colP2)  : ''}</td>
                          <td className={TD}>{colP3  != null ? conductLabel(colP3)  : ''}</td>
                          <td className={`${TD} font-semibold`}>{colS1  != null ? conductLabel(colS1)  : ''}</td>
                          <td className={TD}>{colP4  != null ? conductLabel(colP4)  : ''}</td>
                          <td className={TD}>{colP5  != null ? conductLabel(colP5)  : ''}</td>
                          <td className={TD}>{colP6  != null ? conductLabel(colP6)  : ''}</td>
                          <td className={`${TD} font-semibold`}>{colS2  != null ? conductLabel(colS2)  : ''}</td>
                          <td className={`${TD} font-bold`}>{colFinal != null ? conductLabel(colFinal) : ''}</td>
                        </tr>

                        {/* Rank row */}
                        <tr>
                          <td className="border border-black px-2 py-0.5 text-xs font-bold">Rank</td>
                          <td className={TD}>{fmtRank(p1Ranks.get(selectedId))}</td>
                          <td className={TD}>{fmtRank(p2Ranks.get(selectedId))}</td>
                          <td className={TD}>{fmtRank(p3Ranks.get(selectedId))}</td>
                          <td className={`${TD} font-semibold`}>{fmtRank(sem1Ranks.get(selectedId))}</td>
                          <td className={TD}>{fmtRank(p4Ranks.get(selectedId))}</td>
                          <td className={TD}>{fmtRank(p5Ranks.get(selectedId))}</td>
                          <td className={TD}>{fmtRank(p6Ranks.get(selectedId))}</td>
                          <td className={`${TD} font-semibold`}>{fmtRank(sem2Ranks.get(selectedId))}</td>
                          <td className={`${TD} font-bold`}>{fmtRank(fullYearRanks.get(selectedId))}</td>
                        </tr>
                      </tbody>
                    </table>

                  ) : (

                    /* ── SEMESTER TABLE (sem1 or sem2) ── */
                    (() => {
                      const pdRows   = isSem1
                        ? rows.map((r, i) => ({ pd1: r.p1, pd2: r.p2, exam: r.p3, semAve: s1Avgs[i] }))
                        : rows.map((r, i) => ({ pd1: r.p4, pd2: r.p5, exam: r.p6, semAve: s2Avgs[i] }));
                      const cPd1  = isSem1 ? colP1 : colP4;
                      const cPd2  = isSem1 ? colP2 : colP5;
                      const cExam = isSem1 ? colP3 : colP6;
                      const cAve  = isSem1 ? colS1 : colS2;
                      const rPd1  = isSem1 ? p1Ranks  : p4Ranks;
                      const rPd2  = isSem1 ? p2Ranks  : p5Ranks;
                      const rExam = isSem1 ? p3Ranks  : p6Ranks;
                      const rSem  = isSem1 ? sem1Ranks : sem2Ranks;
                      const ord   = isSem1 ? '1st' : '2nd';
                      return (
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border border-black px-3 py-1 text-left font-bold uppercase text-xs align-bottom" rowSpan={2} style={{ width: '38%' }}>
                                Subjects
                              </th>
                              <th className={TH}>1<sup>st</sup></th>
                              <th className={TH}>2<sup>nd</sup></th>
                              <th className={TH}>{ord} Sem</th>
                              <th className={TH}>{ord} Sem</th>
                            </tr>
                            <tr>
                              <th className={TH}>PD</th>
                              <th className={TH}>PD</th>
                              <th className={TH}>Exam</th>
                              <th className={TH}>Ave</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={row.id}>
                                <td className="border border-black px-3 py-0.5 font-medium text-xs">{row.name}</td>
                                <td className={TD}>{pdRows[i].pd1 ?? ''}</td>
                                <td className={TD}>{pdRows[i].pd2 ?? ''}</td>
                                <td className={TD}>{pdRows[i].exam ?? ''}</td>
                                <td className={`${TD} font-semibold`}>{fmt(pdRows[i].semAve)}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50">
                              <td className="border border-black px-3 py-0.5 text-xs font-bold">Average</td>
                              <td className={TD}>{fmt(cPd1)}</td>
                              <td className={TD}>{fmt(cPd2)}</td>
                              <td className={TD}>{fmt(cExam)}</td>
                              <td className={`${TD} font-semibold`}>{fmt(cAve)}</td>
                            </tr>
                            <tr>
                              <td className="border border-black px-3 py-0.5 text-xs font-bold">Conduct</td>
                              <td className={TD}>{cPd1  != null ? conductLabel(cPd1)  : ''}</td>
                              <td className={TD}>{cPd2  != null ? conductLabel(cPd2)  : ''}</td>
                              <td className={TD}>{cExam != null ? conductLabel(cExam) : ''}</td>
                              <td className={`${TD} font-semibold`}>{cAve  != null ? conductLabel(cAve)  : ''}</td>
                            </tr>
                            <tr>
                              <td className="border border-black px-3 py-0.5 text-xs font-bold">Rank</td>
                              <td className={TD}>{fmtRank(rPd1.get(selectedId))}</td>
                              <td className={TD}>{fmtRank(rPd2.get(selectedId))}</td>
                              <td className={TD}>{fmtRank(rExam.get(selectedId))}</td>
                              <td className={`${TD} font-semibold`}>{fmtRank(rSem.get(selectedId))}</td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()
                  )}
                </div>

                {/* SIGNATURE SECTION */}
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
