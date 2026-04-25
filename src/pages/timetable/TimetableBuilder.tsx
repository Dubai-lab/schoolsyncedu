import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { classService, timetableService, classSubjectService, subjectService } from '@/services/classService';
import { staffService } from '@/services/staffService';
import { examTimetableService, EXAM_PERIODS } from '@/services/examTimetableService';
import type { ExamTimetableEntry, ExamEntryType } from '@/services/examTimetableService';
import type { DayOfWeek } from '@/types/common.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Trash2, Clock, MapPin, Eye, Copy, Calendar, BookOpen, ClipboardList } from 'lucide-react';
import { notify } from '@/components/shared/Toast';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_SLOTS = [
  '07:00', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30',
  '10:45', '11:00', '11:15', '11:30', '11:45', '12:00',
  '12:30', '13:00', '13:15', '13:30', '13:45', '14:00',
  '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '16:00',
];

type TimetableRow = {
  id: string;
  class_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subjects: { id: string; name: string; code: string } | null;
  users: { id: string; first_name: string; last_name: string } | null;
  location: string | null;
};

const PERIOD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-green-50 border-green-200 text-green-800',
  'bg-purple-50 border-purple-200 text-purple-800',
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-pink-50 border-pink-200 text-pink-800',
  'bg-teal-50 border-teal-200 text-teal-800',
  'bg-indigo-50 border-indigo-200 text-indigo-800',
  'bg-orange-50 border-orange-200 text-orange-800',
];

