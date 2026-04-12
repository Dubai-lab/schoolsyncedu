import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { staffService } from '@/services/staffService';
import { registrarService } from '@/services/registrarService';
import { USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import type { SchoolSetting } from '@/types/application.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Save, UserCheck, UserX } from 'lucide-react';

const ROLE_OPTIONS = [
  { label: 'Principal', value: USER_ROLES.PRINCIPAL },
  { label: 'Vice Principal', value: USER_ROLES.VICE_PRINCIPAL },
  { label: 'Registrar', value: USER_ROLES.REGISTRAR },
  { label: 'Bursar', value: USER_ROLES.BURSAR },
  { label: 'Dean of Students', value: USER_ROLES.DEAN },
  { label: 'Admin Staff', value: USER_ROLES.ADMIN_STAFF },
  { label: 'IT Admin', value: USER_ROLES.IT_ADMIN },
  { label: 'Teacher', value: USER_ROLES.TEACHER },
  { label: 'Librarian', value: USER_ROLES.LIBRARIAN },
  { label: 'Guidance Counselor', value: USER_ROLES.COUNSELOR },
];

export default function StaffForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const isEdit = !!id;

  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '',
    role: USER_ROLES.TEACHER as UserRole, profile_photo_url: '',
    password: '',
  });

  // Fetch default staff password
  const { data: settingsData } = useFetch(
    ['school-settings', schoolId],
    () => registrarService.getAllSettings(schoolId),
    { enabled: !!schoolId && !isEdit },
  );

  const defaultStaffPassword = (() => {
    if (!settingsData) return '';
    const found = (settingsData as SchoolSetting[]).find((s) => s.setting_key === 'default_staff_password');
    return found?.setting_value ?? '';
  })();

  // Pre-fill password with default when it loads
  useEffect(() => {
    if (defaultStaffPassword && !form.password && !isEdit) {
      setForm((f) => ({ ...f, password: defaultStaffPassword }));
    }
  }, [defaultStaffPassword, isEdit]);

  const { data: staffMember } = useFetch(
    ['staff-detail', id ?? ''],
    () => staffService.getById(id!),
    { enabled: isEdit },
  );

  useEffect(() => {
    if (staffMember) {
      setForm({
        email: staffMember.email,
        first_name: staffMember.first_name,
        last_name: staffMember.last_name,
        phone: staffMember.phone ?? '',
        role: staffMember.role,
        profile_photo_url: staffMember.profile_photo_url ?? '',
        password: '',
      });
    }
  }, [staffMember]);

  const createStaff = useMutate(
    () => staffService.create(schoolId, {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
      role: form.role,
      password: form.password,
    }),
    [['staff']],
    {
      onSuccess: () => { notify.success('Staff member added'); navigate('/staff'); },
      onError: (err: Error) => { notify.error(err.message || 'Failed to create staff'); },
    },
  );

  const updateStaff = useMutate(
    () => staffService.update(id!, {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
      role: form.role,
      profile_photo_url: form.profile_photo_url || undefined,
    }),
    [['staff'], ['staff-detail']],
    { onSuccess: () => notify.success('Staff member updated') },
  );

  const toggleActive = useMutate(
    () => staffMember?.is_active ? staffService.deactivate(id!) : staffService.activate(id!),
    [['staff'], ['staff-detail']],
    { onSuccess: () => notify.success('Status updated') },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.role
    && (isEdit || form.password.length >= 8);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Staff', href: '/staff' }, { label: isEdit ? `${form.first_name} ${form.last_name}` : 'New Staff' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
        </h1>
        {isEdit && staffMember && (
          <div className="flex items-center gap-2">
            <Badge variant={staffMember.is_active ? 'success' : 'danger'}>
              {staffMember.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(undefined)}
              loading={toggleActive.isPending}>
              {staffMember.is_active
                ? <><UserX className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                : <><UserCheck className="h-3.5 w-3.5 mr-1" /> Activate</>}
            </Button>
          </div>
        )}
      </div>

      <Card className="p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Personal Information</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name *" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            <Input label="Last Name *" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
          </div>
          <Input label="Email *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
            disabled={isEdit} placeholder="staff@school.edu.lr" />
          {!isEdit && (
            <div>
              <Input label="Temporary Password *" type="password" value={form.password}
                onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters" />
              {defaultStaffPassword && form.password === defaultStaffPassword && (
                <p className="text-xs text-blue-500 mt-1">Using default staff password from School Settings.</p>
              )}
              {!defaultStaffPassword && (
                <p className="text-xs text-amber-500 mt-1">Tip: Set a default staff password in IT Admin → School Settings to auto-fill this.</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+231..." />
            <Select label="Role *" options={ROLE_OPTIONS} value={form.role}
              onChange={(e) => set('role', e.target.value)} />
          </div>
          <Input label="Profile Photo URL" value={form.profile_photo_url}
            onChange={(e) => set('profile_photo_url', e.target.value)} placeholder="https://..." />
        </div>
      </Card>

      {/* Account Info (edit mode) */}
      {isEdit && staffMember && (
        <Card className="p-5 max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Account Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">User ID</p>
              <p className="font-mono text-xs text-slate-600">{staffMember.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Role</p>
              <Badge variant="info" size="sm">{staffMember.role.replace(/_/g, ' ')}</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last Login</p>
              <p>{staffMember.last_login ? new Date(staffMember.last_login).toLocaleString() : 'Never'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Member Since</p>
              <p>{new Date(staffMember.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="max-w-2xl">
        <Button onClick={() => isEdit ? updateStaff.mutate(undefined) : createStaff.mutate(undefined)}
          loading={updateStaff.isPending || createStaff.isPending} disabled={!canSave}>
          <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Save Changes' : 'Add Staff Member'}
        </Button>
      </div>
    </div>
  );
}