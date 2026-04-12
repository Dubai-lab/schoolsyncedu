import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { classService, classSubjectService, classAssignmentService } from '@/services/classService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, Users, BookOpen, Calendar, Eye } from 'lucide-react';

type ClassRow = {
  id: string;
  name: string;
  gradeLevel: string;
  section: string;
  teacher: string;
  capacity: number;
};

const initialForm = { name: '', grade_level: '', section: '', capacity: '30' };

export default function ClassList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [gradeFilter, setGradeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);

  // Detail panel
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'students' | 'subjects'>('students');

  const { data: grades } = useFetch(
    ['class-grade-levels', schoolId],
    () => classService.getGradeLevels(schoolId),
    { enabled: !!schoolId },
  );

  const { data: result, isLoading } = useFetch(
    ['classes', schoolId, gradeFilter],
    () => classService.list(schoolId, gradeFilter || undefined),
    { enabled: !!schoolId },
  );

  const { data: students } = useFetch(
    ['class-assignments', selectedClass ?? ''],
    () => classAssignmentService.listByClass(selectedClass!),
    { enabled: !!selectedClass && detailTab === 'students' },
  );

  const { data: subjects } = useFetch(
    ['class-subjects', selectedClass ?? ''],
    () => classSubjectService.listByClass(selectedClass!),
    { enabled: !!selectedClass && detailTab === 'subjects' },
  );



  const createClass = useMutate(
    () => classService.create(schoolId, {
      name: form.name,
      grade_level: form.grade_level,
      section: form.section || undefined,
      capacity: Number(form.capacity) || 30,
    }),
    [['classes'], ['class-grade-levels']],
    { onSuccess: () => { setShowCreate(false); setForm(initialForm); } },
  );

  const deleteClass = useMutate(
    (id: string) => classService.delete(id),
    [['classes'], ['class-grade-levels']],
  );

  const rows: ClassRow[] = (result?.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    gradeLevel: c.grade_level ?? '',
    section: c.section ?? '',
    teacher: c.users ? `${c.users.first_name} ${c.users.last_name}` : '—',
    capacity: c.capacity,
  }));

  const gradeOptions = (grades ?? []).map((g) => ({ label: g, value: g }));

  const columns: Column<ClassRow>[] = [
    { key: 'name', header: 'Class Name', render: (r) => (
      <button className="font-medium text-primary-600 hover:underline" onClick={() => { setSelectedClass(r.id); setDetailTab('students'); }}>
        {r.name}
      </button>
    )},
    { key: 'gradeLevel', header: 'Grade', render: (r) => <Badge variant="info" size="sm">{r.gradeLevel}</Badge> },
    { key: 'section', header: 'Section', render: (r) => <span className="text-sm">{r.section || '—'}</span> },
    { key: 'teacher', header: 'Class Teacher' },
    { key: 'capacity', header: 'Capacity', render: (r) => <span className="text-sm font-medium">{r.capacity}</span> },
    { key: 'id', header: '', render: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => navigate(`/classes/${r.id}/edit`)}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => deleteClass.mutate(r.id)}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    )},
  ];

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Classes' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5" /> Classes
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/classes/timetable')}>
            <Calendar className="h-4 w-4 mr-1" /> Timetable
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Class
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select label="Grade Level" options={gradeOptions} value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          placeholder="All Grades" className="w-44" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Classes Table */}
        <div className={selectedClass ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No classes found." />
        </div>

        {/* Detail Panel */}
        {selectedClass && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {rows.find((r) => r.id === selectedClass)?.name ?? 'Class'}
              </h3>
              <button className="text-slate-400 hover:text-slate-600 text-sm" onClick={() => setSelectedClass(null)}>✕</button>
            </div>

            <div className="flex gap-1 border-b border-slate-200 pb-1">
              {(['students', 'subjects'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-lg ${
                    detailTab === t ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t === 'students' ? <><Users className="inline h-3.5 w-3.5 mr-1" />Students</> : <><BookOpen className="inline h-3.5 w-3.5 mr-1" />Subjects</>}
                </button>
              ))}
            </div>

            {detailTab === 'students' && (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(students ?? []).length === 0 && <p className="text-xs text-slate-400 py-2">No students assigned.</p>}
                {(students ?? []).map((a) => {
                  const s = a.students;
                  return (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 text-sm">
                      <span>{s.first_name} {s.last_name}</span>
                      <span className="text-xs text-slate-400 font-mono">{s.registration_number}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {detailTab === 'subjects' && (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {(subjects ?? []).length === 0 && <p className="text-xs text-slate-400 py-2">No subjects assigned.</p>}
                {(subjects ?? []).map((cs) => {
                  const subj = cs.subjects;
                  const teacher = cs.users;
                  return (
                    <div key={cs.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 text-sm">
                      <div>
                        <span className="font-medium">{subj?.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{subj?.code}</span>
                      </div>
                      <span className="text-xs text-slate-500">{teacher ? `${teacher.first_name} ${teacher.last_name}` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Create Class Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Create Class</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Class Name *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Grade 7A" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Grade Level *" value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)} placeholder="e.g. 7" />
              <Input label="Section" value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="e.g. A" />
            </div>
            <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createClass.mutate(undefined)} loading={createClass.isPending} disabled={!form.name || !form.grade_level}>
            Create
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}