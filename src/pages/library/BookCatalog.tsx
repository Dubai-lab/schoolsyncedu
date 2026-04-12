import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { bookService } from '@/services/libraryService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Search, Trash2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type BookRow = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  year: number | null;
  total: number;
  available: number;
};

const initialForm = {
  title: '', author: '', isbn: '', category: '', description: '',
  publisher: '', publication_year: '', total_copies: '1',
};

export default function BookCatalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const debouncedSearch = useDebounce(search, 400);

  const { data: categories } = useFetch(
    ['book-categories', schoolId],
    () => bookService.getCategories(schoolId),
    { enabled: !!schoolId },
  );

  const { data: result, isLoading } = useFetch(
    ['books', schoolId, String(page), catFilter, debouncedSearch],
    () => bookService.list(schoolId, {
      page, pageSize: 25, category: catFilter || undefined,
      search: debouncedSearch || undefined,
    }),
    { enabled: !!schoolId },
  );

  const createBook = useMutate(
    () => bookService.create(schoolId, {
      title: form.title,
      author: form.author || undefined,
      isbn: form.isbn || undefined,
      category: form.category || undefined,
      description: form.description || undefined,
      publisher: form.publisher || undefined,
      publication_year: form.publication_year ? Number(form.publication_year) : undefined,
      total_copies: Number(form.total_copies) || 1,
    }),
    [['books'], ['book-categories']],
    { onSuccess: () => { setShowCreate(false); setForm(initialForm); } },
  );

  const deleteBook = useMutate(
    (id: string) => bookService.delete(id),
    [['books'], ['book-categories']],
  );

  const rows: BookRow[] = (result?.data ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author ?? '',
    isbn: b.isbn ?? '',
    category: b.category ?? '',
    publisher: b.publisher ?? '',
    year: b.publication_year,
    total: b.total_copies,
    available: b.available_copies,
  }));

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const categoryOptions = (categories ?? []).map((c) => ({ label: c, value: c }));

  const columns: Column<BookRow>[] = [
    { key: 'title', header: 'Title', render: (r) => (
      <div>
        <span className="font-medium text-slate-900">{r.title}</span>
        {r.isbn && <span className="block text-xs text-slate-400 font-mono">{r.isbn}</span>}
      </div>
    )},
    { key: 'author', header: 'Author' },
    { key: 'category', header: 'Category', render: (r) => r.category ? <Badge variant="info" size="sm">{r.category}</Badge> : <span className="text-slate-400">—</span> },
    { key: 'publisher', header: 'Publisher', render: (r) => <span className="text-sm">{r.publisher || '—'}</span> },
    { key: 'year', header: 'Year', render: (r) => <span className="text-sm">{r.year ?? '—'}</span> },
    { key: 'available', header: 'Copies', render: (r) => (
      <span className={`text-sm font-medium ${r.available === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
        {r.available} / {r.total}
      </span>
    )},
    { key: 'id', header: '', render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => deleteBook.mutate(r.id)}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    )},
  ];

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Library' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Book Catalog
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/library/checkout')}>Checkouts</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/library/overdue')}>Overdue</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/library/reports')}>Reports</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Book
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Search title, author, ISBN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select label="Category" options={categoryOptions} value={catFilter}
          onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
          placeholder="All Categories" className="w-44" />
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No books found." />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Create Book Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Title *" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Author" value={form.author} onChange={(e) => set('author', e.target.value)} />
              <Input label="ISBN" value={form.isbn} onChange={(e) => set('isbn', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Category" value={form.category} onChange={(e) => set('category', e.target.value)} />
              <Input label="Publisher" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Publication Year" type="number" value={form.publication_year} onChange={(e) => set('publication_year', e.target.value)} />
              <Input label="Total Copies *" type="number" value={form.total_copies} onChange={(e) => set('total_copies', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createBook.mutate(undefined)} loading={createBook.isPending} disabled={!form.title}>
            Add Book
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}