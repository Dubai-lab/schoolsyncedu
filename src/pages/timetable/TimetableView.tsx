import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { classService, timetableService } from '@/services/classService';
import { examTimetableService, EXAM_PERIODS } from '@/services/examTimetableService';
import type { ExamTimetableEntry } from '@/services/examTimetableService';
import type { DayOfWeek } from '@/types/common.types';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Clock, MapPin, Pencil, Printer, Calendar, ClipboardList, BookOpen } from 'lucide-react';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

type TimetableRow = {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subjects: { id: string; name: string; code: string } | null;
  users: { id: string; first_name: string; last_name: string } | null;
  location: string | null;
};

const PERIOD_BG = [
  'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-amber-50',
  'bg-pink-50', 'bg-teal-50', 'bg-indigo-50', 'bg-orange-50',
];

function getColor(subjectId: string): string {
  let h = 0;
  for (let i = 0; i < subjectId.length; i++) h = subjectId.charCodeAt(i) + ((h << 5) - h);
  return PERIOD_BG[Math.abs(h) % PERIOD_BG.length];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TimetableView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const isAdmin = ['super_admin', 'principal', 'vice_principal', 'admin_staff', 'it_admin'].includes(
    user?.role ?? '',
  );

  const [activeTab, setActiveTab] = useState<'class' | 'exam'>('class');
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Classes
  const { data: classesData } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );

  const classOptions = (classesData?.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  const selectedClass = (classesData?.data ?? []).find((c) => c.id === classId);

  // Class timetable entries
  const { data: entries, isLoading } = useFetch(
    ['timetable', classId, academicYear],
    () => timetableService.listByClass(classId, academicYear),
    { enabled: !!classId && activeTab === 'class' },
  );

  // Exam timetable entries
  const { data: examEntries, isLoading: loadingExam } = useFetch(
    ['exam-timetable', classId, academicYear],
    () => examTimetableService.listByClass(classId, academicYear),
    { enabled: !!classId && activeTab === 'exam' },
  );

  // Group class entries by day
  const grid = useMemo(() => {
    const map: Record<string, TimetableRow[]> = {};
    DAYS.forEach((d) => (map[d] = []));
    (entries ?? []).forEach((e) => {
      const row = e as unknown as TimetableRow;
      if (map[row.day_of_week]) map[row.day_of_week].push(row);
    });
    DAYS.forEach((d) => map[d].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [entries]);

  const flatEntries = useMemo(() => {
    const dayOrder: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };
    return Object.values(grid).flat().sort((a, b) =>
      (dayOrder[a.day_of_week] ?? 0) - (dayOrder[b.day_of_week] ?? 0) || a.start_time.localeCompare(b.start_time),
    );
  }, [grid]);

  // Group exam entries by period + type
  const examByPeriod = useMemo(() => {
    const map: Record<number, { tests: ExamTimetableEntry[]; exams: ExamTimetableEntry[] }> = {};
    for (let i = 1; i <= 6; i++) map[i] = { tests: [], exams: [] };
    (examEntries ?? []).forEach((e) => {
      if (e.entry_type === 'test') map[e.period_number].tests.push(e);
      else map[e.period_number].exams.push(e);
    });
    return map;
  }, [examEntries]);

  const totalPeriods = flatEntries.length;
  const totalExamEntries = (examEntries ?? []).length;

  const handlePrint = () => window.print();

  const viewModeOptions = [
    { label: 'Grid View', value: 'grid' },
    { label: 'List View', value: 'list' },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Timetable' }]} />

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'class' ? 'Class Timetable' : 'Test & Exam Schedule'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === 'class' ? 'View weekly class schedules' : 'View test and semester exam schedule'}
          </p>
        </div>
        <div className="flex gap-2">
          {classId && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => navigate('/timetable/builder')}>
              <Pencil className="mr-1 h-4 w-4" /> Edit Timetable
            </Button>
          )}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit print:hidden">
        <button
          onClick={() => setActiveTab('class')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Calendar className="h-4 w-4" /> Class Timetable
        </button>
        <button
          onClick={() => setActiveTab('exam')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'exam' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardList className="h-4 w-4" /> Test &amp; Exam Schedule
        </button>
      </div>

      {/* Selectors */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select label="Class" options={classOptions} value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Select a class" />
          </div>
          <div className="w-40">
            <Input label="Academic Year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
          </div>
          {activeTab === 'class' && (
            <div className="w-36">
              <Select label="View" options={viewModeOptions} value={viewMode} onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')} />
            </div>
          )}
          {selectedClass && (
            <div className="flex items-center gap-2 pb-2">
              <Badge variant="info">{selectedClass.grade_level}</Badge>
              {selectedClass.section && <Badge variant="default">{selectedClass.section}</Badge>}
              <span className="text-sm text-slate-500">
                {activeTab === 'class'
                  ? `${totalPeriods} period${totalPeriods !== 1 ? 's' : ''}`
                  : `${totalExamEntries} entries`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">
          {selectedClass?.name ?? 'Class'} — {activeTab === 'class' ? 'Class Timetable' : 'Test & Exam Schedule'} — {academicYear}
        </h2>
        <p className="text-sm text-slate-500">
          {selectedClass?.grade_level} {selectedClass?.section ? `Section ${selectedClass.section}` : ''}
        </p>
      </div>

      {/* ── CLASS TIMETABLE ─────────────────────────────────────────────────── */}
      {activeTab === 'class' && (
        !classId ? (
          <Card className="p-12 text-center">
            <p className="text-slate-400">Select a class to view its timetable.</p>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {DAYS.map((d) => (
              <div key={d} className="space-y-2">
                <div className="h-8 rounded bg-slate-100 animate-pulse" />
                <div className="h-20 rounded bg-slate-50 animate-pulse" />
                <div className="h-20 rounded bg-slate-50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] grid grid-cols-5 gap-3">
              {DAYS.map((day) => (
                <div key={day}>
                  <div className="text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-t-lg py-2">{day}</div>
                  <div className="space-y-1.5 mt-1.5">
                    {grid[day].length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-lg">No periods</div>
                    ) : (
                      grid[day].map((entry) => {
                        const bg = entry.subjects?.id ? getColor(entry.subjects.id) : 'bg-slate-50';
                        return (
                          <div key={entry.id} className={`rounded-lg border border-slate-200 p-3 ${bg}`}>
                            <p className="text-sm font-semibold text-slate-800 truncate">{entry.subjects?.name ?? 'Unknown'}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1"><Clock className="h-3 w-3" />{entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}</div>
                            {entry.users && <p className="text-xs text-slate-600 mt-0.5">{entry.users.first_name} {entry.users.last_name}</p>}
                            {entry.location && <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><MapPin className="h-3 w-3" /> {entry.location}</div>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Card className="divide-y divide-slate-100">
            {flatEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No periods scheduled.</div>
            ) : (
              flatEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                  <Badge variant="default" className="w-24 justify-center text-center">{entry.day_of_week.slice(0, 3)}</Badge>
                  <div className="flex items-center gap-1 text-sm text-slate-500 w-32"><Clock className="h-3.5 w-3.5" />{entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{entry.subjects?.name ?? 'Unknown'}<span className="ml-1 text-xs text-slate-400">{entry.subjects?.code ?? ''}</span></p>
                    {entry.users && <p className="text-xs text-slate-500">{entry.users.first_name} {entry.users.last_name}</p>}
                  </div>
                  {entry.location && <div className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" /> {entry.location}</div>}
                </div>
              ))
            )}
          </Card>
        )
      )}

      {/* ── EXAM SCHEDULE ──────────────────────────────────────────────────── */}
      {activeTab === 'exam' && (
        !classId ? (
          <Card className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">Select a class to view its test &amp; exam schedule.</p>
          </Card>
        ) : loadingExam ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : (
          <div className="space-y-8">
            {[1, 2].map((sem) => (
              <div key={sem}>
                <div className="flex items-center gap-3 mb-3 print:mb-2">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 px-3 py-1 bg-slate-100 rounded-full print:bg-transparent print:text-slate-800 print:text-sm">
                    Semester {sem}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-3">
                  {EXAM_PERIODS.filter((p) => p.semester_number === sem).map((period) => {
                    const periodData = examByPeriod[period.period_number];
                    const hasEntries = (periodData?.tests.length ?? 0) + (periodData?.exams.length ?? 0) > 0;
                    return (
                      <Card key={period.term_name} className="overflow-hidden">
                        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                          <span className="text-sm font-bold text-slate-800">{period.label}</span>
                          {period.has_exam && (
                            <span className="rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold px-2 py-0.5">
                              + Semester {period.semester_number} Exam
                            </span>
                          )}
                          {!hasEntries && <span className="text-xs text-slate-400 ml-auto">Not scheduled</span>}
                        </div>
                        {hasEntries && (
                          <div className="divide-y divide-slate-50">
                            {/* Tests */}
                            {(periodData?.tests ?? []).map((e) => (
                              <ExamViewRow key={e.id} entry={e} typeLabel="Test" typeColor="blue" />
                            ))}
                            {/* Exams */}
                            {(periodData?.exams ?? []).map((e) => (
                              <ExamViewRow key={e.id} entry={e} typeLabel={`Semester ${period.semester_number} Exam`} typeColor="purple" />
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ExamViewRow({ entry, typeLabel, typeColor }: {
  entry: ExamTimetableEntry;
  typeLabel: string;
  typeColor: 'blue' | 'purple';
}) {
  const badgeClass = typeColor === 'blue'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-purple-100 text-purple-700';

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className={`rounded-full text-[11px] font-semibold px-2 py-0.5 flex-shrink-0 ${badgeClass}`}>
        {typeLabel}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <BookOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-800 truncate">
          {entry.subjects?.name ?? '—'}
          {entry.subjects?.code && <span className="ml-1 text-xs text-slate-400">({entry.subjects.code})</span>}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
        {entry.exam_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(entry.exam_date)}
          </span>
        )}
        {entry.start_time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {entry.start_time.slice(0, 5)}{entry.end_time ? ` – ${entry.end_time.slice(0, 5)}` : ''}
          </span>
        )}
        {entry.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {entry.location}
          </span>
        )}
        {entry.users && (
          <span className="text-slate-400">{entry.users.first_name} {entry.users.last_name}</span>
        )}
      </div>
    </div>
  );
}
