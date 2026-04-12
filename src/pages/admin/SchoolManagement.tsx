import { useState } from 'react';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { schoolManagementService } from '@/services/adminService';
import type { School } from '@/types/school.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Search, Building2, MapPin, Eye, Pencil, Trash2 } from 'lucide-react';

type ModalMode = null | 'view' | 'edit';

export default function SchoolManagement() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<School | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [form, setForm] = useState<Partial<School>>({});

  const { data: schools = [], isLoading } = useFetch<School[]>(
    ['admin-schools'],
    () => schoolManagementService.list()
  );

  const updateMutation = useMutate(
    ({ id, payload }: { id: string; payload: Partial<School> }) =>
      schoolManagementService.update(id, payload),
    [['admin-schools']]
  );

  const deleteMutation = useMutate(
    (id: string) => schoolManagementService.delete(id),
    [['admin-schools']]
  );

  const filtered = debouncedSearch
    ? schools.filter(
        (s) =>
          s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.school_code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.location.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : schools;

  const openView = (s: School) => { setSelected(s); setMode('view'); };
  const openEdit = (s: School) => {
    setSelected(s);
    setForm({
      name: s.name,
      location: s.location,
      principal_name: s.principal_name,
      principal_email: s.principal_email,
      phone: s.phone,
      address: s.address ?? '',
      motto: s.motto ?? '',
      website: s.website ?? '',
    });
    setMode('edit');
  };
  const closeModal = () => { setSelected(null); setMode(null); setForm({}); };

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate(
      { id: selected.id, payload: form },
      {
        onSuccess: () => { notify.success('School updated'); closeModal(); },
        onError: () => notify.error('Failed to update school'),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { notify.success('School removed'); setDeleteTarget(null); },
      onError: () => notify.error('Failed to delete school'),
    });
  };

  const columns: Column<School>[] = [
    {
      key: 'name',
      header: 'School',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          <p className="text-xs text-gray-500">{row.school_code}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          <MapPin className="w-3 h-3" /> {row.location}
        </div>
      ),
    },
    { key: 'principal_name', header: 'Principal', render: (row) => row.principal_name },
    { key: 'phone', header: 'Phone', render: (row) => row.phone },
    {
      key: 'moe_registration_number',
      header: 'MOE Reg #',
      render: (row) => <Badge variant="outline">{row.moe_registration_number}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Registered',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openView(row)}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'School Management' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage all registered schools on the platform.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search schools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <Card className="p-4 flex items-center gap-3">
        <Building2 className="w-5 h-5 text-primary-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Total Schools: <span className="text-gray-900 dark:text-white">{schools.length}</span>
        </span>
      </Card>

      <Table<School>
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No schools found."
      />

      {/* ===== VIEW MODAL ===== */}
      <Dialog open={mode === 'view' && !!selected} onClose={closeModal} className="max-w-2xl">
        <DialogHeader onClose={closeModal}>
          <DialogTitle>School Details</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {selected && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <InfoCell label="Name" value={selected.name} />
              <InfoCell label="Code" value={selected.school_code} />
              <InfoCell label="Location" value={selected.location} />
              <InfoCell label="Address" value={selected.address ?? '—'} />
              <InfoCell label="Principal" value={selected.principal_name} />
              <InfoCell label="Principal Email" value={selected.principal_email} />
              <InfoCell label="Proprietor" value={selected.proprietor_name ?? '—'} />
              <InfoCell label="Proprietor Email" value={selected.proprietor_email ?? '—'} />
              <InfoCell label="Phone" value={selected.phone} />
              <InfoCell label="MOE Reg #" value={selected.moe_registration_number} />
              <InfoCell label="Motto" value={selected.motto ?? '—'} />
              <InfoCell label="Website" value={selected.website ?? '—'} />
              <InfoCell label="Registered" value={new Date(selected.created_at).toLocaleDateString()} />
              {selected.logo_url && (
                <div className="col-span-2">
                  <span className="text-gray-500">Logo</span>
                  <img src={selected.logo_url} alt="Logo" className="mt-1 h-16 w-16 rounded-lg object-cover border border-slate-200" />
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeModal}>Close</Button>
          <Button size="sm" onClick={() => selected && openEdit(selected)}>Edit</Button>
        </DialogFooter>
      </Dialog>

      {/* ===== EDIT MODAL ===== */}
      <Dialog open={mode === 'edit' && !!selected} onClose={closeModal} className="max-w-2xl">
        <DialogHeader onClose={closeModal}>
          <DialogTitle>Edit School</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="School Name" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} />
            <FormField label="Location" value={form.location ?? ''} onChange={(v) => setForm({ ...form, location: v })} />
            <FormField label="Principal Name" value={form.principal_name ?? ''} onChange={(v) => setForm({ ...form, principal_name: v })} />
            <FormField label="Principal Email" value={form.principal_email ?? ''} onChange={(v) => setForm({ ...form, principal_email: v })} type="email" />
            <FormField label="Phone" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
            <FormField label="Address" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
            <FormField label="Motto" value={form.motto ?? ''} onChange={(v) => setForm({ ...form, motto: v })} />
            <FormField label="Website" value={form.website ?? ''} onChange={(v) => setForm({ ...form, website: v })} type="url" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
          <Button size="sm" loading={updateMutation.isPending} onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="max-w-sm">
        <DialogHeader onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete School</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600">
            Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will remove all associated data.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteMutation.isPending} onClick={handleDelete}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
    </div>
  );
}
