import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { subjectService } from '@/services/classService';
import type { Subject } from '@/types/school.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Loader2,
} from 'lucide-react';

// ==================== FORM STATE ====================

interface SubjectForm {
  name: string;
  code: string;
  description: string;
}

const emptyForm: SubjectForm = { name: '', code: '', description: '' };

// ==================== COMPONENT ====================

export default function SubjectList() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectForm>(emptyForm);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: result, isLoading } = useFetch(
    ['subjects', schoolId],
    () => subjectService.list(schoolId),
    { enabled: !!schoolId },
  );

  const subjects = result?.data ?? [];
  const filtered = debouncedSearch
    ? subjects.filter(
        (s) =>
          s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (s.code ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : subjects;

  // ===== Create / Update =====
  const saveMutation = useMutate(
    async () => {
      if (editing) {
        return subjectService.update(editing.id, {
          name: form.name,
          code: form.code,
          description: form.description || undefined,
        });
      }
      return subjectService.create(schoolId, {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
      });
    },
    [['subjects']],
    {
      onSuccess: () => {
        setShowDialog(false);
        setEditing(null);
        setForm(emptyForm);
      },
    },
  );

  // ===== Delete =====
  const deleteMutation = useMutate(
    (id: string) => subjectService.delete(id),
    [['subjects']],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setForm({
      name: subject.name,
      code: subject.code ?? '',
      description: subject.description ?? '',
    });
    setShowDialog(true);
  };

  const handleDelete = (subject: Subject) => {
    if (!confirm(`Delete "${subject.name}"? This will also remove it from any class assignments.`)) return;
    deleteMutation.mutate(subject.id);
  };

  // ==================== TABLE COLUMNS ====================

  const columns: Column<Subject>[] = [
    {
      key: 'code',
      header: 'Code',
      className: 'w-28',
      render: (row) => (
        <Badge variant="info" size="sm">
          {row.code || '—'}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'Subject Name',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Added',
      className: 'w-32',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition"
            title="Edit"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
            title="Delete"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Academic', href: '/classes' },
          { label: 'Subjects' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''} defined for your school
          </p>
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Add Subject
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Table */}
      <Table<Subject>
        columns={columns}
        data={filtered}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No subjects found. Click 'Add Subject' to create one."
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onClose={() => { setShowDialog(false); setEditing(null); }}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Subject' : 'New Subject'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <Input
              label="Subject Name"
              placeholder="e.g. Mathematics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Subject Code"
              placeholder="e.g. MATH"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition resize-none"
                rows={3}
                placeholder="Brief description of the subject..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowDialog(false); setEditing(null); }}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate(undefined)}
            disabled={!form.name.trim() || !form.code.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editing ? 'Saving...' : 'Creating...'}</>
            ) : (
              editing ? 'Save Changes' : 'Create Subject'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
