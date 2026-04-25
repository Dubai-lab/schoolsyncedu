import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { examTimetableService, EXAM_PERIODS } from '@/services/examTimetableService';
import type { ExamTimetableEntry } from '@/services/examTimetableService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Clock, MapPin, Calendar, ClipboardList, BookOpen, Printer } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const dayColors: Record<string, string> = {
  Monday:    'border-l-blue-400',
  Tuesday:   'border-l-emerald-400',
  Wednesday: 'border-l-purple-400',
  Thursday:  'border-l-amber-400',
  Friday:    'border-l-rose-400',
};

function formatTime(t: string) {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TeacherSchedule() {
  const { user } = useAuth();
  const schoolId  = user?.school_id ?? '';
  const teacherId = user?.id ?? '';
  const academicYear = '2025-2026';

  const [activeTab, setActiveTab] = useState<'class' | 'exam'>('class');

  const { data: schedule, isLoading } = useFetch(
    ['teacher-schedule', schoolId, teacherId],
    () => teacherService.getMySchedule(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId && activeTab === 'class' },
  );

  const { data: examEntries = [], isLoading: loadingExam } = useFetch(
    ['teacher-exam-schedule', teacherId, schoolId, academicYear],
    () => examTimetableService.listByTeacher(teacherId, schoolId, academicYear),
    { enabled: !!teacherId && !!schoolId && activeTab === 'exam' },
  );

  const grouped = DAYS.map((day) => ({
    day,
    periods: (schedule ?? []).filter((p) => p.day_of_week === day),
  }));

  const totalPeriods = schedule?.length ?? 0;

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

  const totalExamEntries = (examEntries as ExamTimetableEntry[]).length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Teacher Portal', href: '/teacher' }, { label: 'My Schedule' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {activeTab === 'class' ? 'My Weekly Schedule' : 'My Test & Exam Schedule'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeTab === 'class'
              ? `${totalPeriods} period${totalPeriods !== 1 ? 's' : ''} per week`
              : `${totalExamEntries} exam entr${totalExamEntries !== 1 ? 'ies' : 'y'} this year`}
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
          <LoadingSpinner fullPage label="Loading schedule..." />
        ) : totalPeriods === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Clock className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No periods assigned yet. Contact your administrator.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ day, periods }) => (
              <div key={day}>
                <h2 className="mb-2 text-sm font-semibold text-slate-600 uppercase tracking-wide">{day}</h2>
                {periods.length === 0 ? (
                  <p className="text-sm text-slate-400 italic ml-1">No classes</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {periods.map((p) => (
                      <div key={p.id} className={`rounded-lg border border-l-4 bg-white p-4 shadow-sm hover:shadow transition ${dayColors[day] || 'border-l-slate-400'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-slate-800">{p.subject_name || 'Free Period'}</p>
                            {p.subject_code && <p className="text-xs text-slate-400 font-mono">{p.subject_code}</p>}
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{p.class_name}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(p.start_time)} – {formatTime(p.end_time)}
                          </span>
                          {p.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── EXAM SCHEDULE ──────────────────────────────────────────────────── */}
      {activeTab === 'exam' && (
        loadingExam ? (
          <LoadingSpinner fullPage label="Loading exam schedule..." />
        ) : totalExamEntries === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No test or exam entries assigned to you yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="hidden print:block mb-2">
              <p className="text-lg font-bold">My Test &amp; Exam Schedule — {academicYear}</p>
            </div>
            {[1, 2].map((sem) => {
              const semPeriods = EXAM_PERIODS.filter((p) => p.semester_number === sem);
              const semHasEntries = semPeriods.some((p) => {
                const d = examByPeriod[p.period_number];
                return (d?.tests.length ?? 0) + (d?.exams.length ?? 0) > 0;
              });
              if (!semHasEntries) return null;
              return (
                <div key={sem}>
                  <div className="flex items-center gap-3 mb-3 print:mb-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 px-3 py-1 bg-slate-100 rounded-full">
                      Semester {sem}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="space-y-3">
                    {semPeriods.map((period) => {
                      const data = examByPeriod[period.period_number];
                      const allEntries = [...(data?.tests ?? []), ...(data?.exams ?? [])];
                      if (allEntries.length === 0) return null;
                      return (
                        <Card key={period.term_name} className="overflow-hidden">
                          <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                            <span className="text-sm font-bold text-slate-700">{period.label}</span>
                            {period.has_exam && (
                              <span className="rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold px-2 py-0.5">
                                + Semester {period.semester_number} Exam
                              </span>
                            )}
                          </div>
                          <div className="divide-y divide-slate-50">
                            {(data?.tests ?? []).map((e) => (
                              <TeacherExamRow key={e.id} entry={e} label="Test" color="blue" />
                            ))}
                            {(data?.exams ?? []).map((e) => (
                              <TeacherExamRow key={e.id} entry={e} label={`Semester ${period.semester_number} Exam`} color="purple" />
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function TeacherExamRow({ entry, label, color }: {
  entry: ExamTimetableEntry;
  label: string;
  color: 'blue' | 'purple';
}) {
  const badgeCls = color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  const classMeta = entry.classes as { name?: string; grade_level?: string } | null | undefined;
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
      {classMeta?.name && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 flex-shrink-0">
          {classMeta.name}
        </span>
      )}
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
