import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { bursarService, feeInstallmentService } from '@/services/bursarService';
import { registrarService } from '@/services/registrarService';
import { classService } from '@/services/classService';
import { FEE_TYPES } from '@/utils/constants';
import type { FeeStructure, FeeStructureInstallment } from '@/types/fee.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Plus,
  Trash2,
  Edit3,
  Layers,
  X,
  Check,
  AlertCircle,
  Zap,
  CalendarDays,
  PlusCircle,
  MinusCircle,
  Copy,
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
  feeYear: string;
  classId: string;
  className: string;
  feeType: string;
  amountUsd: string;
  amountLrd: string;
  description: string;
  dueDate: string;
}

const emptyForm: FeeForm = {
  feeYear: '',
  classId: '',
  className: '',
  feeType: '',
  amountUsd: '',
  amountLrd: '',
  description: '',
  dueDate: '',
};

// ==================== INSTALLMENT ROW ====================

interface InstallmentRow {
  term_name: string;
  term_order: number;
  amount_usd: string;
  due_date: string;
}

const DEFAULT_TERMS: InstallmentRow[] = [
  { term_name: 'First Term',  term_order: 1, amount_usd: '', due_date: '' },
  { term_name: 'Second Term', term_order: 2, amount_usd: '', due_date: '' },
  { term_name: 'Third Term',  term_order: 3, amount_usd: '', due_date: '' },
];

// ==================== COMPONENT ====================