function getSubjectColor(subjectId: string): string {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  return PERIOD_COLORS[Math.abs(hash) % PERIOD_COLORS.length];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Default exam form ─────────────────────────────────────────────────────────
const defaultExamForm = {
  period_number: 1 as 1|2|3|4|5|6,
  term_name: 'p1',
  semester_number: 1 as 1|2,
  entry_type: 'test' as ExamEntryType,
  subject_id: '',
  teacher_id: '',
  exam_date: '',
  start_time: '08:00',
  end_time: '10:00',
  location: '',
  notes: '',
};

export default function TimetableBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'class' | 'exam'>('class');

  // ── Shared ───────────────────────────────────────────────────────────────────
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');

  // ── Class timetable state ────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<TimetableRow | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargetClassId, setCopyTargetClassId] = useState('');
  const [form, setForm] = useState({
    day_of_week: 'Monday' as DayOfWeek,
    start_time: '08:00',
    end_time: '08:45',
    subject_id: '',
    teacher_id: '',
    location: '',
  });

  // ── Exam timetable state ─────────────────────────────────────────────────────
  const [showExamForm, setShowExamForm]     = useState(false);
  const [editExamEntry, setEditExamEntry]   = useState<ExamTimetableEntry | null>(null);
  const [examForm, setExamForm]             = useState(defaultExamForm);

  // ── Fetches ──────────────────────────────────────────────────────────────────
  const { data: classesData } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: entries, isLoading: loadingEntries } = useFetch(
    ['timetable', classId, academicYear],
    () => timetableService.listByClass(classId, academicYear),
    { enabled: !!classId && activeTab === 'class' },
  );

  const { data: examEntries, isLoading: loadingExam } = useFetch(
    ['exam-timetable', classId, academicYear],
    () => examTimetableService.listByClass(classId, academicYear),
    { enabled: !!classId && activeTab === 'exam' },
  );

  // Subjects assigned to this class (for exam timetable)
  const { data: classSubjectsData } = useFetch(
    ['class-subjects', classId, academicYear],
    () => classSubjectService.listByClass(classId, academicYear),
    { enabled: !!classId },
  );

  const { data: staffData } = useFetch(
    ['staff-teachers', schoolId],
    () => staffService.list(schoolId, { role: 'teacher' as never, is_active: true }),
    { enabled: !!schoolId },
  );

  // ── Options ──────────────────────────────────────────────────────────────────
  const classOptions = (classesData?.data ?? []).map((c) => ({ label: c.name, value: c.id }));

  // All subjects for class timetable (school-wide)
  const { data: allSubjectsData } = useFetch(
    ['subjects', schoolId],
    () => subjectService.list(schoolId),
    { enabled: !!schoolId && activeTab === 'class' },
  );
  const subjectOptions = (allSubjectsData?.data ?? []).map((s) => ({
    label: `${s.name} (${s.code})`,
    value: s.id,
  }));

  // Class-assigned subjects for exam timetable
  type ClassSubjectWithJoin = { subject_id: string; subjects: { id: string; name: string; code: string } | null; users: { id: string } | null };
  const classSubjectOptions = ((classSubjectsData as ClassSubjectWithJoin[] | undefined) ?? []).map((cs) => {
    const sub = cs.subjects;
    return { label: sub ? `${sub.name} (${sub.code})` : cs.subject_id, value: sub?.id ?? cs.subject_id };
  });

  const teacherOptions = (staffData?.data ?? []).map((t) => ({
    label: `${t.first_name} ${t.last_name}`,
    value: t.id,
  }));

  const selectedClass = (classesData?.data ?? []).find((c) => c.id === classId);

  // ── Class timetable grid ─────────────────────────────────────────────────────
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

  const totalPeriods = Object.values(grid).reduce((sum, arr) => sum + arr.length, 0);

  // ── Exam entries grouped by period + type ────────────────────────────────────
  const examByPeriod = useMemo(() => {
    const map: Record<number, { tests: ExamTimetableEntry[]; exams: ExamTimetableEntry[] }> = {};
    for (let i = 1; i <= 6; i++) map[i] = { tests: [], exams: [] };
    (examEntries ?? []).forEach((e) => {
      if (e.entry_type === 'test') map[e.period_number].tests.push(e);
      else map[e.period_number].exams.push(e);
    });
    return map;
  }, [examEntries]);

  // ── Class timetable mutations ────────────────────────────────────────────────
  const addMutation = useMutate(
    (payload: { class_id: string; academic_year: string; day_of_week: DayOfWeek; start_time: string; end_time: string; subject_id: string; teacher_id: string; location?: string }) =>
      timetableService.create(payload),
    [['timetable', classId, academicYear]],
  );

  const updateMutation = useMutate(
    ({ id, ...rest }: { id: string; day_of_week?: DayOfWeek; start_time?: string; end_time?: string; subject_id?: string; teacher_id?: string; location?: string }) =>
      timetableService.update(id, rest),
    [['timetable', classId, academicYear]],
  );

  const deleteMutation = useMutate(
    (id: string) => timetableService.delete(id),
    [['timetable', classId, academicYear]],
  );

  const copyMutation = useMutate(
    async (targetClassId: string) => {
      for (const e of (entries ?? [])) {
        const row = e as unknown as TimetableRow;
        await timetableService.create({
          class_id: targetClassId,
          academic_year: academicYear,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          subject_id: row.subjects?.id ?? '',
          teacher_id: row.users?.id ?? '',
          location: row.location ?? undefined,
        });
      }
    },
    [['timetable']],
  );

  // ── Exam timetable mutations ─────────────────────────────────────────────────
  const addExamMutation = useMutate(
    (payload: Parameters<typeof examTimetableService.create>[0]) =>
      examTimetableService.create(payload),
    [['exam-timetable', classId, academicYear]],
  );

  const updateExamMutation = useMutate(
    ({ id, ...rest }: { id: string } & Parameters<typeof examTimetableService.update>[1]) =>
      examTimetableService.update(id, rest),
    [['exam-timetable', classId, academicYear]],
  );

  const deleteExamMutation = useMutate(
    (id: string) => examTimetableService.delete(id),
    [['exam-timetable', classId, academicYear]],
  );

  // ── Class timetable handlers ──────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.subject_id || !form.teacher_id) { notify.error('Subject and teacher are required'); return; }
    try {
      await addMutation.mutateAsync({ class_id: classId, academic_year: academicYear, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, subject_id: form.subject_id, teacher_id: form.teacher_id, location: form.location || undefined });
      notify.success('Period added');
      setShowAdd(false);
      resetForm();
    } catch { notify.error('Failed to add period'); }
  };

  const handleEdit = async () => {
    if (!editEntry) return;
    try {
      await updateMutation.mutateAsync({ id: editEntry.id, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, subject_id: form.subject_id, teacher_id: form.teacher_id, location: form.location || undefined });
      notify.success('Period updated');
      setEditEntry(null);
      resetForm();
    } catch { notify.error('Failed to update period'); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); notify.success('Period removed'); }
    catch { notify.error('Failed to delete'); }
  };

  const handleCopy = async () => {
    if (!copyTargetClassId) { notify.error('Select a target class'); return; }
    try { await copyMutation.mutateAsync(copyTargetClassId); notify.success('Timetable copied'); setShowCopy(false); setCopyTargetClassId(''); }
    catch { notify.error('Failed to copy timetable'); }
  };

  const openEditDialog = (entry: TimetableRow) => {
    setEditEntry(entry);
    setForm({ day_of_week: entry.day_of_week, start_time: entry.start_time.slice(0, 5), end_time: entry.end_time.slice(0, 5), subject_id: entry.subjects?.id ?? '', teacher_id: entry.users?.id ?? '', location: entry.location ?? '' });
  };

  const openAddForDay = (day: DayOfWeek) => { resetForm(); setForm((f) => ({ ...f, day_of_week: day })); setShowAdd(true); };
  const resetForm = () => setForm({ day_of_week: 'Monday', start_time: '08:00', end_time: '08:45', subject_id: '', teacher_id: '', location: '' });

  // ── Exam form handlers ────────────────────────────────────────────────────────
  const openAddExam = (periodNumber: number, entryType: ExamEntryType) => {
    const period = EXAM_PERIODS.find((p) => p.period_number === periodNumber)!;
    setEditExamEntry(null);
    setExamForm({
      ...defaultExamForm,
      period_number:   period.period_number as 1|2|3|4|5|6,
      term_name:       period.term_name,
      semester_number: period.semester_number as 1|2,
      entry_type:      entryType,
    });
    setShowExamForm(true);
  };

  const openEditExam = (entry: ExamTimetableEntry) => {
    setEditExamEntry(entry);
    setExamForm({
      period_number:   entry.period_number as 1|2|3|4|5|6,
      term_name:       entry.term_name,
      semester_number: entry.semester_number as 1|2,
      entry_type:      entry.entry_type,
      subject_id:      entry.subject_id ?? '',
      teacher_id:      entry.teacher_id ?? '',
      exam_date:       entry.exam_date ?? '',
      start_time:      entry.start_time?.slice(0, 5) ?? '08:00',
      end_time:        entry.end_time?.slice(0, 5) ?? '10:00',
      location:        entry.location ?? '',
      notes:           entry.notes ?? '',
    });
    setShowExamForm(true);
  };

  // Auto-fill teacher when subject is selected (from class_subjects)
  const handleExamSubjectChange = (subjectId: string) => {
    const csData = (classSubjectsData as ClassSubjectWithJoin[] | undefined) ?? [];
    const cs = csData.find((c) => (c.subjects?.id ?? c.subject_id) === subjectId);
    setExamForm((f) => ({ ...f, subject_id: subjectId, teacher_id: cs?.users?.id ?? f.teacher_id }));
  };

  const handleSaveExam = async () => {
    if (!examForm.subject_id) { notify.error('Subject is required'); return; }
    try {
      if (editExamEntry) {
        await updateExamMutation.mutateAsync({
          id:          editExamEntry.id,
          subject_id:  examForm.subject_id,
          teacher_id:  examForm.teacher_id || undefined,
          exam_date:   examForm.exam_date || undefined,
          start_time:  examForm.start_time || undefined,
          end_time:    examForm.end_time || undefined,
          location:    examForm.location || undefined,
          notes:       examForm.notes || undefined,
        } as { id: string } & Parameters<typeof examTimetableService.update>[1]);
        notify.success('Entry updated');
      } else {
        await addExamMutation.mutateAsync({
          school_id:       schoolId,
          class_id:        classId,
          academic_year:   academicYear,
          term_name:       examForm.term_name,
          period_number:   examForm.period_number,
          semester_number: examForm.semester_number,
          entry_type:      examForm.entry_type,
          subject_id:      examForm.subject_id,
          teacher_id:      examForm.teacher_id || undefined,
          exam_date:       examForm.exam_date || undefined,
          start_time:      examForm.start_time || undefined,
          end_time:        examForm.end_time || undefined,
          location:        examForm.location || undefined,
          notes:           examForm.notes || undefined,
        });
        notify.success('Entry added');
      }
      setShowExamForm(false);
      setEditExamEntry(null);
      setExamForm(defaultExamForm);
    } catch { notify.error('Failed to save entry'); }
  };

  const handleDeleteExam = async (id: string) => {
    try { await deleteExamMutation.mutateAsync(id); notify.success('Entry removed'); }
    catch { notify.error('Failed to delete'); }
  };

  const copyTargetOptions = classOptions.filter((c) => c.value !== classId);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Timetable', href: '/timetable' }, { label: 'Builder' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable Builder</h1>
          <p className="mt-1 text-sm text-slate-500">Create and manage class schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/timetable')}>
            <Eye className="mr-1 h-4 w-4" /> View Mode
          </Button>
          {activeTab === 'class' && classId && totalPeriods > 0 && (
            <Button variant="outline" onClick={() => setShowCopy(true)}>
              <Copy className="mr-1 h-4 w-4" /> Copy To…
            </Button>
          )}
          {activeTab === 'class' && classId && (
            <Button onClick={() => { resetForm(); setShowAdd(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Add Period
            </Button>
          )}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
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
          <ClipboardList className="h-4 w-4" /> Test &amp; Exam Timetable
        </button>
      </div>

      {/* Class & Year Selector */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select label="Class" options={classOptions} value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Select a class" />
          </div>
          <div className="w-40">
            <Input label="Academic Year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
          </div>
          {selectedClass && (
            <div className="flex items-center gap-2 pb-2">
              <Badge variant="info">{selectedClass.grade_level}</Badge>
              {selectedClass.section && <Badge variant="default">{selectedClass.section}</Badge>}
              {activeTab === 'class' && <span className="text-sm text-slate-500">{totalPeriods} periods scheduled</span>}
              {activeTab === 'exam' && <span className="text-sm text-slate-500">{(examEntries ?? []).length} exam entries</span>}
            </div>
          )}
        </div>
      </Card>

      {/* ── CLASS TIMETABLE ────────────────────────────────────────────────────── */}
      {activeTab === 'class' && (
        classId ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] grid grid-cols-5 gap-3">
              {DAYS.map((day) => (
                <div key={day}>
                  <div className="flex items-center justify-between bg-slate-100 rounded-t-lg px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700">{day}</span>
                    <button onClick={() => openAddForDay(day)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" title={`Add period on ${day}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 mt-1.5 min-h-[200px]">
                    {loadingEntries ? (
                      Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)
                    ) : grid[day].length === 0 ? (
                      <div className="flex items-center justify-center text-xs text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors" onClick={() => openAddForDay(day)}>
                        <Plus className="h-4 w-4 mr-1" /> Add period
                      </div>
                    ) : (
                      grid[day].map((entry) => {
                        const colorClass = entry.subjects?.id ? getSubjectColor(entry.subjects.id) : 'bg-slate-50 border-slate-200';
                        return (
                          <div key={entry.id} onClick={() => openEditDialog(entry)} className={`rounded-lg border p-2.5 cursor-pointer group transition-all hover:shadow-sm ${colorClass}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{entry.subjects?.name ?? 'Unknown'}</p>
                                <p className="text-[10px] font-medium opacity-60 uppercase">{entry.subjects?.code ?? ''}</p>
                                <div className="flex items-center gap-1 text-xs opacity-70 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                                </div>
                                {entry.users && <p className="text-xs opacity-70 mt-0.5">{entry.users.first_name} {entry.users.last_name}</p>}
                                {entry.location && <div className="flex items-center gap-1 text-xs opacity-50 mt-0.5"><MapPin className="h-3 w-3" /> {entry.location}</div>}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-400 hover:text-red-600" title="Delete period">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
          <Card className="p-12 text-center">
            <p className="text-slate-400">Select a class to start building its timetable.</p>
          </Card>
        )
      )}

      {/* ── EXAM TIMETABLE ─────────────────────────────────────────────────────── */}
      {activeTab === 'exam' && (
        classId ? (
          loadingExam ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-8">
              {/* Semester 1 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 px-3 py-1 bg-slate-100 rounded-full">Semester 1</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-4">
                  {EXAM_PERIODS.filter((p) => p.semester_number === 1).map((period) => (
                    <ExamPeriodCard
                      key={period.term_name}
                      period={period}
                      tests={examByPeriod[period.period_number]?.tests ?? []}
                      exams={examByPeriod[period.period_number]?.exams ?? []}
                      onAddTest={() => openAddExam(period.period_number, 'test')}
                      onAddExam={() => openAddExam(period.period_number, 'exam')}
                      onEdit={openEditExam}
                      onDelete={handleDeleteExam}
                    />
                  ))}
                </div>
              </div>
              {/* Semester 2 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 px-3 py-1 bg-slate-100 rounded-full">Semester 2</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-4">
                  {EXAM_PERIODS.filter((p) => p.semester_number === 2).map((period) => (
                    <ExamPeriodCard
                      key={period.term_name}
                      period={period}
                      tests={examByPeriod[period.period_number]?.tests ?? []}
                      exams={examByPeriod[period.period_number]?.exams ?? []}
                      onAddTest={() => openAddExam(period.period_number, 'test')}
                      onAddExam={() => openAddExam(period.period_number, 'exam')}
                      onEdit={openEditExam}
                      onDelete={handleDeleteExam}
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <Card className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">Select a class to manage its test &amp; exam timetable.</p>
          </Card>
        )
      )}

      {/* ── Class Timetable Dialogs ──────────────────────────────────────────── */}
      <Dialog open={showAdd} onClose={() => setShowAdd(false)}>
        <DialogHeader><DialogTitle>Add Period</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Day" options={DAYS.map((d) => ({ label: d, value: d }))} value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value as DayOfWeek }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Start Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              <Select label="End Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <Select label="Subject" options={subjectOptions} value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))} placeholder="Select subject" />
            <Select label="Teacher" options={teacherOptions} value={form.teacher_id} onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))} placeholder="Select teacher" />
            <Input label="Location (optional)" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Room 201" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleAdd} loading={addMutation.isPending} disabled={!form.subject_id || !form.teacher_id}>Add Period</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!editEntry} onClose={() => setEditEntry(null)}>
        <DialogHeader><DialogTitle>Edit Period</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Day" options={DAYS.map((d) => ({ label: d, value: d }))} value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value as DayOfWeek }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Start Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              <Select label="End Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <Select label="Subject" options={subjectOptions} value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))} placeholder="Select subject" />
            <Select label="Teacher" options={teacherOptions} value={form.teacher_id} onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))} placeholder="Select teacher" />
            <Input label="Location (optional)" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Room 201" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
          <Button onClick={handleEdit} loading={updateMutation.isPending}>Save Changes</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={showCopy} onClose={() => setShowCopy(false)}>
        <DialogHeader><DialogTitle>Copy Timetable To Another Class</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="mb-3 text-sm text-slate-600">Copy all {totalPeriods} periods from <strong>{selectedClass?.name}</strong> to another class. Existing periods in the target class will not be removed.</p>
          <Select label="Target Class" options={copyTargetOptions} value={copyTargetClassId} onChange={(e) => setCopyTargetClassId(e.target.value)} placeholder="Select a class" />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCopy(false)}>Cancel</Button>
          <Button onClick={handleCopy} loading={copyMutation.isPending}>Copy Timetable</Button>
        </DialogFooter>
      </Dialog>

      {/* ── Exam Form Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showExamForm} onClose={() => { setShowExamForm(false); setEditExamEntry(null); }}>
        <DialogHeader>
          <DialogTitle>
            {editExamEntry ? 'Edit' : 'Add'}{' '}
            {examForm.entry_type === 'exam'
              ? `Semester ${examForm.semester_number} Exam`
              : `Period ${examForm.period_number} Test`}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              <span>
                <strong>Period {examForm.period_number}</strong> &mdash;{' '}
                {examForm.entry_type === 'exam'
                  ? `Semester ${examForm.semester_number} Exam (covers Periods ${examForm.semester_number === 1 ? '1–3' : '4–6'})`
                  : `Test (covers Period ${examForm.period_number} content)`}
              </span>
            </div>
            <Select
              label="Subject"
              options={classSubjectOptions.length > 0 ? classSubjectOptions : [{ label: 'No subjects assigned to this class', value: '' }]}
              value={examForm.subject_id}
              onChange={(e) => handleExamSubjectChange(e.target.value)}
              placeholder="Select subject"
            />
            <Select
              label="Invigilator / Teacher (optional)"
              options={teacherOptions}
              value={examForm.teacher_id}
              onChange={(e) => setExamForm((f) => ({ ...f, teacher_id: e.target.value }))}
              placeholder="Select teacher"
            />
            <Input
              label="Exam Date"
              type="date"
              value={examForm.exam_date}
              onChange={(e) => setExamForm((f) => ({ ...f, exam_date: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Start Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={examForm.start_time} onChange={(e) => setExamForm((f) => ({ ...f, start_time: e.target.value }))} />
              <Select label="End Time" options={TIME_SLOTS.map((t) => ({ label: t, value: t }))} value={examForm.end_time} onChange={(e) => setExamForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <Input label="Location (optional)" value={examForm.location} onChange={(e) => setExamForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Hall A" />
            <Input label="Notes (optional)" value={examForm.notes} onChange={(e) => setExamForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Bring calculator" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowExamForm(false); setEditExamEntry(null); }}>Cancel</Button>
          <Button onClick={handleSaveExam} loading={addExamMutation.isPending || updateExamMutation.isPending} disabled={!examForm.subject_id}>
            {editExamEntry ? 'Save Changes' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ── ExamPeriodCard sub-component ──────────────────────────────────────────────
type ExamPeriodMeta = typeof EXAM_PERIODS[number];

function ExamPeriodCard({
  period, tests, exams,
  onAddTest, onAddExam, onEdit, onDelete,
}: {
  period: ExamPeriodMeta;
  tests: ExamTimetableEntry[];
  exams: ExamTimetableEntry[];
  onAddTest: () => void;
  onAddExam: () => void;
  onEdit: (e: ExamTimetableEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">{period.label}</span>
          {period.has_exam && (
            <span className="rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold px-2 py-0.5">
              + Semester {period.semester_number} Exam
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{tests.length + exams.length} entries</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Tests section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">Tests</span>
            <button onClick={onAddTest} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="h-3.5 w-3.5" /> Add Test
            </button>
          </div>
          {tests.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No test scheduled yet.</p>
          ) : (
            <div className="space-y-1.5">
              {tests.map((e) => <ExamEntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          )}
        </div>

        {/* Exam section — only for periods 3 & 6 */}
        {period.has_exam && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                Semester {period.semester_number} Exam
              </span>
              <button onClick={onAddExam} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                <Plus className="h-3.5 w-3.5" /> Add Exam
              </button>
            </div>
            {exams.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No exam scheduled yet.</p>
            ) : (
              <div className="space-y-1.5">
                {exams.map((e) => <ExamEntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ExamEntryRow({
  entry, onEdit, onDelete,
}: {
  entry: ExamTimetableEntry;
  onEdit: (e: ExamTimetableEntry) => void;
  onDelete: (id: string) => void;
}) {
  const colorClass = entry.subjects?.id ? getSubjectColor(entry.subjects.id) : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div
      onClick={() => onEdit(entry)}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer group hover:shadow-sm transition-all ${colorClass}`}
    >
      <BookOpen className="h-4 w-4 flex-shrink-0 opacity-60" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold truncate">{entry.subjects?.name ?? '—'}</span>
        <span className="text-xs opacity-60 ml-1">({entry.subjects?.code})</span>
      </div>
      <div className="flex items-center gap-3 text-xs opacity-70 flex-shrink-0">
        {entry.exam_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(entry.exam_date)}
          </span>
        )}
        {entry.start_time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {entry.start_time.slice(0, 5)}{entry.end_time ? ` – ${entry.end_time.slice(0, 5)}` : ''}
          </span>
        )}
        {entry.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {entry.location}
          </span>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-400 hover:text-red-600"
        title="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
