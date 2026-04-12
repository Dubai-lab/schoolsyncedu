import { useState } from 'react';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { pricingPlanService } from '@/services/adminService';
import type { SubscriptionPlan, BillingCycle } from '@/types/report.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { CreditCard, Eye, EyeOff, Check, X, Plus, Pencil, Trash2, Power } from 'lucide-react';

const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly', 'custom', 'lifetime'];
const DEFAULT_FEATURES = ['attendance', 'grades', 'fees', 'letters', 'library', 'nfc', 'communications', 'reports', 'waec', 'id_cards'];

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  price_usd: number;
  billing_cycle: BillingCycle;
  student_limit: number;
  features: Record<string, boolean>;
  is_active: boolean;
  is_visible: boolean;
  trial_days: number;
  grace_days: number;
}

const emptyForm: PlanForm = {
  name: '', slug: '', description: '', price_usd: 0, billing_cycle: 'monthly',
  student_limit: 100, features: Object.fromEntries(DEFAULT_FEATURES.map((f) => [f, false])),
  is_active: true, is_visible: true, trial_days: 14, grace_days: 7,
};

export default function PricingPlans() {
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);

  const { data: plans = [], isLoading } = useFetch<SubscriptionPlan[]>(
    ['admin-plans'],
    () => pricingPlanService.list()
  );

  const toggleVisMutation = useMutate(
    ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      pricingPlanService.toggleVisibility(id, isVisible),
    [['admin-plans']]
  );

  const toggleActiveMutation = useMutate(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      pricingPlanService.toggleActive(id, isActive),
    [['admin-plans']]
  );

  const createMutation = useMutate(
    (payload: Omit<SubscriptionPlan, 'id' | 'created_at'>) => pricingPlanService.create(payload),
    [['admin-plans']]
  );

  const updateMutation = useMutate(
    ({ id, payload }: { id: string; payload: Partial<SubscriptionPlan> }) =>
      pricingPlanService.update(id, payload),
    [['admin-plans']]
  );

  const deleteMutation = useMutate(
    (id: string) => pricingPlanService.delete(id),
    [['admin-plans']]
  );

  const openCreate = () => { setForm(emptyForm); setCreating(true); };
  const openEdit = (p: SubscriptionPlan) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, description: p.description ?? '',
      price_usd: p.price_usd, billing_cycle: p.billing_cycle,
      student_limit: p.student_limit, features: { ...Object.fromEntries(DEFAULT_FEATURES.map((f) => [f, false])), ...p.features },
      is_active: p.is_active, is_visible: p.is_visible,
      trial_days: p.trial_days, grace_days: p.grace_days,
    });
  };
  const closeForm = () => { setCreating(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      notify.error('Name and slug are required');
      return;
    }
    if (creating) {
      createMutation.mutate(form as Omit<SubscriptionPlan, 'id' | 'created_at'>, {
        onSuccess: () => { notify.success('Plan created'); closeForm(); },
        onError: () => notify.error('Failed to create plan'),
      });
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form }, {
        onSuccess: () => { notify.success('Plan updated'); closeForm(); },
        onError: () => notify.error('Failed to update plan'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { notify.success('Plan deleted'); setDeleteTarget(null); },
      onError: () => notify.error('Failed to delete plan'),
    });
  };

  const activePlans = plans.filter((p) => p.is_active).length;
  const visiblePlans = plans.filter((p) => p.is_visible).length;

  const columns: Column<SubscriptionPlan>[] = [
    {
      key: 'name',
      header: 'Plan',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          <p className="text-xs text-gray-500">{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'price_usd',
      header: 'Price',
      render: (row) => (
        <span className="font-semibold">
          ${row.price_usd.toLocaleString()}<span className="text-xs text-gray-500">/{row.billing_cycle}</span>
        </span>
      ),
    },
    {
      key: 'student_limit',
      header: 'Student Limit',
      render: (row) => (row.student_limit >= 999999 ? 'Unlimited' : row.student_limit.toLocaleString()),
    },
    { key: 'trial_days', header: 'Trial', render: (row) => `${row.trial_days} days` },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
          {row.is_visible ? <Badge variant="info">Visible</Badge> : <Badge variant="default">Hidden</Badge>}
        </div>
      ),
    },
    {
      key: 'features',
      header: 'Features',
      render: (row) => {
        const entries = Object.entries(row.features ?? {});
        return (
          <div className="flex flex-wrap gap-1">
            {entries.slice(0, 3).map(([key, val]) => (
              <span key={key} className="inline-flex items-center text-xs gap-0.5">
                {val ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-red-400" />}
                {key.replace(/_/g, ' ')}
              </span>
            ))}
            {entries.length > 3 && <span className="text-xs text-gray-400">+{entries.length - 3} more</span>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => toggleVisMutation.mutate(
            { id: row.id, isVisible: !row.is_visible },
            { onSuccess: () => notify.success(row.is_visible ? 'Hidden' : 'Visible') }
          )}>
            {row.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate(
            { id: row.id, isActive: !row.is_active },
            { onSuccess: () => notify.success(row.is_active ? 'Deactivated' : 'Activated') }
          )}>
            <Power className={`w-4 h-4 ${row.is_active ? 'text-green-500' : 'text-gray-400'}`} />
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

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Pricing Plans' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pricing Plans</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage subscription plans, pricing tiers, and feature sets.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
          Create Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><CreditCard className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Plans</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{plans.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><Check className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{activePlans}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Eye className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Publicly Visible</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{visiblePlans}</p>
            </div>
          </div>
        </Card>
      </div>

      <Table<SubscriptionPlan>
        columns={columns}
        data={plans}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No pricing plans configured."
      />

      {/* ===== CREATE / EDIT MODAL ===== */}
      <Dialog open={isFormOpen} onClose={closeForm} className="max-w-2xl">
        <DialogHeader onClose={closeForm}>
          <DialogTitle>{creating ? 'Create Plan' : 'Edit Plan'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Plan Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Slug *</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. basic, pro, enterprise"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Price (USD)</label>
              <input type="number" min={0} step={0.01} value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Billing Cycle</label>
              <select value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as BillingCycle })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                {BILLING_CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Student Limit</label>
              <input type="number" min={1} value={form.student_limit} onChange={(e) => setForm({ ...form, student_limit: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Trial Days</label>
              <input type="number" min={0} value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Grace Days</label>
              <input type="number" min={0} value={form.grace_days} onChange={(e) => setForm({ ...form, grace_days: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="flex items-center gap-6 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                Publicly Visible
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Features</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEFAULT_FEATURES.map((feat) => (
                  <label key={feat} className="flex items-center gap-2 text-sm capitalize">
                    <input type="checkbox" checked={!!form.features[feat]}
                      onChange={(e) => setForm({ ...form, features: { ...form.features, [feat]: e.target.checked } })}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    {feat.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
          <Button size="sm" loading={isSaving} onClick={handleSubmit}>
            {creating ? 'Create Plan' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="max-w-sm">
        <DialogHeader onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete Plan</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Schools on this plan will need to be migrated first.
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
