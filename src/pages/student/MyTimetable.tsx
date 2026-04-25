import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { examTimetableService, EXAM_PERIODS } from '@/services/examTimetableService';
import type { ExamTimetableEntry } from '@/services/examTimetableService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Calendar,
  BookOpen,
  Clock,
  MapPin,
  User,
  ClipboardList,
  Printer,
} from 'lucide-react';

const PERIOD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-emerald-50 border-emerald-200 text-emerald-800',
  'bg-purple-50 border-purple-200 text-purple-800',
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-rose-50 border-rose-200 text-rose-800',
  'bg-cyan-50 border-cyan-200 text-cyan-800',
  'bg-indigo-50 border-indigo-200 text-indigo-800',
  'bg-orange-50 border-orange-200 text-orange-800',
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatTime(t: string | undefined) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function MyTimetable() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [activeTab, setActiveTab] = useState<'class' | 'exam'>('class');

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const classId = student?.current_class_id ?? '';
  const academicYear = '2025-2026';

  const { data: timetable = [], isLoading } = useFetch(
    ['my-timetable', schoolId, classId],
    () => studentPortalService.getMyTimetable(schoolId, classId),
    { enabled: !!schoolId && !!classId && activeTab === 'class' },
  );

  const { data: examEntries = [], isLoading: loadingExam } = useFetch(
    ['exam-timetable', classId, academicYear],
    () => examTimetableService.listByClass(classId, academicYear),
    { enabled: !!classId && activeTab === 'exam' },
  );

  // Group class timetable by day
  const byDay = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    WEEKDAYS.forEach(d => map.set(d, []));
    timetable.forEach((entry: Record<string, unknown>) => {
      const day = entry.day_of_week as string;
      if (day && map.has(day)) map.get(day)!.push(entry);
    });
    map.forEach((entries) => entries.sort((a, b) => String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''))));
    return map;
  }, [timetable]);

  // Color mapping for subjects
  const subjectColors = useMemo(() => {
    const subjects = new Set<string>();
    timetable.forEach((t: Record<string, unknown>) => {
      const sub = t.subjects as Record<string, unknown> | null;
      if (sub?.name) subjects.add(sub.name as string);
    });
    const cmap = new Map<string, string>();
    [...subjects].forEach((s, i) => cmap.set(s, PERIOD_COLORS[i % PERIOD_COLORS.length]));
    return cmap;
  }, [timetable]);

  // Group exam entries by period + type
  const examByPeriod = useMemo(() => {
    const map: Record<number, { tests: ExamTimetableEntry[]; exams: ExamTimetableEntry[] }> = {};
    for (let i = 1; i <= 6; i++) map[i] = { tests: [], exams: [] };
    (examEntries as ExamTimetableEntry[]).forEach((e) => {
      if (e.entry_type === 'test') map[e.period_number].tests.push(e);
      else map[e.period_number].exams.push(e);
    });
    return map;
  }, [examEntries]);

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Timetable' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <Calendar className="inline-block h-6 w-6 mr-2 text-blue-600" />
            My Timetable
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === 'class'
              ? `Your weekly class schedule${!classId ? ' — no class assigned' : ''}.`
              : 'Your upcoming tests and semester exams.'}
          </p>
        </div>
        {activeTab === 'exam' && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 print:hidden"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        )}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit print:hidden">
        <button
          onClick={() => setActiveTab('class')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Calendar className="h-4 w-4" /> Class Schedule
        </button>
        <button
          onClick={() => setActiveTab('exam')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'exam' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardList className="h-4 w-4" /> Test &amp; Exam Schedule
        </button>
      </div>

      {/* ── CLASS SCHEDULE ─────────────────────────────────────────────────── */}
      {activeTab === 'class' && (
        isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
          </div>
        ) : timetable.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-600">No timetable available</h3>
            <p className="text-sm text-slate-400 mt-1">
              {!classId ? 'You are not currently assigned to a class.' : 'Your class timetable has not been set up yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {WEEKDAYS.map((day) => {
              const entries = byDay.get(day) || [];
              const isToday = day === todayName;
              return (
                <Card key={day} className={`overflow-hidden ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                  <div className={`px-4 py-2.5 border-b ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                    <h3 className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                      {day} {isToday && <span className="ml-2 text-xs font-normal text-blue-500">(Today)</span>}
                    </h3>
                  </div>
                  {entries.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-400 text-center">No classes</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {entries.map((entry, i) => {
                        const subject = entry.subjects as Record<string, unknown> | null;
                        const teacher = entry.teachers as Record<string, unknown> | null;
                        const subName = (subject?.name as string) || 'Unknown';
                        const colorClass = subjectColors.get(subName) || PERIOD_COLORS[0];
                        return (
                          <div key={i} className="px-4 py-3 flex items-center gap-4">
                            <div className="w-20 flex-shrink-0 text-center">
                              <p className="text-xs font-medium text-slate-500">{formatTime(entry.start_time as string)}</p>
                              <p className="text-[10px] text-slate-400">{formatTime(entry.end_time as string)}</p>
                            </div>
                            <div className={`flex-1 rounded-lg border px-3 py-2.5 ${colorClass}`}>
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-semibold text-sm">{subName}</span>
                                {(subject?.code as string | undefined) && <span className="text-xs opacity-60">({subject!.code as string})</span>}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs opacity-75">
                                {teacher && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {(teacher.full_name as string) || (teacher.name as string) || 'TBA'}
                                  </span>
                                )}
                                {(entry.room as string | undefined) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {entry.room as string}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(entry.start_time as string)} – {formatTime(entry.end_time as string)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── EXAM SCHEDULE ──────────────────────────────────────────────────── */}
      {activeTab === 'exam' && (
        loadingExam ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
          </div>
        ) : !classId ? (
          <Card className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">You are not currently assigned to a class.</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Print header */}
            <div className="hidden print:block mb-2">
              <p className="text-lg font-bold">Test &amp; Exam Schedule — {academicYear}</p>
            </div>
            {[1, 2].map((sem) => (
              <div key={sem}>
                <div className="flex items-center gap-3 mb-3 print:mb-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 px-3 py-1 bg-slate-100 rounded-full print:bg-transparent print:text-slate-800">
                    Semester {sem}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-3">
                  {EXAM_PERIODS.filter((p) => p.semester_number === sem).map((period) => {
                    const data = examByPeriod[period.period_number];
                    const allEntries = [...(data?.tests ?? []), ...(data?.exams ?? [])];
                    return (
                      <Card key={period.term_name} className="overflow-hidden">
                        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                          <span className="text-sm font-bold text-slate-700">{period.label}</span>
                          {period.has_exam && (
                            <span className="rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold px-2 py-0.5">
                              + Semester {period.semester_number} Exam
                            </span>
                          )}
                          {allEntries.length === 0 && <span className="text-xs text-slate-400 ml-auto">Not scheduled yet</span>}
                        </div>
                        {allEntries.length > 0 && (
                          <div className="divide-y divide-slate-50">
                            {(data?.tests ?? []).map((e) => (
                              <StudentExamRow key={e.id} entry={e} label="Test" color="blue" />
                            ))}
                            {(data?.exams ?? []).map((e) => (
                              <StudentExamRow key={e.id} entry={e} label={`Semester ${period.semester_number} Exam`} color="purple" />
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

function StudentExamRow({ entry, label, color }: {
  entry: ExamTimetableEntry;
  label: string;
  color: 'blue' | 'purple';
}) {
  const badgeCls = color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`rounded-full text-[11px] font-semibold px-2 py-0.5 flex-shrink-0 ${badgeCls}`}>{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <BookOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-800 truncate">
          {entry.subjects?.name ?? '—'}
          {entry.subjects?.code && <span className="ml-1 text-xs text-slate-400">({entry.subjects.code})</span>}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 flex-shrink-0">
        {entry.exam_date && (
          <span className="flex items-center gap-1 font-medium text-slate-700">
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
      </div>
    </div>
  );
}