export default function FeeStructures() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showForm, setShowForm] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState<FeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  // ── Split-by-term dialog state ──
  const [splitFee, setSplitFee] = useState<FeeStructure | null>(null);
  const [splitRows, setSplitRows] = useState<InstallmentRow[]>(DEFAULT_TERMS);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitSaving, setSplitSaving] = useState(false);
  const [splitError, setSplitError] = useState('');

  // Academic years from school settings
  const { data: currentAcademicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );
  const { data: nextAcademicYear } = useFetch(
    ['school-setting-next-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'next_academic_year'),
    { enabled: !!schoolId },
  );

  // Year filter — empty string = show all years (default)
  const [selectedYear, setSelectedYear] = useState('');

  const academicYear = selectedYear;

  const yearOptions = [
    { label: 'All Years', value: '' },
    currentAcademicYear ? { label: `${currentAcademicYear} (Current)`, value: currentAcademicYear as string } : null,
    nextAcademicYear    ? { label: `${nextAcademicYear} (Next)`,    value: nextAcademicYear as string }    : null,
  ].filter(Boolean) as { label: string; value: string }[];

  // Classes created by the principal
  const { data: classesResult, isLoading: classesLoading } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classes = classesResult?.data ?? [];

  // "school-wide" sentinel value means class_id = NULL (school-wide registration fee)
  const SCHOOL_WIDE = '__school_wide__';

  const classOptions = [
    { label: 'School-wide (Registration fee — no specific class)', value: SCHOOL_WIDE },
    ...classes.map((c) => ({
      label: `${c.name}${c.grade_level ? ` (${c.grade_level})` : ''}`,
      value: c.id,
    })),
  ];

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
        const isSchoolWide = form.classId === SCHOOL_WIDE;
        const selectedClass = classes.find((c) => c.id === form.classId);
        await bursarService.createFeeStructure(schoolId, {
          academicYear: form.feeYear || (currentAcademicYear as string) || '',
          classId:   isSchoolWide ? null : form.classId,
          className: isSchoolWide ? 'School-wide' : (selectedClass?.name ?? form.classId),
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

  const startEdit = (fee: FeeStructure) => {
    setEditingFee(fee);
    setForm({
      feeYear:     fee.academic_year,
      classId:     fee.class_id ?? '',
      className:   fee.grade_level,
      feeType:     fee.fee_type,
      amountUsd:   String(fee.amount_usd),
      amountLrd:   String(fee.amount_lrd ?? 0),
      description: fee.description || '',
      dueDate:     fee.due_date || '',
    });
    setShowForm(true);
  };

  const handleCopyToNextYear = async () => {
    if (!currentAcademicYear || !nextAcademicYear) return;
    if (!confirm(
      `Copy all ${currentAcademicYear} fee structures to ${nextAcademicYear}?\n\n` +
      `This will create the same fees for next year (skipping any that already exist). ` +
      `You can edit amounts afterwards.`
    )) return;
    setCopying(true);
    try {
      const count = await bursarService.copyFeesToNextYear(
        schoolId,
        currentAcademicYear as string,
        nextAcademicYear as string,
      );
      if (count === 0) {
        alert('All fee structures are already set up for next year — nothing to copy.');
      } else {
        alert(`${count} fee structure${count !== 1 ? 's' : ''} copied to ${nextAcademicYear}.`);
      }
      refetch();
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy fee structures. Please try again.');
    } finally {
      setCopying(false);
    }
  };

  // ── Open term-split dialog ──
  const openSplitDialog = async (fee: FeeStructure) => {
    setSplitFee(fee);
    setSplitError('');
    setSplitLoading(true);
    try {
      const existing: FeeStructureInstallment[] = await feeInstallmentService.getForFeeStructure(fee.id);
      if (existing.length > 0) {
        setSplitRows(
          existing.map((e) => ({
            term_name:  e.term_name,
            term_order: e.term_order,
            amount_usd: String(e.amount_usd),
            due_date:   e.due_date,
          })),
        );
      } else {
        setSplitRows(DEFAULT_TERMS.map((t) => ({ ...t })));
      }
    } catch {
      setSplitRows(DEFAULT_TERMS.map((t) => ({ ...t })));
    } finally {
      setSplitLoading(false);
    }
  };

  const closeSplitDialog = () => {
    setSplitFee(null);
    setSplitRows(DEFAULT_TERMS.map((t) => ({ ...t })));
    setSplitError('');
  };

  const updateSplitRow = (index: number, field: keyof InstallmentRow, value: string) => {
    setSplitRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, [field]: field === 'term_order' ? Number(value) : value } : r,
      ),
    );
  };

  const addSplitRow = () => {
    setSplitRows((prev) => [
      ...prev,
      { term_name: `Term ${prev.length + 1}`, term_order: prev.length + 1, amount_usd: '', due_date: '' },
    ]);
  };

  const removeSplitRow = (index: number) => {
    setSplitRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, term_order: i + 1 })),
    );
  };

  const totalAllocated = splitRows.reduce((sum, r) => sum + (parseFloat(r.amount_usd) || 0), 0);
  const feeTotal = splitFee ? Number(splitFee.amount_usd) : 0;
  const remaining = feeTotal - totalAllocated;

  const handleSaveSplit = async () => {
    if (!splitFee) return;
    setSplitError('');
    // Validate
    const invalid = splitRows.some((r) => !r.term_name.trim() || !r.amount_usd || !r.due_date);
    if (invalid) { setSplitError('Please fill in term name, amount, and due date for every row.'); return; }
    if (totalAllocated > feeTotal + 0.01) {
      setSplitError(`Total allocated (${formatCurrency(totalAllocated)}) exceeds fee amount (${formatCurrency(feeTotal)}).`);
      return;
    }
    setSplitSaving(true);
    try {
      await feeInstallmentService.create(
        splitFee.id,
        schoolId,
        splitRows.map((r, i) => ({
          term_name:  r.term_name.trim(),
          term_order: i + 1,
          amount_usd: parseFloat(r.amount_usd),
          due_date:   r.due_date,
        })),
      );
      closeSplitDialog();
      refetch();
    } catch (err) {
      setSplitError((err as Error).message ?? 'Failed to save installments');
    } finally {
      setSplitSaving(false);
    }
  };

  const handleClearSplit = async () => {
    if (!splitFee) return;
    if (!confirm('Remove all term installments for this fee? Students will see the full fee amount again.')) return;
    setSplitSaving(true);
    try {
      await feeInstallmentService.remove(splitFee.id);
      closeSplitDialog();
      refetch();
    } catch (err) {
      setSplitError((err as Error).message ?? 'Failed to remove installments');
    } finally {
      setSplitSaving(false);
    }
  };

  // Group fee structures by class name
  const grouped = (feeStructures ?? []).reduce((acc, fee) => {
    const key = fee.grade_level || 'Unknown Class';
    if (!acc[key]) acc[key] = [];
    acc[key].push(fee);
    return acc;
  }, {} as Record<string, FeeStructure[]>);

  const noClasses = !classesLoading && classes.length === 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Finance', href: '/bursar' }, { label: 'Fee Structures' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fee Structures</h1>
          <p className="text-sm text-slate-500">
            {feeStructures?.length ?? 0} fee structure{(feeStructures?.length ?? 0) !== 1 ? 's' : ''} defined
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year selector */}
          {yearOptions.length > 1 ? (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-primary-400 focus:outline-none"
            >
              {yearOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : academicYear ? (
            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
              {academicYear}
            </span>
          ) : null}
          {/* Copy to Next Year — only show when current year fees exist and next year is configured */}
          {currentAcademicYear && nextAcademicYear && !showForm && (
            <Button
              size="sm"
              variant="outline"
              icon={<Copy className="h-4 w-4" />}
              onClick={() => void handleCopyToNextYear()}
              loading={copying}
              title={`Copy all ${currentAcademicYear} fees to ${nextAcademicYear}`}
            >
              Copy to Next Year
            </Button>
          )}
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditingFee(null);
              setForm({ ...emptyForm, feeYear: (currentAcademicYear as string) ?? '' });
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancel' : 'Add Fee'}
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {noClasses && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            No classes have been created yet. Ask the Principal to create classes before setting up fee structures.
          </p>
        </div>
      )}
      {/* Warning: next year selected but no fees exist yet */}
      {selectedYear === nextAcademicYear && nextAcademicYear && !isLoading && (feeStructures ?? []).length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No fee structures for {nextAcademicYear} yet</p>
            <p className="mt-0.5 text-amber-700">
              Without next year&apos;s fee structures, promoted students will be marked as paid automatically.
              Click <strong>Copy to Next Year</strong> to clone your current fee structures — then edit amounts if they changed.
            </p>
          </div>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="p-6 border-primary-200 bg-primary-50/30">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            {editingFee ? 'Edit Fee Structure' : 'New Fee Structure'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Academic year for this fee structure */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academic Year *</label>
              {yearOptions.filter((o) => o.value).length > 0 ? (
                <select
                  value={form.feeYear ?? (currentAcademicYear as string) ?? ''}
                  onChange={(e) => setForm({ ...form, feeYear: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  {yearOptions.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                  Not set — configure in School Settings
                </div>
              )}
              {(form.feeYear ?? '') === (nextAcademicYear as string) && (
                <p className="mt-1 text-xs text-amber-600">Next year — for promotion registration fees</p>
              )}
            </div>
            <Select
              label="Class / Scope *"
              options={classOptions}
              value={form.classId}
              onChange={(e) => {
                const cls = classes.find((c) => c.id === e.target.value);
                setForm({ ...form, classId: e.target.value, className: cls?.name ?? '' });
              }}
              placeholder={classesLoading ? 'Loading classes…' : 'Select class or School-wide'}
              disabled={!!editingFee}
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
              disabled={!form.feeType || !form.amountUsd || !form.dueDate || (!form.classId && form.feeType !== 'registration')}
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
            Create a fee structure for a class — it will automatically be assigned to all enrolled students
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
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Zap className="h-3.5 w-3.5" />
                  Auto-assigned to enrolled students
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
                      <th className="pb-2 text-left font-medium text-slate-500">Term Split</th>
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
                        <td className="py-2.5">
                          {fee.fee_type === 'tuition' ? (
                            fee.has_installments ? (
                              <Badge variant="info" size="sm" className="flex items-center gap-1 w-fit">
                                <CalendarDays className="h-3 w-3" /> Split
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">Full payment</span>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-slate-500 max-w-[200px] truncate">
                          {fee.description || '—'}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {/* Split by term — tuition only */}
                            {fee.fee_type === 'tuition' && (
                              <button
                                onClick={() => void openSplitDialog(fee)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                                title={fee.has_installments ? 'Edit term installments' : 'Split into term installments'}
                              >
                                <CalendarDays className="h-4 w-4" />
                              </button>
                            )}
                            {/* Edit */}
                            <button
                              onClick={() => startEdit(fee)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {/* Delete */}
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

      {/* ── Term Installment Split Dialog ── */}
      <Dialog open={!!splitFee} onClose={closeSplitDialog}>
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-600" />
              Split into Term Installments
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {splitFee && (
            <>
              {/* Fee summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {splitFee.fee_type} — Class {splitFee.grade_level}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total annual fee: <span className="font-bold text-slate-700">{formatCurrency(Number(splitFee.amount_usd))}</span>
                    </p>
                  </div>
                  <div className={`text-sm font-semibold ${remaining < -0.01 ? 'text-red-600' : remaining > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {remaining < -0.01
                      ? `Over by ${formatCurrency(Math.abs(remaining))}`
                      : remaining > 0.01
                        ? `${formatCurrency(remaining)} unallocated`
                        : '✓ Fully allocated'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Define how much parents need to pay each term. Students will see their current term amount and be marked clear when that term is paid.
                The total does not need to equal the full fee — unallocated amounts stay payable as lump sum.
              </p>

              {splitLoading ? (
                <div className="py-6 text-center text-sm text-slate-400">Loading existing splits…</div>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_130px_140px_32px] gap-2 px-1">
                    <span className="text-xs font-medium text-slate-500">Term Name</span>
                    <span className="text-xs font-medium text-slate-500">Amount (USD) *</span>
                    <span className="text-xs font-medium text-slate-500">Due Date *</span>
                    <span />
                  </div>

                  {splitRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_130px_140px_32px] gap-2 items-center">
                      <input
                        type="text"
                        value={row.term_name}
                        onChange={(e) => updateSplitRow(i, 'term_name', e.target.value)}
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        placeholder="e.g. First Term"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount_usd}
                        onChange={(e) => updateSplitRow(i, 'amount_usd', e.target.value)}
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                        placeholder="0.00"
                      />
                      <input
                        type="date"
                        value={row.due_date}
                        onChange={(e) => updateSplitRow(i, 'due_date', e.target.value)}
                        className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      />
                      <button
                        onClick={() => removeSplitRow(i)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove this term"
                        disabled={splitRows.length <= 1}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addSplitRow}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium mt-1"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Add another term
                  </button>
                </div>
              )}

              {/* Running total */}
              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2 text-sm">
                <span className="text-slate-600">Total allocated</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totalAllocated)}</span>
              </div>

              {splitError && (
                <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  {splitError}
                </p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <div>
              {splitFee?.has_installments && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleClearSplit()}
                  loading={splitSaving}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Splits
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeSplitDialog} disabled={splitSaving}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveSplit()}
                loading={splitSaving}
                disabled={splitLoading || splitRows.length === 0}
              >
                <CalendarDays className="h-4 w-4 mr-1" /> Save Term Split
              </Button>
            </div>
          </div>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
