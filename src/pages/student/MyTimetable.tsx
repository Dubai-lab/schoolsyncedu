import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Calendar,
  BookOpen,
  Clock,
  MapPin,
  User,
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

export default function MyTimetable() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const classId = student?.current_class_id ?? '';

  const { data: timetable = [], isLoading } = useFetch(
    ['my-timetable', schoolId, classId],
    () => studentPortalService.getMyTimetable(schoolId, classId),
    { enabled: !!schoolId && !!classId },
  );

  // Group by day_of_week
  const byDay = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    WEEKDAYS.forEach(d => map.set(d, []));
    timetable.forEach((entry: Record<string, unknown>) => {
      const day = entry.day_of_week as string;
      if (day && map.has(day)) {
        map.get(day)!.push(entry);
      }
    });
    // Sort each day by start_time
    map.forEach((entries) => {
      entries.sort((a, b) => String(a.start_time ?? '').localeCompare(String(b.start_time ?? '')));
    });
    return map;
  }, [timetable]);

  // Get unique subjects for color mapping
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

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  function formatTime(t: string | undefined) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Timetable' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Calendar className="inline-block h-6 w-6 mr-2 text-blue-600" />
          My Timetable
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your weekly class schedule{student?.current_class_id ? '' : ' — no class assigned'}.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : timetable.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">No timetable available</h3>
          <p className="text-sm text-slate-400 mt-1">
            {!classId
              ? 'You are not currently assigned to a class.'
              : 'Your class timetable has not been set up yet.'}
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
                            <p className="text-xs font-medium text-slate-500">
                              {formatTime(entry.start_time as string)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatTime(entry.end_time as string)}
                            </p>
                          </div>

                          <div className={`flex-1 rounded-lg border px-3 py-2.5 ${colorClass}`}>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="font-semibold text-sm">{subName}</span>
                              {subject?.code ? (
                                <span className="text-xs opacity-60">({subject.code as string})</span>
                              ) : null}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs opacity-75">
                              {teacher && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {(teacher.full_name as string) || (teacher.name as string) || 'TBA'}
                                </span>
                              )}
                              {entry.room ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.room as string}
                                </span>
                              ) : null}
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
      )}
    </div>
  );
}
