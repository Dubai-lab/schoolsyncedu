import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { classService, timetableService, subjectService } from '@/services/classService';
import type { DayOfWeek } from '@/types/common.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Trash2, Clock, MapPin } from 'lucide-react';
import { notify } from '@/components/shared/Toast';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_SLOTS = [
  '07:30', '08:15', '09:00', '09:45', '10:30', '11:15',
  '12:00', '13:00', '13:45', '14:30', '15:15',
];

type TimetableRow = {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subjects: { id: string; name: string; code: string } | null;
  users: { id: string; first_name: string; last_name: string } | null;
  location: string | null;
};

export default function ClassTimetable() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');

  // Fetch classes for selector
  const { data: classesData } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );

  const classOptions = (classesData?.data ?? []).map((c) => ({ label: c.name, value: c.id }));

  // Timetable entries
  const { data: entries } = useFetch(
    ['timetable', classId, academicYear],
    () => timetableService.listByClass(classId, academicYear),
    { enabled: !!classId },
  );

  // Subjects
  const { data: subjectsData } = useFetch(
    ['subjects', schoolId],
    () => subjectService.list(schoolId),
    { enabled: !!schoolId },
  );

  const subjectOptions = (subjectsData?.data ?? []).map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }));

  // Group entries by day
  const grid = useMemo(() => {
    const map: Record<string, TimetableRow[]> = {};
    DAYS.forEach((d) => (map[d] = []));
    (entries ?? []).forEach((e) => {
      const row = e as unknown as TimetableRow;
      if (map[row.day_of_week]) map[row.day_of_week].push(row);
    });
    // sort each day by start_time
    DAYS.forEach((d) => map[d].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [entries]);

  // Add entry dialog
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    day_of_week: 'Monday' as DayOfWeek,
    start_time: '08:00',
    end_time: '08:45',
    subject_id: '',
    teacher_id: '',
    location: '',
  });

  const addEntry = useMutate(
    () => timetableService.create({
      class_id: classId,
      academic_year: academicYear,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      subject_id: form.subject_id,
      teacher_id: form.teacher_id,
      location: form.location || undefined,
    }),
    [['timetable']],
    {
      onSuccess: () => {
        notify.success('Period added');
        setShowAdd(false);
        setForm({ day_of_week: 'Monday', start_time: '08:00', end_time: '08:45', subject_id: '', teacher_id: '', location: '' });
      },
    },
  );

  const deleteEntry = useMutate(
    (id: string) => timetableService.delete(id),
    [['timetable']],
    { onSuccess: () => notify.success('Period removed') },
  );

  const selectedClass = (classesData?.data ?? []).find((c) => c.id === classId);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Classes', href: '/classes' }, { label: 'Timetable' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Class Timetable</h1>
        {classId && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Period
          </Button>
        )}
      </div>

      {/* Selectors */}
      <Card className="p-4">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Select label="Class" options={classOptions} value={classId}
              onChange={(e) => setClassId(e.target.value)} placeholder="Select a class" />
          </div>
          <div className="w-40">
            <Input label="Academic Year" value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)} />
          </div>
          {selectedClass && (
            <div className="pb-2">
              <Badge variant="info">{selectedClass.grade_level}</Badge>
              {selectedClass.section && <Badge variant="default" className="ml-1">{selectedClass.section}</Badge>}
            </div>
          )}
        </div>
      </Card>

      {/* Timetable Grid */}
      {classId ? (
        <div className="overflow-x-auto">
          <div className="min-w-[900px] grid grid-cols-5 gap-3">
            {DAYS.map((day) => (
              <div key={day}>
                <div className="text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-t-lg py-2">
                  {day}
                </div>
                <div className="space-y-1 mt-1">
                  {grid[day].length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">
                      No periods
                    </div>
                  )}
                  {grid[day].map((entry) => (
                    <div key={entry.id} className="bg-white border border-slate-200 rounded-lg p-2.5 group hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {entry.subjects?.name ?? 'Unknown'}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                          </div>
                          {entry.users && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {entry.users.first_name} {entry.users.last_name}
                            </p>
                          )}
                          {entry.location && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin className="h-3 w-3" /> {entry.location}
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteEntry.mutate(entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center text-slate-400">
          Select a class to view its timetable.
        </Card>
      )}

      {/* Add Period Dialog */}
      <Dialog open={showAdd} onClose={() => setShowAdd(false)}>
        <DialogHeader><DialogTitle>Add Period</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Day *" options={DAYS.map((d) => ({ label: d, value: d }))}
              value={form.day_of_week}
              onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value as DayOfWeek }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Start Time *"
                options={TIME_SLOTS.map((t) => ({ label: t, value: t }))}
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              <Select label="End Time *"
                options={TIME_SLOTS.map((t) => ({ label: t, value: t }))}
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <Select label="Subject *" options={subjectOptions} value={form.subject_id}
              onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
              placeholder="Select subject" />
            <Input label="Teacher ID *" value={form.teacher_id}
              onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}
              placeholder="Teacher UUID" />
            <Input label="Location" value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Room 201" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={() => addEntry.mutate(undefined)} loading={addEntry.isPending}
            disabled={!form.subject_id || !form.teacher_id}>
            Add Period
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}