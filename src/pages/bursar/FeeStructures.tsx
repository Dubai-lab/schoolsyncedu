import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { bursarService } from '@/services/bursarService';
import { registrarService } from '@/services/registrarService';
import { classService } from '@/services/classService';
import { FEE_TYPES } from '@/utils/constants';
import type { FeeStructure } from '@/types/fee.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Plus,
  Trash2,
  Edit3,
  Layers,
  X,
  Check,
  Users,
  AlertCircle,
} from 'lucide-react';

// ==================== OPTIONS ====================

const feeTypeOptions = Object.entries(FEE_TYPES).map(([, v]) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==================== FORM STATE ====================

interface FeeForm {
  classId: string;
  className: string;
  feeType: string;
  amountUsd: string;
  amountLrd: string;
  description: string;
  dueDate: string;
}

const emptyForm: FeeForm = {
  classId: '',
  className: '',
  feeType: '',
  amountUsd: '',
  amountLrd: '',
  description: '',
  dueDate: '',
};

// ==================== COMPONENT ====================

export default function FeeStructures() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showForm, setShowForm] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState<FeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Academic year from school settings (set by IT Admin)
  const { data: currentAcademicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );
  const academicYear = currentAcademicYear || '';

  // Classes created by the principal
  const { data: classesResult, isLoading: classesLoading } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classes = classesResult?.data ?? [];

  const classOptions = classes.map((c) => ({
    label: `${c.name}${c.grade_level ? ` (${c.grade_level})` : ''}`,
    value: c.id,
  }));

  // Fee structures for this academic year
  const { data: feeStructures, isLoading, refetch } = useFetch(
    ['bursar-fee-structures', schoolId, academicYear],
    () => bursarService.listFeeStructures(schoolId, academicYear || undefined),
    { enabled: !!schoolId },
  );

  const handleSave = async () => {
    if (!form.classId || !form.feeType || !form.amountUsd || !form.dueDate) return;
    setSaving(true);
    try {
      if (editingFee) {
        await bursarService.updateFeeStructure(editingFee.id, {
          amountUsd: parseFloat(form.amountUsd),
          amountLrd: parseFloat(form.amountLrd) || 0,
          description: form.description || undefined,
          dueDate: form.dueDate,
        });
      } else {
        const selectedClass = classes.find((c) => c.id === form.classId);
        await bursarService.createFeeStructure(schoolId, {
          academicYear,
          classId: form.classId,
          className: selectedClass?.name ?? form.classId,
          feeType: form.feeType,
          amountUsd: parseFloat(form.amountUsd),
          amountLrd: parseFloat(form.amountLrd) || 0,
          description: form.description || undefined,
          dueDate: form.dueDate,
        });
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingFee(null);
      refetch();
    } catch (err) {
      console.error('Failed to save fee structure:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fee structure? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await bursarService.deleteFeeStructure(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkAssign = async (fee: FeeStructure) => {
    const target = fee.grade_level || 'selected class';
    if (!confirm(`Assign "${fee.fee_type}" fee to all enrolled students in ${target}?`)) return;
    setAssigning(fee.id);
    try {
      const result = await bursarService.bulkAssignFees(
        schoolId,
        fee.id,
        fee.class_id ?? null,
        fee.grade_level,
        fee.academic_year,
      );
      alert(`Successfully assigned to ${result.assigned} student${result.assigned !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Bulk assign failed:', err);
      alert('Failed to assign fees');
    } finally {
      setAssigning(null);
    }
  };

  const startEdit = (fee: FeeStructure) => {
    setEditingFee(fee);
    setForm({
      classId: fee.class_id ?? '',
      className: fee.grade_level,
      feeType: fee.fee_type,
      amountUsd: String(fee.amount_usd),
      amountLrd: String(fee.amount_lrd ?? 0),
      description: fee.description || '',
      dueDate: fee.due_date || '',
    });
    setShowForm(true);
  };

  // Group fee structures by class name (grade_level stores class name)
  const grouped = (feeStructures ?? []).reduce((acc, fee) => {
    const key = fee.grade_level || 'Unknown Class';
    if (!acc[key]) acc[key] = [];
    acc[key].push(fee);
    return acc;
  }, {} as Record<string, FeeStructure[]>);

  const noClasses = !classesLoading && classes.length === 0;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Finance', href: '/bursar' },
          { label: 'Fee Structures' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fee Structures</h1>
          <p className="text-sm text-slate-500">
            {feeStructures?.length ?? 0} fee structure{(feeStructures?.length ?? 0) !== 1 ? 's' : ''} defined
          </p>
        </div>
        <div className="flex gap-2">
          {academicYear && (
            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
              {academicYear}
            </span>
          )}
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => { setEditingFee(null); setForm(emptyForm); setShowForm(!showForm); }}
            disabled={noClasses}
          >
            {showForm ? 'Cancel' : 'Add Fee'}
          </Button>
        </div>
      </div>

      {/* Warning if no classes exist */}
      {noClasses && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            No classes have been created yet. Ask the Principal to create classes (e.g. 12A, 12B, JSS1A)
            before setting up fee structures. Fee structures must be linked to actual school classes.
          </p>
        </div>
      )}

      {/* No academic year warning */}
      {!academicYear && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Academic year is not set. Ask the IT Admin to configure it in School Settings.</p>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && !noClasses && (
        <Card className="p-6 border-primary-200 bg-primary-50/30">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingFee ? 'Edit Fee Structure' : 'New Fee Structure'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Academic Year — read-only */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year</label>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                {academicYear || 'Not set'}
              </div>
            </div>

            {/* Class — pulled from DB, not hardcoded grades */}
            <Select
              label="Class *"
              options={classOptions}
              value={form.classId}
              onChange={(e) => {
                const cls = classes.find((c) => c.id === e.target.value);
                setForm({ ...form, classId: e.target.value, className: cls?.name ?? '' });
              }}
              placeholder={classesLoading ? 'Loading classes…' : 'Select class'}
              disabled={!!editingFee} // can't change class on edit — delete & recreate
            />

            <Select
              label="Fee Type *"
              options={feeTypeOptions}
              value={form.feeType}
              onChange={(e) => setForm({ ...form, feeType: e.target.value })}
              placeholder="Select type"
            />
            <Input
              label="Amount (USD) *"
              type="number"
              placeholder="0.00"
              value={form.amountUsd}
              onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
            />
            <Input
              label="Amount (LRD)"
              type="number"
              placeholder="0.00"
              value={form.amountLrd}
              onChange={(e) => setForm({ ...form, amountLrd: e.target.value })}
            />
            <Input
              label="Due Date *"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Description (optional)"
                placeholder="Brief description of this fee…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingFee(null); setForm(emptyForm); }}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={!form.classId || !form.feeType || !form.amountUsd || !form.dueDate}
              onClick={handleSave}
            >
              <Check className="h-4 w-4 mr-1" /> {editingFee ? 'Update Fee Structure' : 'Save Fee Structure'}
            </Button>
          </div>
        </Card>
      )}

      {/* Fee Structures grouped by class */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <Layers className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No fee structures yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Create fee structures for each class to start assigning fees to students
          </p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([className, fees]) => (
            <Card key={className} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Class: {className}</h2>
                  <Badge variant="default">{fees.length} fee{fees.length !== 1 ? 's' : ''}</Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left font-medium text-slate-500">Type</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Year</th>
                      <th className="pb-2 text-right font-medium text-slate-500">USD</th>
                      <th className="pb-2 text-right font-medium text-slate-500">LRD</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Due Date</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Description</th>
                      <th className="pb-2 text-right font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 capitalize font-medium text-slate-700">{fee.fee_type}</td>
                        <td className="py-2.5 text-slate-500">{fee.academic_year}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-800">
                          {formatCurrency(fee.amount_usd)}
                        </td>
                        <td className="py-2.5 text-right text-slate-600">
                          L${(fee.amount_lrd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-xs text-slate-400">
                          {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 text-xs text-slate-500 max-w-[200px] truncate">
                          {fee.description || '—'}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(fee)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleBulkAssign(fee)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                              title="Assign to all students in this class"
                              disabled={assigning === fee.id}
                            >
                              {assigning === fee.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                              ) : (
                                <Users className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(fee.id)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete"
                              disabled={deleting === fee.id}
                            >
                              {deleting === fee.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
      )}
    </div>
  );
}
