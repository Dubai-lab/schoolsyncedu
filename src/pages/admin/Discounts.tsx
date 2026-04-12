import { useState } from 'react';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { discountService } from '@/services/adminService';
import type { Discount } from '@/types/report.types';
import type { DiscountType } from '@/types/common.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { Tag, ToggleLeft, ToggleRight, Percent, Plus, Pencil, Trash2, Search } from 'lucide-react';

const DISCOUNT_TYPES: DiscountType[] = ['percentage', 'fixed', 'coupon', 'school_specific', 'bulk', 'seasonal', 'referral', 'loyalty'];

interface DiscountForm {
  name: string;
  type: DiscountType;
  value: number;
  coupon_code: string;
  start_date: string;
  end_date: string;
  max_uses: number | null;
  stackable: boolean;
  is_active: boolean;
  applicable_plans: string[];
}

const emptyForm: DiscountForm = {
  name: '', type: 'percentage', value: 0, coupon_code: '', start_date: '', end_date: '',
  max_uses: null, stackable: false, is_active: true, applicable_plans: [],
};

export default function Discounts() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);

  const { data: discounts = [], isLoading } = useFetch<Discount[]>(
    ['admin-discounts'],
    () => discountService.list()
  );

  const toggleMutation = useMutate(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      discountService.toggleActive(id, isActive),
    [['admin-discounts']]
  );

  const createMutation = useMutate(
    (payload: Omit<Discount, 'id' | 'current_uses' | 'created_at'>) => discountService.create(payload),
    [['admin-discounts']]
  );

  const updateMutation = useMutate(
    ({ id, payload }: { id: string; payload: Partial<Discount> }) => discountService.update(id, payload),
    [['admin-discounts']]
  );

  const deleteMutation = useMutate(
    (id: string) => discountService.delete(id),
    [['admin-discounts']]
  );

  const filtered = debouncedSearch
    ? discounts.filter((d) =>
        d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (d.coupon_code ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : discounts;

  const openCreate = () => { setForm(emptyForm); setCreating(true); };
  const openEdit = (d: Discount) => {
    setEditing(d);
    setForm({
      name: d.name, type: d.type, value: d.value,
      coupon_code: d.coupon_code ?? '', start_date: d.start_date ?? '',
      end_date: d.end_date ?? '', max_uses: d.max_uses,
      stackable: d.stackable, is_active: d.is_active,
      applicable_plans: d.applicable_plans ?? [],
    });
  };
  const closeForm = () => { setCreating(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.name.trim()) { notify.error('Name is required'); return; }
    const payload = {
      ...form,
      coupon_code: form.coupon_code || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (creating) {
      createMutation.mutate(payload as Omit<Discount, 'id' | 'current_uses' | 'created_at'>, {
        onSuccess: () => { notify.success('Discount created'); closeForm(); },
        onError: () => notify.error('Failed to create discount'),
      });
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, payload }, {
        onSuccess: () => { notify.success('Discount updated'); closeForm(); },
        onError: () => notify.error('Failed to update discount'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { notify.success('Discount deleted'); setDeleteTarget(null); },
      onError: () => notify.error('Failed to delete discount'),
    });
  };

  const handleToggle = (d: Discount) => {
    toggleMutation.mutate(
      { id: d.id, isActive: !d.is_active },
      {
        onSuccess: () => notify.success(`Discount ${d.is_active ? 'deactivated' : 'activated'}`),
        onError: () => notify.error('Failed to update discount'),
      }
    );
  };

  const activeCount = discounts.filter((d) => d.is_active).length;
  const totalUsage = discounts.reduce((s, d) => s + d.current_uses, 0);

  const columns: Column<Discount>[] = [
    {
      key: 'name',
      header: 'Discount',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          {row.coupon_code && (
            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{row.coupon_code}</span>
          )}
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Badge variant="outline">{row.type.replace(/_/g, ' ')}</Badge> },
    { key: 'value', header: 'Value', render: (row) => row.type === 'percentage' ? `${row.value}%` : `$${row.value.toLocaleString()}` },
    {
      key: 'usage',
      header: 'Usage',
      render: (row) => <span className="text-sm">{row.current_uses}{row.max_uses ? ` / ${row.max_uses}` : ''}</span>,
    },
    {
      key: 'dates',
      header: 'Valid Period',
      render: (row) => {
        if (!row.start_date && !row.end_date) return 'No expiry';
        const start = row.start_date ? new Date(row.start_date).toLocaleDateString() : '—';
        const end = row.end_date ? new Date(row.end_date).toLocaleDateString() : '—';
        return `${start} — ${end}`;
      },
    },
    { key: 'is_active', header: 'Status', render: (row) => <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'stackable', header: 'Stackable', render: (row) => row.stackable ? <Badge variant="info">Yes</Badge> : <span className="text-gray-400">No</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleToggle(row)}>
            {row.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
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

  const isFormOpen = creating || !!editing;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Discounts' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discounts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage discount codes, promotions, and special pricing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search discounts..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Button size="sm" onClick={openCreate} icon={<Plus className="w-4 h-4" />}>Create Discount</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Tag className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Discounts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{discounts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><Percent className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Tag className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Redemptions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalUsage}</p>
            </div>
          </div>
        </Card>
      </div>

      <Table<Discount>
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No discounts configured."
      />

      {/* ===== CREATE / EDIT MODAL ===== */}
      <Dialog open={isFormOpen} onClose={closeForm} className="max-w-lg">
        <DialogHeader onClose={closeForm}>
          <DialogTitle>{creating ? 'Create Discount' : 'Edit Discount'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })} className={inputCls}>
                  {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Value {form.type === 'percentage' ? '(%)' : '(USD)'}</label>
                <input type="number" min={0} step={0.01} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Coupon Code</label>
              <input type="text" value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE20" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Max Uses (leave empty for unlimited)</label>
              <input type="number" min={0} value={form.max_uses ?? ''} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                Stackable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                Active
              </label>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
          <Button size="sm" loading={isSaving} onClick={handleSubmit}>
            {creating ? 'Create' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="max-w-sm">
        <DialogHeader onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete Discount</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
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
