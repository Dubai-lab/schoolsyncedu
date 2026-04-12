import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { itAdminSiteService } from '@/services/itAdminService';
import type { School, SiteConfig, FeeScheduleConfig, FeeScheduleCategory, FeeScheduleItem } from '@/types/school.types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import {
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  DollarSign,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Copy,
  BookOpen,
} from 'lucide-react';

const GRADE_PRESETS = [
  'Nursery 1', 'Nursery 2', 'Kindergarten 1', 'Kindergarten 2',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade',
  '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade',
];

const FEE_TYPE_PRESETS = [
  'Tuition', 'Registration', 'Exam', 'Activity', 'Library',
  'Transportation', 'Facility', 'Uniform', 'Technology', 'Lab', 'Sports',
];

const emptyItem = (): FeeScheduleItem => ({
  grade_or_class: '',
  fee_type: 'Tuition',
  amount_usd: 0,
  amount_lrd: undefined,
  description: '',
});

const emptyCategory = (): FeeScheduleCategory => ({
  name: '',
  description: '',
  items: [emptyItem()],
});

const defaultSchedule = (): FeeScheduleConfig => ({
  published: false,
  page_title: '',
  header_text: '',
  footnote: '',
  academic_year: '',
  currency_label: 'USD',
  show_lrd: true,
  categories: [emptyCategory()],
});

