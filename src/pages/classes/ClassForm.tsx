import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { classService, subjectService, classSubjectService, classAssignmentService } from '@/services/classService';
import { registrarService } from '@/services/registrarService';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Save, Plus, Trash2, BookOpen, Users as UsersIcon } from 'lucide-react';
import { notify } from '@/components/shared/Toast';

export default function ClassForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const isEdit = !!id;

  const [form, setForm] = useState({ name: '', grade_level: '', section: '', capacity: '30', class_teacher_id: '', academic_year: '' });

  // Fetch class details for editing
  const { data: classData } = useFetch(
    ['class-detail', id ?? ''],
    () => classService.getById(id!),
    { enabled: isEdit },
  );

  useEffect(() => {
    if (classData) {
      setForm({
        name:             classData.name,
        grade_level:      classData.grade_level ?? '',
        section:          classData.section ?? '',
        capacity:         String(classData.capacity),
        class_teacher_id: classData.class_teacher_id ?? '',
        academic_year:    classData.academic_year ?? '',
      });
    }
  }, [classData]);

  // Subjects & students for the class
  const { data: classSubjects } = useFetch(
    ['class-subjects', id ?? ''],
    () => classSubjectService.listByClass(id!),
    { enabled: isEdit },
  );

  const { data: classStudents } = useFetch(
    ['class-assignments', id ?? ''],
    () => classAssignmentService.listByClass(id!),
    { enabled: isEdit },
  );

  const { data: allSubjects } = useFetch(
    ['subjects', schoolId],
    () => subjectService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Fetch teachers for this school
  const { data: teachers } = useFetch(
    ['school-teachers', schoolId],
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data;
    },
    { enabled: !!schoolId },
  );

  // Fetch current academic year from school settings
  const { data: currentAcademicYear } = useFetch(
    ['school-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  // Mutations
  const updateClass = useMutate(
    () => classService.update(id!, {
      name:             form.name,
      grade_level:      form.grade_level,
      section:          form.section || undefined,
      capacity:         Number(form.capacity),
      class_teacher_id: form.class_teacher_id || undefined,
      academic_year:    form.academic_year || undefined,
    }),
    [['classes'], ['class-detail']],
    { onSuccess: () => notify.success('Class updated') },
  );

  const createClass = useMutate(
    () => classService.create(schoolId, {
      name:          form.name,
      grade_level:   form.grade_level,
      section:       form.section || undefined,
      capacity:      Number(form.capacity),
      academic_year: form.academic_year || undefined,
    }),
    [['classes'], ['class-grade-levels']],
    { onSuccess: () => { notify.success('Class created'); navigate('/classes'); } },
  );

  // Assign subject dialog
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ subject_id: '', teacher_id: '', academic_year: '' });

  // Pre-fill academic year on both the class form (new class) and the subject form
  useEffect(() => {
    if (currentAcademicYear) {
      if (!isEdit && !form.academic_year) {
        setForm((f) => ({ ...f, academic_year: currentAcademicYear }));
      }
      if (!subjectForm.academic_year) {
        setSubjectForm((f) => ({ ...f, academic_year: currentAcademicYear }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAcademicYear]);

  const assignSubject = useMutate(
    () => classSubjectService.assign({
      class_id: id!,
      subject_id: subjectForm.subject_id,
      teacher_id: subjectForm.teacher_id,
      academic_year: subjectForm.academic_year,
    }),
    [['class-subjects']],
    { onSuccess: () => { setShowAddSubject(false); setSubjectForm((f) => ({ ...f, subject_id: '', teacher_id: '' })); } },
  );

  const removeSubject = useMutate(
    (csId: string) => classSubjectService.remove(csId),
    [['class-subjects']],
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.name.trim() && form.grade_level.trim();

  const subjectOptions = (allSubjects?.data ?? []).map((s) => ({
    label: `${s.name} (${s.code})`,
    value: s.id,
  }));

  const teacherOptions = (teachers ?? []).map((t) => ({
    label: `${t.first_name} ${t.last_name}`,
    value: t.id,
  }));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Classes', href: '/classes' }, { label: isEdit ? form.name || 'Edit' : 'New Class' }]} />

      <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Class' : 'Create Class'}</h1>

      {/* Basic Info */}
      <Card className="p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Class Details</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Class Name *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Grade 7A" />
            <Input label="Academic Year *" value={form.academic_year} onChange={(e) => set('academic_year', e.target.value)} placeholder="e.g. 2025-2026" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Grade Level *" value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)} placeholder="e.g. Grade 7" />
            <Input label="Section" value={form.section} onChange={(e) => set('section', e.target.value)} />
            <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </div>
          {isEdit && (
            <Select label="Class Teacher" options={teacherOptions} value={form.class_teacher_id}
              onChange={(e) => set('class_teacher_id', e.target.value)} placeholder="Select a teacher" />
          )}
          <div className="pt-2">
            <Button onClick={() => isEdit ? updateClass.mutate(undefined) : createClass.mutate(undefined)}
              loading={updateClass.isPending || createClass.isPending} disabled={!canSave}>
              <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Save Changes' : 'Create Class'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Subjects (edit only) */}
      {isEdit && (
        <Card className="p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Subjects ({(classSubjects ?? []).length})
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddSubject(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Subject
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {(classSubjects ?? []).length === 0 && <p className="text-sm text-slate-400 py-3">No subjects assigned.</p>}
            {(classSubjects ?? []).map((cs) => (
              <div key={cs.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-sm">{cs.subjects?.name}</span>
                  <Badge variant="info" size="sm" className="ml-2">{cs.subjects?.code}</Badge>
                  {cs.users && <span className="text-xs text-slate-500 ml-2">• {cs.users.first_name} {cs.users.last_name}</span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeSubject.mutate(cs.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Enrolled Students (read-only — assigned via registration) */}
      {isEdit && (
        <Card className="p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <UsersIcon className="h-4 w-4" /> Enrolled Students ({(classStudents ?? []).length})
            </h2>
            <p className="text-xs text-slate-400">Students are enrolled via the registration process</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {(classStudents ?? []).length === 0 && <p className="text-sm text-slate-400 py-3">No students enrolled in this class yet.</p>}
            {(classStudents ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm font-medium">{a.students.first_name} {a.students.last_name}</span>
                  <span className="text-xs text-slate-400 font-mono ml-2">{a.students.registration_number}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Subject Dialog */}
      <Dialog open={showAddSubject} onClose={() => setShowAddSubject(false)}>
        <DialogHeader><DialogTitle>Assign Subject</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select label="Subject *" options={subjectOptions} value={subjectForm.subject_id}
              onChange={(e) => setSubjectForm((f) => ({ ...f, subject_id: e.target.value }))}
              placeholder="Select subject" />
            <Select label="Teacher" options={teacherOptions} value={subjectForm.teacher_id}
              onChange={(e) => setSubjectForm((f) => ({ ...f, teacher_id: e.target.value }))}
              placeholder="Select teacher" />
            <Input label="Academic Year" value={subjectForm.academic_year}
              onChange={(e) => setSubjectForm((f) => ({ ...f, academic_year: e.target.value }))} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddSubject(false)}>Cancel</Button>
          <Button onClick={() => assignSubject.mutate(undefined)} loading={assignSubject.isPending}
            disabled={!subjectForm.subject_id}>
            Assign
          </Button>
        </DialogFooter>
      </Dialog>

    </div>
  );
}