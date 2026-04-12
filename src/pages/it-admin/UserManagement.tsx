import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { itAdminUserService } from '@/services/itAdminService';
import { registrarService } from '@/services/registrarService';
import { USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import type { User } from '@/types/user.types';
import type { SchoolSetting } from '@/types/application.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  Plus,
  Search,
  Pencil,
  UserCheck,
  UserX,
  Users,
  KeyRound,
  Copy,
  Check,
  Printer,
} from 'lucide-react';

// ==================== CONSTANTS ====================

const MANAGEABLE_ROLES: { label: string; value: string }[] = [
  { label: 'Principal', value: USER_ROLES.PRINCIPAL },
  { label: 'Vice Principal', value: USER_ROLES.VICE_PRINCIPAL },
  { label: 'Registrar', value: USER_ROLES.REGISTRAR },
  { label: 'Bursar', value: USER_ROLES.BURSAR },
  { label: 'Dean of Students', value: USER_ROLES.DEAN },
  { label: 'Admin Staff', value: USER_ROLES.ADMIN_STAFF },
  { label: 'Teacher', value: USER_ROLES.TEACHER },
  { label: 'Librarian', value: USER_ROLES.LIBRARIAN },
  { label: 'Guidance Counselor', value: USER_ROLES.COUNSELOR },
];

const FILTER_ROLES = [{ label: 'All Roles', value: '' }, ...MANAGEABLE_ROLES];

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

const roleLabel = (r: string): string => {
  const map: Record<string, string> = {
    principal: 'Principal',
    vice_principal: 'Vice Principal',
    registrar: 'Registrar',
    bursar: 'Bursar',
    dean_of_students: 'Dean',
    admin_staff: 'Admin Staff',
    it_admin: 'IT Admin',
    teacher: 'Teacher',
    librarian: 'Librarian',
    guidance_counselor: 'Counselor',
  };
  return map[r] ?? r;
};

// ==================== FORM STATE ====================

interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
}

const emptyForm: UserFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: USER_ROLES.TEACHER as UserRole,
  password: '',
};

// ==================== MAIN COMPONENT ====================

