import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { letterTemplateService, letterTemplateAccessService } from '@/services/letterService';
import { LETTER_CATEGORIES, LETTER_SEVERITY, USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Trash2, ShieldCheck, Info } from 'lucide-react';
import type { LetterCategory, LetterSeverity, LetterTemplateAccess } from '@/types/letter.types';

// ---- Role constants ----
// These roles can create, edit, and delete letter templates
const TEMPLATE_MANAGERS: UserRole[] = [
  USER_ROLES.PRINCIPAL,
  USER_ROLES.VICE_PRINCIPAL,
  USER_ROLES.ADMIN_STAFF,
  USER_ROLES.IT_ADMIN,
];
// Only these roles can manage which staff has access to which template
const ACCESS_MANAGERS: UserRole[] = [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL];

// Staff roles that can be assigned access to templates (excludes leadership who see all)
const ASSIGNABLE_ROLES: { label: string; value: UserRole }[] = [
  { label: 'Registrar', value: USER_ROLES.REGISTRAR },
  { label: 'Bursar', value: USER_ROLES.BURSAR },
  { label: 'Dean of Students', value: USER_ROLES.DEAN },
  { label: 'Admin Staff', value: USER_ROLES.ADMIN_STAFF },
  { label: 'Teacher', value: USER_ROLES.TEACHER },
  { label: 'Librarian', value: USER_ROLES.LIBRARIAN },
  { label: 'Guidance Counselor', value: USER_ROLES.COUNSELOR },
];

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  letter_type: string;
  severity: string;
  subject: string;
  is_starter: boolean;
};

const categoryOptions = Object.entries(LETTER_CATEGORIES).map(([, v]) => ({
  label: (v as string).charAt(0).toUpperCase() + (v as string).slice(1),
  value: v as string,
}));

const severityOptions = Object.entries(LETTER_SEVERITY).map(([, v]) => ({
  label: (v as string).charAt(0).toUpperCase() + (v as string).slice(1),
  value: v as string,
}));

function severityVariant(s: string) {
  if (s === 'critical') return 'danger' as const;
  if (s === 'high') return 'warning' as const;
  if (s === 'medium') return 'info' as const;
  return 'default' as const;
}

