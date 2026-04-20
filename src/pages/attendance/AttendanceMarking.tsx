import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { attendanceService } from '@/services/attendanceService';
import { notify } from '@/components/shared/Toast';
import type { AttendanceStatus, AttendanceEntry } from '@/types/attendance.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Save, CheckCircle, XCircle, Clock, AlertTriangle, Users } from 'lucide-react';

// ==================== STATUS CONFIG ====================

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType; variant: 'success' | 'danger' | 'warning' | 'info' | 'default' }> = {
  present:       { label: 'Present',       color: 'bg-emerald-500', icon: CheckCircle,    variant: 'success' },
  absent:        { label: 'Absent',        color: 'bg-red-500',     icon: XCircle,        variant: 'danger' },
  late:          { label: 'Late',          color: 'bg-amber-500',   icon: Clock,          variant: 'warning' },
  excused:       { label: 'Excused',       color: 'bg-blue-500',    icon: AlertTriangle,  variant: 'info' },
  unexcused:     { label: 'Unexcused',     color: 'bg-orange-500',  icon: XCircle,        variant: 'warning' },
  medical_leave: { label: 'Medical Leave', color: 'bg-purple-500',  icon: AlertTriangle,  variant: 'default' },
};

const quickStatuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

// ==================== COMPONENT ====================

export default function AttendanceMarking() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<Map<string, AttendanceEntry>>(new Map());

  // Fetch classes
  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => attendanceService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch subjects for selected class
  const { data: classSubjects = [] } = useFetch(
    ['class-subjects-attendance', selectedClass],
    () => attendanceService.getClassSubjects(selectedClass),
    { enabled: !!selectedClass },
  );

  // Fetch students in selected class
  const { data: students, isLoading: studentsLoading } = useFetch(
    ['class-students', selectedClass],
    () => attendanceService.getClassStudents(selectedClass),
    { enabled: !!selectedClass },
  );

  // Fetch existing records for this class + subject + date
  const { data: existing } = useFetch(
    ['attendance', selectedClass, selectedSubject, selectedDate],
    () => attendanceService.getByClassDate(selectedClass, selectedDate, selectedSubject || undefined),
    { enabled: !!selectedClass && !!selectedSubject && !!selectedDate },
  );

  // Pre-fill entries from existing records
  useEffect(() => {
    if (existing && existing.length > 0) {
      const map = new Map<string, AttendanceEntry>();
      existing.forEach((r) => {
        map.set(r.student_id, {
          studentId: r.student_id,
          status: r.status,
          notes: r.notes ?? undefined,
        });
      });
      setEntries(map);
    } else if (students) {
      // Default all to present
      const map = new Map<string, AttendanceEntry>();
      students.forEach((s) => {
        map.set(s.id, { studentId: s.id, status: 'present' });
      });
      setEntries(map);
    }
  }, [existing, students]);

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) ?? { studentId, status: 'present' };
      next.set(studentId, { ...current, status });
      return next;
    });
  }, []);

  const markAllAs = useCallback((status: AttendanceStatus) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.forEach((entry, key) => {
        next.set(key, { ...entry, status });
      });
      return next;
    });
  }, []);

  // Save mutation
  const saveMutation = useMutate(
    () => attendanceService.markAttendance(
      selectedClass,
      selectedDate,
      Array.from(entries.values()),
      userId,
      selectedSubject || undefined,
    ),
    [['attendance', selectedClass, selectedSubject, selectedDate]],
    {
      onSuccess: () => notify.success('Attendance saved successfully'),
      onError: () => notify.error('Failed to save attendance'),
    },
  );

  const classOptions = (classes ?? []).map((c) => ({
    label: `${c.name} — ${c.grade_level || ''}${c.section ? ` (${c.section})` : ''}`,
    value: c.id,
  }));

  const subjectOptions = (classSubjects as { subjectId: string; name: string; code: string | null }[]).map((s) => ({
    label: s.name + (s.code ? ` (${s.code})` : ''),
    value: s.subjectId,
  }));

  // Stats
  const stats = { present: 0, absent: 0, late: 0, other: 0 };
  entries.forEach((e) => {
    if (e.status === 'present') stats.present++;
    else if (e.status === 'absent') stats.absent++;
    else if (e.status === 'late') stats.late++;
    else stats.other++;
  });
  const total = entries.size;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Attendance', href: '/attendance' },
        { label: 'Mark Attendance' },
      ]} />

      <h1 className="text-xl font-bold text-slate-900">Mark Attendance</h1>

      {/* Class, Subject & Date selectors */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          label="Class"
          options={classOptions}
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
          placeholder="Select a class"
          className="sm:w-72"
        />
        <Select
          label="Subject"
          options={subjectOptions}
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          placeholder={selectedClass ? 'Select subject' : 'Select class first'}
          className="sm:w-56"
          disabled={!selectedClass || subjectOptions.length === 0}
        />
        <Input
          label="Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="sm:w-44"
        />
      </div>

      {!selectedClass || !selectedSubject ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Users className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">
              {!selectedClass ? 'Select a class to begin.' : 'Select the subject you are teaching.'}
            </p>
          </CardContent>
        </Card>
      ) : studentsLoading ? (
        <LoadingSpinner fullPage label="Loading students..." />
      ) : !students || students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-400">No students assigned to this class.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Present" value={stats.present} total={total} color="text-emerald-600" bg="bg-emerald-50" />
            <MiniStat label="Absent" value={stats.absent} total={total} color="text-red-600" bg="bg-red-50" />
            <MiniStat label="Late" value={stats.late} total={total} color="text-amber-600" bg="bg-amber-50" />
            <MiniStat label="Other" value={stats.other} total={total} color="text-slate-600" bg="bg-slate-50" />
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">Mark all:</span>
            {quickStatuses.map((s) => (
              <button
                key={s}
                onClick={() => markAllAs(s)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {statusConfig[s].label}
              </button>
            ))}
          </div>

          {/* Student list */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{total} Students</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subjectOptions.find((s) => s.value === selectedSubject)?.label ?? ''} — {selectedDate}
                </p>
              </div>
              <Button
                size="sm"
                icon={<Save className="h-4 w-4" />}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate(undefined)}
              >
                Save Attendance
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {students.map((student) => {
                  const entry = entries.get(student.id);
                  const currentStatus = entry?.status ?? 'present';

                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50"
                    >
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                        {student.first_name[0]}{student.last_name[0]}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{student.registration_number}</p>
                      </div>

                      {/* Status buttons */}
                      <div className="flex items-center gap-1">
                        {quickStatuses.map((s) => {
                          const cfg = statusConfig[s];
                          const active = currentStatus === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setStatus(student.id, s)}
                              title={cfg.label}
                              className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-all ${
                                active
                                  ? `${cfg.color} text-white shadow-sm`
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              <cfg.icon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ==================== MINI STAT ====================

function MiniStat({ label, value, total, color, bg }: {
  label: string; value: number; total: number; color: string; bg: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`rounded-lg ${bg} px-4 py-3`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{pct}%</p>
    </div>
  );
}