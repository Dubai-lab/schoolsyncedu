import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { studentService } from '@/services/studentService';
import { classService } from '@/services/classService';
import { notify } from '@/components/shared/Toast';
import type { CreateStudentForm as FormData } from '@/types/student.types';
import type { Gender } from '@/types/common.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Save, ArrowLeft } from 'lucide-react';

// ==================== VALIDATION ====================

function validate(v: FormData): Partial<Record<keyof FormData, string>> {
  const e: Partial<Record<keyof FormData, string>> = {};
  if (!v.firstName.trim()) e.firstName = 'First name is required';
  if (!v.lastName.trim()) e.lastName = 'Last name is required';
  if (!v.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
  if (!v.gender) e.gender = 'Gender is required';
  if (!v.enrollmentDate) e.enrollmentDate = 'Enrollment date is required';
  if (!v.currentGradeLevel) e.currentGradeLevel = 'Grade level is required';
  return e;
}

// ==================== OPTIONS ====================

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const relationshipOptions = [
  { label: 'Mother', value: 'mother' },
  { label: 'Father', value: 'father' },
  { label: 'Guardian', value: 'guardian' },
  { label: 'Relative', value: 'relative' },
];

// ==================== DEFAULT VALUES ====================

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '' as Gender,
  enrollmentDate: new Date().toISOString().split('T')[0],
  currentGradeLevel: '',
  guardian: {
    relationship: 'mother',
    fullName: '',
    phone: '',
  },
};

// ==================== COMPONENT ====================

export default function StudentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  // Load real classes created by the principal
  const { data: classesResult } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classOptions = (classesResult?.data ?? []).map((c) => ({
    label: c.name + (c.grade_level ? ` (${c.grade_level})` : ''),
    value: c.name,   // stored in current_grade_level as the class name
    classId: c.id,
  }));

  // Fetch existing student for edit mode
  const { data: existing } = useFetch(
    ['student', id!],
    () => studentService.getById(id!),
    { enabled: isEdit },
  );

  const { values, errors, handleChange, handleSubmit, setValue, setValues } = useForm<FormData>({
    initialValues: emptyForm,
    validate,
    onSubmit: async (v) => {
      if (isEdit) {
        await updateMutation.mutateAsync({
          firstName: v.firstName,
          lastName: v.lastName,
          currentGradeLevel: v.currentGradeLevel,
          currentClassId: v.currentClassId,
          emergencyContactName: v.emergencyContactName,
          emergencyContactPhone: v.emergencyContactPhone,
        });
      } else {
        await createMutation.mutateAsync(v);
      }
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existing && isEdit) {
      const g = existing.guardians?.[0];
      setValues({
        firstName: existing.first_name,
        lastName: existing.last_name,
        dateOfBirth: existing.date_of_birth ?? '',
        gender: (existing.gender ?? '') as Gender,
        enrollmentDate: existing.enrollment_date ?? '',
        currentGradeLevel: existing.current_grade_level ?? '',
        currentClassId: existing.current_class_id ?? undefined,
        previousSchool: existing.previous_school ?? '',
        emergencyContactName: existing.emergency_contact_name ?? '',
        emergencyContactPhone: existing.emergency_contact_phone ?? '',
        guardian: {
          relationship: g?.relationship ?? 'mother',
          fullName: g?.full_name ?? '',
          phone: g?.phone ?? '',
          email: g?.email ?? '',
          address: g?.address ?? '',
          occupation: g?.occupation ?? '',
        },
      });
    }
  }, [existing, isEdit, setValues]);

  const createMutation = useMutate(
    (form: FormData) => studentService.create(schoolId, form),
    [['students']],
    {
      onSuccess: () => {
        notify.success('Student registered successfully');
        navigate('/students');
      },
      onError: () => notify.error('Failed to register student'),
    },
  );

  const updateMutation = useMutate(
    (form: Parameters<typeof studentService.update>[1]) => studentService.update(id!, form),
    [['students'], ['student', id!]],
    {
      onSuccess: () => {
        notify.success('Student updated');
        navigate(`/students/${id}`);
      },
      onError: () => notify.error('Failed to update student'),
    },
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5 max-w-3xl">
      <Breadcrumb items={[
        { label: 'Students', href: '/students' },
        { label: isEdit ? 'Edit Student' : 'New Student' },
      ]} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} icon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {isEdit ? 'Edit Student' : 'Register New Student'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Student info */}
        <Card>
          <CardHeader><CardTitle>Student Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First Name" name="firstName" value={values.firstName} onChange={handleChange} error={errors.firstName} />
            <Input label="Last Name" name="lastName" value={values.lastName} onChange={handleChange} error={errors.lastName} />
            <Input label="Date of Birth" name="dateOfBirth" type="date" value={values.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth} />
            <Select
              label="Gender"
              options={genderOptions}
              value={values.gender}
              onChange={(e) => setValue('gender', e.target.value as Gender)}
              placeholder="Select gender"
              error={errors.gender}
            />
            <Input label="Enrollment Date" name="enrollmentDate" type="date" value={values.enrollmentDate} onChange={handleChange} error={errors.enrollmentDate} />
            <Select
              label="Class"
              options={classOptions}
              value={values.currentGradeLevel}
              onChange={(e) => {
                setValue('currentGradeLevel', e.target.value);
                // Also set currentClassId from the matching class
                const cls = classOptions.find((c) => c.value === e.target.value);
                if (cls) setValue('currentClassId', cls.classId);
              }}
              placeholder={classOptions.length === 0 ? 'No classes yet — ask Principal' : 'Select class'}
              disabled={classOptions.length === 0}
              error={errors.currentGradeLevel}
            />
            <Input label="Previous School" name="previousSchool" value={values.previousSchool ?? ''} onChange={handleChange} />
            <div /> {/* spacer */}
            <Input label="Emergency Contact Name" name="emergencyContactName" value={values.emergencyContactName ?? ''} onChange={handleChange} />
            <Input label="Emergency Contact Phone" name="emergencyContactPhone" value={values.emergencyContactPhone ?? ''} onChange={handleChange} />
          </CardContent>
        </Card>

        {/* Guardian info */}
        <Card>
          <CardHeader><CardTitle>Primary Guardian</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name" name="guardian.fullName" value={values.guardian.fullName} onChange={(e) => setValue('guardian', { ...values.guardian, fullName: e.target.value })} />
            <Select
              label="Relationship"
              options={relationshipOptions}
              value={values.guardian.relationship}
              onChange={(e) => setValue('guardian', { ...values.guardian, relationship: e.target.value as 'mother' | 'father' | 'guardian' | 'relative' })}
            />
            <Input label="Phone" name="guardian.phone" value={values.guardian.phone} onChange={(e) => setValue('guardian', { ...values.guardian, phone: e.target.value })} />
            <Input label="Email" name="guardian.email" type="email" value={values.guardian.email ?? ''} onChange={(e) => setValue('guardian', { ...values.guardian, email: e.target.value })} />
            <Input label="Address" name="guardian.address" value={values.guardian.address ?? ''} onChange={(e) => setValue('guardian', { ...values.guardian, address: e.target.value })} />
            <Input label="Occupation" name="guardian.occupation" value={values.guardian.occupation ?? ''} onChange={(e) => setValue('guardian', { ...values.guardian, occupation: e.target.value })} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Save Changes' : 'Register Student'}
          </Button>
        </div>
      </form>
    </div>
  );
}