export default function UserManagement() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Dialog state
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);

  // Credential slip state (shown after successful creation)
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; role: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch default staff password from school settings
  const { data: settingsData } = useFetch(
    ['school-settings', schoolId],
    () => registrarService.getAllSettings(schoolId),
    { enabled: !!schoolId },
  );

  const defaultStaffPassword = (() => {
    if (!settingsData) return '';
    const found = (settingsData as SchoolSetting[]).find((s) => s.setting_key === 'default_staff_password');
    return found?.setting_value ?? '';
  })();

  // Data
  const { data, isLoading } = useFetch(
    ['it-admin-users', schoolId, roleFilter, statusFilter, debouncedSearch],
    () => itAdminUserService.listUsers(schoolId, {
      role: roleFilter ? (roleFilter as UserRole) : undefined,
      is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      search: debouncedSearch || undefined,
    }),
    { enabled: !!schoolId },
  );

  const users = (data?.data ?? []) as User[];
  const totalCount = data?.count ?? 0;

  // Mutations
  const createUser = useMutate(
    () => itAdminUserService.createUser(schoolId, {
      email: form.email,
      password: form.password,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
      role: form.role,
    }),
    [['it-admin-users'], ['it-admin-stats']],
    {
      onSuccess: () => {
        // Show credential slip instead of just closing
        setCreatedCredentials({
          name: `${form.first_name} ${form.last_name}`,
          email: form.email,
          role: roleLabel(form.role),
          password: form.password,
        });
        setShowCredentials(true);
        notify.success('User account created');
        closeForm();
      },
      onError: (err: Error) => {
        notify.error(err.message || 'Failed to create user');
      },
    },
  );

  const updateUser = useMutate(
    () => itAdminUserService.updateUser(editUser!.id, {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
      role: form.role,
    }),
    [['it-admin-users'], ['it-admin-stats']],
    {
      onSuccess: () => {
        notify.success('User updated');
        closeForm();
      },
    },
  );

  const toggleActive = useMutate(
    (args: { id: string; active: boolean }) =>
      args.active ? itAdminUserService.activateUser(args.id) : itAdminUserService.deactivateUser(args.id),
    [['it-admin-users'], ['it-admin-stats']],
    { onSuccess: () => notify.success('User status updated') },
  );

  const resetPassword = useMutate(
    (id: string) => itAdminUserService.resetPassword(id),
    [],
    { onSuccess: () => notify.success('Password reset email sent') },
  );

  // Helpers
  function openCreate() {
    setEditUser(null);
    setForm({ ...emptyForm, password: defaultStaffPassword });
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone ?? '',
      role: u.role as UserRole,
      password: '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditUser(null);
    setForm(emptyForm);
  }

  function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      notify.error('Please fill in all required fields');
      return;
    }
    if (!editUser && form.password.length < 8) {
      notify.error('Password must be at least 8 characters');
      return;
    }
    if (editUser) {
      updateUser.mutate(undefined);
    } else {
      createUser.mutate(undefined);
    }
  }

  const set = (key: keyof UserFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  // Table columns
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
            {row.first_name?.[0]}{row.last_name?.[0]}
          </div>
          <div>
            <p className="font-medium text-slate-700">{row.first_name} {row.last_name}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge variant={roleColor(row.role)}>{roleLabel(row.role)}</Badge>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-sm text-slate-500">{row.phone ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      render: (row) => (
        <span className="text-sm text-slate-400">
          {row.last_login ? new Date(row.last_login).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => resetPassword.mutate(row.id)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
            title="Reset password"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleActive.mutate({ id: row.id, active: !row.is_active })}
            className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${
              row.is_active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'
            }`}
            title={row.is_active ? 'Deactivate' : 'Activate'}
          >
            {row.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'User Management' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <Users className="inline-block h-6 w-6 mr-2 text-blue-600" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} users total &middot; {activeCount} active &middot; {inactiveCount} inactive
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={FILTER_ROLES}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
          options={[
            { label: 'All Status', value: '' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
        />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found matching your filters."
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onClose={closeForm}>
        <DialogHeader>
          <DialogTitle>{editUser ? 'Edit User' : 'Create New User'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="John"
              />
              <Input
                label="Last Name *"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Doe"
              />
            </div>
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="john.doe@school.edu.lr"
              disabled={!!editUser}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+231 XX XXX XXXX"
            />
            {!editUser && (
              <div>
                <Input
                  label="Temporary Password *"
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Min. 8 characters"
                />
                {defaultStaffPassword && form.password === defaultStaffPassword && (
                  <p className="text-xs text-blue-500 mt-1">Using default staff password from School Settings.</p>
                )}
                {!defaultStaffPassword && (
                  <p className="text-xs text-amber-500 mt-1">Tip: Set a default staff password in School Settings to auto-fill this field.</p>
                )}
              </div>
            )}
            <Select
              label="Role *"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              options={MANAGEABLE_ROLES}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={closeForm}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={createUser.isPending || updateUser.isPending}
            disabled={!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || (!editUser && form.password.length < 8)}
          >
            {editUser ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Credential Slip Dialog */}
      <Dialog open={showCredentials} onClose={() => { setShowCredentials(false); setCreatedCredentials(null); setCopied(false); }}>
        <DialogHeader>
          <DialogTitle>Login Credentials</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {createdCredentials && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Share these credentials with <strong>{createdCredentials.name}</strong> so they can log in.
                They should change their password after first login.
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="text-slate-800 font-medium">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role:</span>
                  <span className="text-slate-800 font-medium">{createdCredentials.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-800 font-medium">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Password:</span>
                  <span className="text-slate-800 font-medium">{createdCredentials.password}</span>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (!createdCredentials) return;
              const text = `SchoolSync Login Credentials\n\nName: ${createdCredentials.name}\nRole: ${createdCredentials.role}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\n\nPlease change your password after first login.`;
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <><Check className="h-4 w-4 mr-1.5 text-emerald-600" /> Copied!</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy</>}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!createdCredentials) return;
              const printWindow = window.open('', '_blank', 'width=400,height=300');
              if (printWindow) {
                printWindow.document.write(`<html><head><title>Login Credentials</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{margin-bottom:16px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}.label{color:#64748b}.value{font-weight:600}.note{margin-top:16px;font-size:12px;color:#64748b}</style></head><body><h2>SchoolSync Login Credentials</h2><div class="row"><span class="label">Name:</span><span class="value">${createdCredentials.name}</span></div><div class="row"><span class="label">Role:</span><span class="value">${createdCredentials.role}</span></div><div class="row"><span class="label">Email:</span><span class="value">${createdCredentials.email}</span></div><div class="row"><span class="label">Password:</span><span class="value">${createdCredentials.password}</span></div><p class="note">Please change your password after first login.</p></body></html>`);
                printWindow.document.close();
                printWindow.print();
              }
            }}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button onClick={() => { setShowCredentials(false); setCreatedCredentials(null); setCopied(false); }}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