export default function FeeScheduleEditor() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, isLoading } = useFetch<School>(
    ['fee-schedule-school', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const existingConfig: SiteConfig = school?.site_config ?? {};
  const saved: FeeScheduleConfig = existingConfig.fee_schedule ?? defaultSchedule();

  const [draft, setDraft] = useState<FeeScheduleConfig | null>(null);
  const fees = draft ?? saved;

  // Track if user has started editing
  const [touched, setTouched] = useState(false);

  const update = (partial: Partial<FeeScheduleConfig>) => {
    setDraft((prev) => ({ ...(prev ?? saved), ...partial }));
    setTouched(true);
  };

  // Category helpers
  const updateCategory = (idx: number, partial: Partial<FeeScheduleCategory>) => {
    const cats = [...fees.categories];
    cats[idx] = { ...cats[idx], ...partial };
    update({ categories: cats });
  };
  const addCategory = () => update({ categories: [...fees.categories, emptyCategory()] });
  const removeCategory = (idx: number) => {
    if (fees.categories.length <= 1) return;
    update({ categories: fees.categories.filter((_, i) => i !== idx) });
  };
  const moveCategory = (idx: number, dir: -1 | 1) => {
    const cats = [...fees.categories];
    const target = idx + dir;
    if (target < 0 || target >= cats.length) return;
    [cats[idx], cats[target]] = [cats[target], cats[idx]];
    update({ categories: cats });
  };

  // Item helpers
  const updateItem = (catIdx: number, itemIdx: number, partial: Partial<FeeScheduleItem>) => {
    const cats = [...fees.categories];
    const items = [...cats[catIdx].items];
    items[itemIdx] = { ...items[itemIdx], ...partial };
    cats[catIdx] = { ...cats[catIdx], items };
    update({ categories: cats });
  };
  const addItem = (catIdx: number) => {
    const cats = [...fees.categories];
    cats[catIdx] = { ...cats[catIdx], items: [...cats[catIdx].items, emptyItem()] };
    update({ categories: cats });
  };
  const removeItem = (catIdx: number, itemIdx: number) => {
    const cats = [...fees.categories];
    if (cats[catIdx].items.length <= 1) return;
    cats[catIdx] = { ...cats[catIdx], items: cats[catIdx].items.filter((_, i) => i !== itemIdx) };
    update({ categories: cats });
  };
  const duplicateItem = (catIdx: number, itemIdx: number) => {
    const cats = [...fees.categories];
    const clone = { ...cats[catIdx].items[itemIdx] };
    cats[catIdx] = { ...cats[catIdx], items: [...cats[catIdx].items.slice(0, itemIdx + 1), clone, ...cats[catIdx].items.slice(itemIdx + 1)] };
    update({ categories: cats });
  };

  // Quick-fill: fill all grades in a category
  const fillAllGrades = (catIdx: number) => {
    const cats = [...fees.categories];
    const template = cats[catIdx].items[0] ?? emptyItem();
    cats[catIdx] = {
      ...cats[catIdx],
      items: GRADE_PRESETS.map((grade) => ({ ...template, grade_or_class: grade })),
    };
    update({ categories: cats });
  };

  // Expanded / collapsed categories
  const [collapsedCats, setCollapsedCats] = useState<Set<number>>(new Set());
  const toggleCollapse = (idx: number) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // Save
  const updateMutation = useMutate(
    (payload: Partial<School>) => itAdminSiteService.updateSchool(schoolId, payload),
    [['fee-schedule-school', schoolId]],
  );

  const handleSave = () => {
    if (!touched || !draft) return;
    const payload: Partial<School> = {
      site_config: { ...existingConfig, fee_schedule: draft } as SiteConfig,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        notify.success('Fee schedule saved');
        setTouched(false);
      },
      onError: () => notify.error('Failed to save fee schedule'),
    });
  };

  // Toggle publish
  const togglePublish = () => {
    const next = !fees.published;
    const newDraft = { ...(draft ?? saved), published: next };
    setDraft(newDraft);
    setTouched(true);
    // Auto-save on publish toggle
    const payload: Partial<School> = {
      site_config: { ...existingConfig, fee_schedule: newDraft } as SiteConfig,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        notify.success(next ? 'Fee page published' : 'Fee page unpublished');
        setTouched(false);
      },
      onError: () => notify.error('Failed to update publish status'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalItems = fees.categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="space-y-6 pb-24">
      <Breadcrumb
        items={[
          { label: 'School Website', href: '/it-admin/site' },
          { label: 'Fee Schedule Editor' },
        ]}
      />

      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Fee Schedule Editor
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Design the public fee information page for your school.
            {totalItems > 0 && (
              <span className="ml-2 text-gray-400">({fees.categories.length} categories · {totalItems} items)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {school?.slug && (
            <a
              href={`/school/${school.slug}/fees`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Preview
            </a>
          )}
          <Button
            variant={fees.published ? 'outline' : 'primary'}
            onClick={togglePublish}
            disabled={updateMutation.isPending}
          >
            {fees.published ? <><EyeOff className="h-4 w-4 mr-1" /> Unpublish</> : <><Eye className="h-4 w-4 mr-1" /> Publish</>}
          </Button>
          <Button onClick={handleSave} disabled={!touched || updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {fees.published && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
          <Eye className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800 font-medium">Published</span>
          <span className="text-sm text-green-600">— Students and parents can view the fee page on your school site.</span>
        </div>
      )}

      {/* ===== PAGE SETTINGS ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" /> Page Settings
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Input
            label="Page Title"
            placeholder={`${school?.name ?? 'School'} — Fee Information`}
            value={fees.page_title ?? ''}
            onChange={(e) => update({ page_title: e.target.value })}
          />
          <Input
            label="Academic Year"
            placeholder="e.g. 2024-2025"
            value={fees.academic_year ?? ''}
            onChange={(e) => update({ academic_year: e.target.value })}
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Header Description</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="A brief intro shown below the page title..."
              value={fees.header_text ?? ''}
              onChange={(e) => update({ header_text: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Footnote / Disclaimer</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Fees are subject to change. Contact the school for the latest rates."
              value={fees.footnote ?? ''}
              onChange={(e) => update({ footnote: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-6">
            <Input
              label="Currency Label"
              placeholder="USD"
              value={fees.currency_label ?? 'USD'}
              onChange={(e) => update({ currency_label: e.target.value })}
              className="w-32"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={fees.show_lrd ?? false}
                onChange={(e) => update({ show_lrd: e.target.checked })}
              />
              Show LRD column (Liberian Dollar)
            </label>
          </div>
        </div>
      </Card>

      {/* ===== FEE CATEGORIES ===== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Fee Categories</h2>
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="h-4 w-4 mr-1" /> Add Category
          </Button>
        </div>

        {fees.categories.map((cat, ci) => {
          const collapsed = collapsedCats.has(ci);
          return (
            <Card key={ci} className="overflow-hidden">
              {/* Category header */}
              <div
                className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3 cursor-pointer"
                onClick={() => toggleCollapse(ci)}
              >
                <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-gray-800">
                  {cat.name || `Category ${ci + 1}`}
                  <span className="ml-2 text-xs font-normal text-gray-400">({cat.items.length} items)</span>
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                    onClick={() => moveCategory(ci, -1)}
                    disabled={ci === 0}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                    onClick={() => moveCategory(ci, 1)}
                    disabled={ci === fees.categories.length - 1}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    onClick={() => removeCategory(ci)}
                    disabled={fees.categories.length <= 1}
                    title="Remove category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
              </div>

              {/* Category body */}
              {!collapsed && (
                <div className="p-5 space-y-4">
                  {/* Category meta */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Category Name"
                      placeholder="e.g. Elementary School Fees"
                      value={cat.name}
                      onChange={(e) => updateCategory(ci, { name: e.target.value })}
                    />
                    <Input
                      label="Description (optional)"
                      placeholder="e.g. Fees for 1st Grade through 6th Grade"
                      value={cat.description ?? ''}
                      onChange={(e) => updateCategory(ci, { description: e.target.value })}
                    />
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      onClick={() => fillAllGrades(ci)}
                    >
                      <GraduationCap className="h-3 w-3" /> Fill All Grades (Nursery–12)
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      onClick={() => addItem(ci)}
                    >
                      <Plus className="h-3 w-3" /> Add Row
                    </button>
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/80">
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-48">Grade / Class</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36">Fee Type</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-28 text-right">Amount (USD)</th>
                          {fees.show_lrd && (
                            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-28 text-right">Amount (LRD)</th>
                          )}
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cat.items.map((item, ii) => (
                          <tr key={ii} className="hover:bg-gray-50/40">
                            <td className="px-3 py-1.5">
                              <select
                                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={item.grade_or_class}
                                onChange={(e) => updateItem(ci, ii, { grade_or_class: e.target.value })}
                              >
                                <option value="">Select grade...</option>
                                {GRADE_PRESETS.map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="__custom">Custom...</option>
                              </select>
                              {item.grade_or_class === '__custom' && (
                                <input
                                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                                  placeholder="Enter custom name"
                                  onChange={(e) => updateItem(ci, ii, { grade_or_class: e.target.value })}
                                />
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={item.fee_type}
                                onChange={(e) => updateItem(ci, ii, { fee_type: e.target.value })}
                              >
                                {FEE_TYPE_PRESETS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={item.amount_usd}
                                onChange={(e) => updateItem(ci, ii, { amount_usd: parseFloat(e.target.value) || 0 })}
                              />
                            </td>
                            {fees.show_lrd && (
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  value={item.amount_lrd ?? ''}
                                  placeholder="—"
                                  onChange={(e) => updateItem(ci, ii, { amount_lrd: e.target.value ? parseFloat(e.target.value) : undefined })}
                                />
                              </td>
                            )}
                            <td className="px-3 py-1.5">
                              <input
                                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Optional note"
                                value={item.description ?? ''}
                                onChange={(e) => updateItem(ci, ii, { description: e.target.value })}
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                  onClick={() => duplicateItem(ci, ii)}
                                  title="Duplicate row"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                  onClick={() => removeItem(ci, ii)}
                                  disabled={cat.items.length <= 1}
                                  title="Remove row"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => addItem(ci)}
                  >
                    <Plus className="h-4 w-4" /> Add another row
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Sticky save bar */}
      {touched && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-sm text-gray-500">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setDraft(null); setTouched(false); }}
              >
                Discard
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
