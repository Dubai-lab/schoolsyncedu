import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { proprietorITAdminService } from '@/services/proprietorService';
import type { User } from '@/types/user.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  Monitor,
  Plus,
  Pencil,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Phone,
  Calendar,
  Info,
} from 'lucide-react';

export default function ITAdminSetup() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });

  const { data: itAdmins = [], isLoading } = useFetch<User[]>(
    ['prop-it-admins', schoolId],
    () => proprietorITAdminService.getITAdmins(schoolId),
    { enabled: !!schoolId },
  );

  const createAdmin = useMutate(
    () => proprietorITAdminService.createITAdmin(schoolId, {
      email: form.email,
      password: form.password,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
    }),
    [['prop-it-admins'], ['prop-staff']],
    {
      onSuccess: () => {
        notify.success('IT Admin account created successfully');
        resetForm();
      },
    },
  );

  const updateAdmin = useMutate(
    () => proprietorITAdminService.updateITAdmin(editId!, {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || undefined,
    }),
    [['prop-it-admins']],
    {
      onSuccess: () => {
        notify.success('IT Admin updated');
        resetForm();
      },
    },
  );

  const deactivateAdmin = useMutate(
    (id: string) => proprietorITAdminService.deactivateITAdmin(id),
    [['prop-it-admins']],
    { onSuccess: () => notify.success('IT Admin deactivated') },
  );

  const activateAdmin = useMutate(
    (id: string) => proprietorITAdminService.activateITAdmin(id),
    [['prop-it-admins']],
    { onSuccess: () => notify.success('IT Admin reactivated') },
  );

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' });
  }

  function openEdit(admin: User) {
    setEditId(admin.id);
    setForm({
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      phone: admin.phone ?? '',
      password: '',
    });
    setShowForm(true);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim() || (!editId && !form.email.trim())) return;
    if (!editId && form.password.length < 8) {
      notify.error('Password must be at least 8 characters');
      return;
    }
    if (editId) {
      updateAdmin.mutate(undefined);
    } else {
      createAdmin.mutate(undefined);
    }
  }

  const activeAdmins = itAdmins.filter((a) => a.is_active);
  const inactiveAdmins = itAdmins.filter((a) => !a.is_active);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'IT Admin Setup' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IT Admin Setup</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create and manage the IT administrator who will run your school system.
          </p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
          Add IT Admin
        </Button>
      </div>

      {/* Info banner */}
      <Card className="p-4 border-l-4 border-l-blue-400 bg-blue-50/50">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How it works</p>
            <p className="mt-1 text-blue-700">
              The IT Admin is responsible for setting up your entire school system — creating staff accounts (principal, teachers, bursar, etc.),
              managing student ID cards, NFC assignments, school branding, and all system configuration.
              You only need to create this one account, and they handle the rest.
            </p>
          </div>
        </div>
      </Card>

      {/* IT Admins list */}
      {isLoading ? (
        <Card className="p-10 text-center text-gray-500">Loading...</Card>
      ) : itAdmins.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Monitor className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No IT Admin yet</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            You haven't created an IT Admin for your school. Create one so they can set up your school system, register staff, and manage everything for you.
          </p>
          <Button className="mt-4" onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
            Create IT Admin
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Active admins */}
          {activeAdmins.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Active IT Admins ({activeAdmins.length})
              </h2>
              {activeAdmins.map((admin) => (
                <ITAdminCard
                  key={admin.id}
                  admin={admin}
                  onEdit={() => openEdit(admin)}
                  onDeactivate={() => deactivateAdmin.mutate(admin.id)}
                  deactivating={deactivateAdmin.isPending}
                />
              ))}
            </div>
          )}

          {/* Inactive admins */}
          {inactiveAdmins.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Inactive ({inactiveAdmins.length})
              </h2>
              {inactiveAdmins.map((admin) => (
                <ITAdminCard
                  key={admin.id}
                  admin={admin}
                  onEdit={() => openEdit(admin)}
                  onActivate={() => activateAdmin.mutate(admin.id)}
                  activating={activateAdmin.isPending}
                  inactive
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      <Dialog open={showForm} onClose={resetForm}>
        <DialogHeader onClose={resetForm}>
          <DialogTitle>{editId ? 'Edit IT Admin' : 'Create IT Admin'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="First name"
                required
              />
              <Input
                label="Last Name"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Last name"
                required
              />
            </div>
            <Input
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@school.edu"
              disabled={!!editId}
              hint={editId ? 'Email cannot be changed after account creation.' : 'This will be their login email.'}
              required={!editId}
            />
            <Input
              label="Phone Number"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+231 XXX XXX XXXX"
            />
            {!editId && (
              <Input
                label="Temporary Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
                hint="The IT Admin will use this password for their first login."
                required
              />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={createAdmin.isPending || updateAdmin.isPending}
            disabled={!form.first_name.trim() || !form.last_name.trim() || (!editId && (!form.email.trim() || form.password.length < 8))}
          >
            {editId ? 'Save Changes' : 'Create IT Admin'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ==================== IT ADMIN CARD ====================

interface ITAdminCardProps {
  admin: User;
  onEdit: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  deactivating?: boolean;
  activating?: boolean;
  inactive?: boolean;
}

function ITAdminCard({ admin, onEdit, onDeactivate, onActivate, deactivating, activating, inactive }: ITAdminCardProps) {
  return (
    <Card className={`p-5 ${inactive ? 'opacity-60' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: info */}
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${inactive ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {admin.first_name} {admin.last_name}
              </h3>
              <Badge variant={admin.is_active ? 'success' : 'danger'}>
                {admin.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 space-y-1 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                <span>{admin.email}</span>
              </div>
              {admin.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{admin.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Added {new Date(admin.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          {onDeactivate && (
            <Button size="sm" variant="danger" onClick={onDeactivate} loading={deactivating}>
              <UserX className="w-3.5 h-3.5 mr-1" /> Deactivate
            </Button>
          )}
          {onActivate && (
            <Button size="sm" variant="outline" onClick={onActivate} loading={activating}>
              <UserCheck className="w-3.5 h-3.5 mr-1" /> Reactivate
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
