import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Clock, MapPin } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const dayColors: Record<string, string> = {
  Monday: 'border-l-blue-400',
  Tuesday: 'border-l-emerald-400',
  Wednesday: 'border-l-purple-400',
  Thursday: 'border-l-amber-400',
  Friday: 'border-l-rose-400',
};

function formatTime(t: string) {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

export default function TeacherSchedule() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const { data: schedule, isLoading } = useFetch(
    ['teacher-schedule', schoolId, teacherId],
    () => teacherService.getMySchedule(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  // Group by day
  const grouped = DAYS.map((day) => ({
    day,
    periods: (schedule ?? []).filter((p) => p.day_of_week === day),
  }));

  const totalPeriods = schedule?.length ?? 0;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Teacher Portal', href: '/teacher' },
          { label: 'My Schedule' },
        ]}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900">My Weekly Schedule</h1>
        <p className="text-sm text-slate-500">{totalPeriods} period{totalPeriods !== 1 ? 's' : ''} per week</p>
      </div>

      {isLoading ? (
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
                    <div
                      key={p.id}
                      className={`rounded-lg border border-l-4 bg-white p-4 shadow-sm hover:shadow transition ${dayColors[day] || 'border-l-slate-400'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{p.subject_name || 'Free Period'}</p>
                          {p.subject_code && <p className="text-xs text-slate-400 font-mono">{p.subject_code}</p>}
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {p.class_name}
                        </span>
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
      )}
    </div>
  );
}
