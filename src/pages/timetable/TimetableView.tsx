import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { classService, timetableService } from '@/services/classService';
import type { DayOfWeek } from '@/types/common.types';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Clock, MapPin, Pencil, Printer } from 'lucide-react';

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

export default function TimetableView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const isAdmin = ['super_admin', 'principal', 'vice_principal', 'admin_staff', 'it_admin'].includes(
    user?.role ?? '',
  );

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

  // Timetable entries
  const { data: entries, isLoading } = useFetch(
    ['timetable', classId, academicYear],
    () => timetableService.listByClass(classId, academicYear),
    { enabled: !!classId },
  );

  // Group by day
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

  // Flat sorted list for list view
  const flatEntries = useMemo(() => {
    const dayOrder: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };
    return Object.values(grid)
      .flat()
      .sort((a, b) => (dayOrder[a.day_of_week] ?? 0) - (dayOrder[b.day_of_week] ?? 0) || a.start_time.localeCompare(b.start_time));
  }, [grid]);

  const totalPeriods = flatEntries.length;

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
          <h1 className="text-2xl font-bold text-slate-900">Class Timetable</h1>
          <p className="mt-1 text-sm text-slate-500">View weekly class schedules</p>
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

      {/* Selectors */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select
              label="Class"
              options={classOptions}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="Select a class"
            />
          </div>
          <div className="w-40">
            <Input
              label="Academic Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
          <div className="w-36">
            <Select
              label="View"
              options={viewModeOptions}
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
            />
          </div>
          {selectedClass && (
            <div className="flex items-center gap-2 pb-2">
              <Badge variant="info">{selectedClass.grade_level}</Badge>
              {selectedClass.section && <Badge variant="default">{selectedClass.section}</Badge>}
              <span className="text-sm text-slate-500">{totalPeriods} period{totalPeriods !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">
          {selectedClass?.name ?? 'Class'} Timetable — {academicYear}
        </h2>
        <p className="text-sm text-slate-500">
          {selectedClass?.grade_level} {selectedClass?.section ? `Section ${selectedClass.section}` : ''}
        </p>
      </div>

      {!classId ? (
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
        /* Grid View */
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] grid grid-cols-5 gap-3">
            {DAYS.map((day) => (
              <div key={day}>
                <div className="text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-t-lg py-2">
                  {day}
                </div>
                <div className="space-y-1.5 mt-1.5">
                  {grid[day].length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-lg">
                      No periods
                    </div>
                  ) : (
                    grid[day].map((entry) => {
                      const bg = entry.subjects?.id ? getColor(entry.subjects.id) : 'bg-slate-50';
                      return (
                        <div key={entry.id} className={`rounded-lg border border-slate-200 p-3 ${bg}`}>
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {entry.subjects?.name ?? 'Unknown'}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <Clock className="h-3 w-3" />
                            {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                          </div>
                          {entry.users && (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {entry.users.first_name} {entry.users.last_name}
                            </p>
                          )}
                          {entry.location && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin className="h-3 w-3" /> {entry.location}
                            </div>
                          )}
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
        /* List View */
        <Card className="divide-y divide-slate-100">
          {flatEntries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No periods scheduled.</div>
          ) : (
            flatEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                <Badge variant="default" className="w-24 justify-center text-center">
                  {entry.day_of_week.slice(0, 3)}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-slate-500 w-32">
                  <Clock className="h-3.5 w-3.5" />
                  {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {entry.subjects?.name ?? 'Unknown'}
                    <span className="ml-1 text-xs text-slate-400">{entry.subjects?.code ?? ''}</span>
                  </p>
                  {entry.users && (
                    <p className="text-xs text-slate-500">
                      {entry.users.first_name} {entry.users.last_name}
                    </p>
                  )}
                </div>
                {entry.location && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> {entry.location}
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
