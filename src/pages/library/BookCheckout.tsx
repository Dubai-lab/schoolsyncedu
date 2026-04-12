import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { checkoutService, bookService, bookCopyService } from '@/services/libraryService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { BookOpen, RotateCcw, Plus } from 'lucide-react';
import { notify } from '@/components/shared/Toast';
import type { BookCondition } from '@/types/common.types';

type CheckoutRow = {
  id: string;
  studentName: string;
  studentIdNum: string;
  bookTitle: string;
  barcode: string;
  checkoutDate: string;
  dueDate: string;
  isReturned: boolean;
  bookCopyId: string;
  studentId: string;
};

const conditionOptions = [
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Damaged', value: 'damaged' },
];

export default function BookCheckout() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [page, setPage] = useState(1);
  const [showReturned, setShowReturned] = useState(false);

  // Checkout dialog state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ studentId: '', bookId: '', copyId: '', dueDate: '' });

  // Return dialog state
  const [returnTarget, setReturnTarget] = useState<{ bookCopyId: string; studentId: string } | null>(null);
  const [returnCondition, setReturnCondition] = useState<BookCondition>('good');

  const { data: result, isLoading } = useFetch(
    ['book-checkouts', schoolId, String(page), String(showReturned)],
    () => checkoutService.list(schoolId, { page, pageSize: 25, isReturned: showReturned ? undefined : false }),
    { enabled: !!schoolId },
  );

  // For checkout dialog — get available books
  const { data: booksResult } = useFetch(
    ['books-available', schoolId],
    () => bookService.list(schoolId, { available: true, pageSize: 200 }),
    { enabled: !!schoolId && showCheckout },
  );

  // Get copies for selected book
  const { data: copies } = useFetch(
    ['book-copies', checkoutForm.bookId],
    () => bookCopyService.listByBook(checkoutForm.bookId),
    { enabled: !!checkoutForm.bookId },
  );

  const doCheckout = useMutate(
    () => checkoutService.checkout({
      student_id: checkoutForm.studentId,
      book_copy_id: checkoutForm.copyId,
      due_date: checkoutForm.dueDate,
      checked_out_by: userId,
    }),
    [['book-checkouts'], ['books'], ['books-available']],
    {
      onSuccess: () => {
        notify.success('Book checked out');
        setShowCheckout(false);
        setCheckoutForm({ studentId: '', bookId: '', copyId: '', dueDate: '' });
      },
    },
  );

  const doReturn = useMutate(
    () => {
      if (!returnTarget) throw new Error('No return target');
      return checkoutService.returnBook({
        book_copy_id: returnTarget.bookCopyId,
        student_id: returnTarget.studentId,
        condition: returnCondition,
        checked_in_by: userId,
      });
    },
    [['book-checkouts'], ['books'], ['books-available']],
    {
      onSuccess: () => {
        notify.success('Book returned');
        setReturnTarget(null);
        setReturnCondition('good');
      },
    },
  );

  const rows: CheckoutRow[] = (result?.data ?? []).map((c) => {
    const student = c.students as Record<string, string> | undefined;
    const copy = c.book_copies as Record<string, unknown> | undefined;
    const book = (copy?.books ?? {}) as Record<string, string>;
    return {
      id: c.id,
      studentName: student ? `${student.first_name} ${student.last_name}` : '',
      studentIdNum: student?.registration_number ?? '',
      bookTitle: book?.title ?? '',
      barcode: (copy?.barcode as string) ?? '',
      checkoutDate: c.checkout_date,
      dueDate: c.due_date,
      isReturned: c.is_returned,
      bookCopyId: c.book_copy_id,
      studentId: c.student_id,
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);
  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  const bookOptions = (booksResult?.data ?? []).map((b) => ({
    label: `${b.title}${b.author ? ` — ${b.author}` : ''} (${b.available_copies} avail)`,
    value: b.id,
  }));

  const copyOptions = (copies ?? []).filter((c) => c.status === 'available').map((c) => ({
    label: `${c.barcode}`,
    value: c.id,
  }));

  const columns: Column<CheckoutRow>[] = [
    { key: 'studentName', header: 'Student', render: (r) => (
      <div>
        <span className="font-medium text-slate-900">{r.studentName}</span>
        <span className="block text-xs text-slate-400">{r.studentIdNum}</span>
      </div>
    )},
    { key: 'bookTitle', header: 'Book', render: (r) => <span className="font-medium">{r.bookTitle}</span> },
    { key: 'barcode', header: 'Copy', render: (r) => <span className="font-mono text-xs text-slate-500">{r.barcode}</span> },
    { key: 'checkoutDate', header: 'Checked Out', render: (r) => <span className="text-sm">{new Date(r.checkoutDate).toLocaleDateString()}</span> },
    { key: 'dueDate', header: 'Due Date', render: (r) => (
      <span className={`text-sm font-medium ${!r.isReturned && isOverdue(r.dueDate) ? 'text-red-600' : 'text-slate-700'}`}>
        {new Date(r.dueDate).toLocaleDateString()}
      </span>
    )},
    { key: 'isReturned', header: 'Status', render: (r) => (
      r.isReturned
        ? <Badge variant="success" size="sm">Returned</Badge>
        : isOverdue(r.dueDate) ? <Badge variant="danger" size="sm">Overdue</Badge> : <Badge variant="warning" size="sm">Checked Out</Badge>
    )},
    { key: 'id', header: '', render: (r) => {
      if (r.isReturned) return null;
      return (
        <Button size="sm" variant="outline" onClick={() => setReturnTarget({ bookCopyId: r.bookCopyId, studentId: r.studentId })}>
          <RotateCcw className="h-4 w-4 mr-1" /> Return
        </Button>
      );
    }},
  ];

  // Default due date: 14 days from now
  const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Library', href: '/library' }, { label: 'Checkouts' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Book Checkouts
        </h1>
        <Button size="sm" onClick={() => { setShowCheckout(true); setCheckoutForm((f) => ({ ...f, dueDate: defaultDue })); }}>
          <Plus className="h-4 w-4 mr-1" /> New Checkout
        </Button>
      </div>

      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showReturned} onChange={(e) => { setShowReturned(e.target.checked); setPage(1); }}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
          Include returned
        </label>
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No checkouts found." />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onClose={() => setShowCheckout(false)}>
        <DialogHeader><DialogTitle>Check Out Book</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Student ID *" value={checkoutForm.studentId}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, studentId: e.target.value }))}
              placeholder="Enter student UUID or ID number" />
            <Select label="Book *" options={bookOptions} value={checkoutForm.bookId}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, bookId: e.target.value, copyId: '' }))}
              placeholder="Select a book" />
            {checkoutForm.bookId && (
              <Select label="Copy *" options={copyOptions} value={checkoutForm.copyId}
                onChange={(e) => setCheckoutForm((f) => ({ ...f, copyId: e.target.value }))}
                placeholder="Select a copy" />
            )}
            <Input label="Due Date *" type="date" value={checkoutForm.dueDate}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCheckout(false)}>Cancel</Button>
          <Button onClick={() => doCheckout.mutate(undefined)} loading={doCheckout.isPending}
            disabled={!checkoutForm.studentId || !checkoutForm.copyId || !checkoutForm.dueDate}>
            Check Out
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returnTarget} onClose={() => setReturnTarget(null)}>
        <DialogHeader><DialogTitle>Return Book</DialogTitle></DialogHeader>
        <DialogBody>
          <Select label="Condition" options={conditionOptions} value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value as BookCondition)} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setReturnTarget(null)}>Cancel</Button>
          <Button onClick={() => doReturn.mutate(undefined)} loading={doReturn.isPending}>
            Confirm Return
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}