import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { staffService } from '@/services/staffService';
import { USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Search, UserCheck, UserX, Users } from 'lucide-react';

const STAFF_ROLES: { label: string; value: string }[] = [
  { label: 'All Roles', value: '' },
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

const roleColor = (r: string): 'success' | 'warning' | 'info' | 'danger' | 'default' => {
  switch (r) {
    case 'principal': case 'vice_principal': return 'danger';
    case 'registrar': case 'bursar': case 'dean_of_students': return 'warning';
    case 'teacher': return 'info';
    case 'admin_staff': case 'it_admin': return 'default';
    case 'librarian': case 'guidance_counselor': return 'success';
    default: return 'default';
  }
};

type StaffRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  profile_photo_url: string | null;
  created_at: string;
};

export default function StaffList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useFetch(
    ['staff', schoolId, roleFilter, debouncedSearch],
    () => staffService.list(schoolId, {
      role: roleFilter ? roleFilter as UserRole : undefined,
      search: debouncedSearch || undefined,
    }),
    { enabled: !!schoolId },
  );

  const staff = (data?.data ?? []) as unknown as StaffRow[];
  const totalCount = data?.count ?? 0;

  const toggleActive = useMutate(
    (args: { id: string; active: boolean }) =>
      args.active ? staffService.activate(args.id) : staffService.deactivate(args.id),
    [['staff']],
    { onSuccess: () => notify.success('Staff status updated') },
  );

  const activeCount = staff.filter((s) => s.is_active).length;

  const columns: Column<StaffRow>[] = [
    {
      key: 'name', header: 'Name',
      render: (r) => (
        <button onClick={() => navigate(`/staff/${r.id}/edit`)} className="text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
              {r.first_name[0]}{r.last_name[0]}
            </div>
            <div>
              <p className="font-medium text-blue-600 hover:underline">{r.first_name} {r.last_name}</p>
              <p className="text-xs text-slate-400">{r.email}</p>
            </div>
          </div>
        </button>
      ),
    },
    {
      key: 'role', header: 'Role',
      render: (r) => <Badge variant={roleColor(r.role)} size="sm">{r.role.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'phone', header: 'Phone',
      render: (r) => <span className="text-sm text-slate-600">{r.phone ?? '—'}</span>,
    },
    {
      key: 'is_active', header: 'Status',
      render: (r) => r.is_active
        ? <Badge variant="success" size="sm">Active</Badge>
        : <Badge variant="danger" size="sm">Inactive</Badge>,
    },
    {
      key: 'created_at', header: 'Joined',
      render: (r) => <span className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.is_active ? (
            <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ id: r.id, active: false })}>
              <UserX className="h-3.5 w-3.5 text-red-500" />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ id: r.id, active: true })}>
              <UserCheck className="h-3.5 w-3.5 text-green-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Staff' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" /> Staff Directory
        </h1>
        <Button onClick={() => navigate('/staff/new')}>
          <Plus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          <p className="text-xs text-slate-500">Total Staff</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{totalCount - activeCount}</p>
          <p className="text-xs text-slate-500">Inactive</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3">
        <div className="w-64 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search staff..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <Select options={STAFF_ROLES} value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={staff} keyExtractor={(r) => r.id} loading={isLoading}
        emptyMessage="No staff members found." />
    </div>
  );
}