export default function LetterTemplates() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const userRole = (user?.role ?? '') as UserRole;

  const isManager = TEMPLATE_MANAGERS.includes(userRole);
  const canManageAccess = ACCESS_MANAGERS.includes(userRole);

  const [filterCategory, setFilterCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', category: '' as string, letter_type: '', severity: 'low' as string,
    subject: '', body_html: '',
  });

  // Access management dialog state
  const [accessTemplate, setAccessTemplate] = useState<TemplateRow | null>(null);
  const [accessGrants, setAccessGrants] = useState<LetterTemplateAccess[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Fetch templates — RLS automatically filters:
  // • Leadership sees all templates for their school
  // • Other staff see only templates where they have a grant
  const { data: result, isLoading } = useFetch(
    ['letter-templates', schoolId, filterCategory],
    () => letterTemplateService.list(schoolId, (filterCategory as LetterCategory) || undefined),
    { enabled: !!schoolId },
  );

  const createMutation = useMutate(
    () => letterTemplateService.create(schoolId, {
      name: form.name,
      category: form.category as LetterCategory,
      letter_type: form.letter_type,
      severity: form.severity as LetterSeverity,
      subject: form.subject,
      body_html: form.body_html,
      created_by: userId,
    }),
    [['letter-templates']],
    {
      onSuccess: () => {
        notify.success('Template created');
        setShowCreate(false);
        setForm({ name: '', category: '', letter_type: '', severity: 'low', subject: '', body_html: '' });
      },
    },
  );

  const deleteMutation = useMutate(
    (id: string) => letterTemplateService.delete(id),
    [['letter-templates']],
    { onSuccess: () => notify.success('Template deleted') },
  );

  // Open access management dialog and load current grants
  const openAccessDialog = async (row: TemplateRow) => {
    setAccessTemplate(row);
    setAccessLoading(true);
    setSelectedRoles([]);
    try {
      const grants = await letterTemplateAccessService.listByTemplate(row.id);
      setAccessGrants(grants);
      setSelectedRoles(grants.map((g) => g.role));
    } catch {
      notify.error('Failed to load access grants');
    } finally {
      setAccessLoading(false);
    }
  };

  const closeAccessDialog = () => {
    setAccessTemplate(null);
    setAccessGrants([]);
    setSelectedRoles([]);
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const saveAccess = async () => {
    if (!accessTemplate) return;
    setSavingAccess(true);
    try {
      await letterTemplateAccessService.setRolesForTemplate(
        schoolId, accessTemplate.id, selectedRoles, userId,
      );
      notify.success('Access updated');
      closeAccessDialog();
    } catch {
      notify.error('Failed to save access changes');
    } finally {
      setSavingAccess(false);
    }
  };

  const rows: TemplateRow[] = (result?.data ?? []).map((t) => ({
    id: t.id, name: t.name, category: t.category, letter_type: t.letter_type,
    severity: t.severity, subject: t.subject, is_starter: t.is_starter,
  }));

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const columns: Column<TemplateRow>[] = [
    {
      key: 'name', header: 'Template Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{r.name}</span>
          {r.is_starter && (
            <Badge variant="info" size="sm">Default</Badge>
          )}
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (r) => <span className="capitalize text-sm">{r.category}</span> },
    { key: 'letter_type', header: 'Type', render: (r) => <span className="text-sm text-slate-500">{r.letter_type.replace(/_/g, ' ')}</span> },
    { key: 'severity', header: 'Severity', render: (r) => <Badge variant={severityVariant(r.severity)} size="sm">{r.severity}</Badge> },
    { key: 'subject', header: 'Subject', render: (r) => <span className="text-sm text-slate-500 truncate max-w-[200px] block">{r.subject}</span> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          {canManageAccess && (
            <button
              onClick={(e) => { e.stopPropagation(); void openAccessDialog(r); }}
              title="Manage staff access"
              className="text-slate-400 hover:text-primary-600 p-1 rounded transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
          {isManager && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}
              title="Delete template"
              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Letters', href: '/letters' }, { label: 'Templates' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Letter Templates</h1>
          {!isManager && (
            <p className="text-sm text-slate-500 mt-0.5">
              Showing templates assigned to your role by the Principal.
            </p>
          )}
        </div>
        {isManager && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        )}
      </div>

      {/* Info banner for principal: explains the access system */}
      {canManageAccess && (
        <div className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Click the <ShieldCheck className="inline h-3.5 w-3.5" /> icon on any template to control which staff roles
            can see and use it. Staff will only see templates you assign to their role.
            Default templates are pre-configured with appropriate role access.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Select
          label="Filter by Category"
          options={categoryOptions}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          placeholder="All Categories"
          className="w-48"
        />
      </div>

      <Table
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage={isManager ? 'No templates yet. Create your first template.' : 'No templates assigned to your role yet.'}
      />

      {/* ── Create Template Dialog (leadership only) ── */}
      {isManager && (
        <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Letter Template</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <Input label="Template Name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" options={categoryOptions} value={form.category}
                onChange={(e) => setField('category', e.target.value)} placeholder="Select" />
              <Select label="Severity" options={severityOptions} value={form.severity}
                onChange={(e) => setField('severity', e.target.value)} />
            </div>
            <Input label="Letter Type (slug)" value={form.letter_type}
              onChange={(e) => setField('letter_type', e.target.value)}
              placeholder="e.g. acceptance_letter" />
            <Input label="Subject Line" value={form.subject}
              onChange={(e) => setField('subject', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Body (HTML)</label>
              <textarea
                value={form.body_html}
                onChange={(e) => setField('body_html', e.target.value)}
                rows={8}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 font-mono"
                placeholder="Dear {{student_name}}, ..."
              />
              <p className="text-xs text-slate-400 mt-1">
                Use {'{{placeholder_name}}'} for dynamic fields. Common: {'{{school_name}}'}, {'{{student_name}}'}, {'{{date}}'}, {'{{principal_name}}'}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(undefined)}
              loading={createMutation.isPending}
              disabled={!form.name || !form.category || !form.subject}
            >
              Create Template
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* ── Access Management Dialog (principal/vice_principal only) ── */}
      {canManageAccess && (
        <Dialog open={!!accessTemplate} onClose={closeAccessDialog}>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary-600" />
                Manage Access
              </div>
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {accessTemplate && (
              <>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">{accessTemplate.name}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">
                    {accessTemplate.category} · {accessTemplate.letter_type.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className="text-sm text-slate-600">
                  Select which staff roles can see and use this template on their dashboard.
                  Principal and Vice Principal always have access to all templates.
                </p>
                {accessLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Loading access grants…</div>
                ) : (
                  <div className="space-y-2">
                    {ASSIGNABLE_ROLES.map(({ label, value }) => (
                      <label
                        key={value}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(value)}
                          onChange={() => toggleRole(value)}
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-800">{label}</span>
                          {accessGrants.some((g) => g.role === value) && (
                            <Badge variant="success" size="sm" className="ml-2">Has access</Badge>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeAccessDialog}>Cancel</Button>
            <Button
              onClick={() => void saveAccess()}
              loading={savingAccess}
              disabled={accessLoading}
            >
              <ShieldCheck className="h-4 w-4 mr-1" /> Save Access
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
