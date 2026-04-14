import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { bookService, bookCopyService, checkoutService } from '@/services/libraryService';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import type { BookCondition } from '@/types/common.types';
import {
  Nfc,
  Wifi,
  WifiOff,
  Keyboard,
  Loader2,
  UserCheck,
  BookUp,
  RotateCcw,
  XCircle,
  GraduationCap,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

type ScannedStudent = {
  id: string;
  firstName: string;
  lastName: string;
  registration: string;
};

type ActiveCheckout = {
  checkoutId: string;
  bookCopyId: string;
  bookTitle: string;
  barcode: string;
  dueDate: string;
  isOverdue: boolean;
};

const conditionOptions = [
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Damaged', value: 'damaged' },
];

export default function NfcLibrary() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [mode, setMode] = useState<'checkout' | 'return'>('checkout');
  const [scanning, setScanning] = useState(false);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [activeCheckouts, setActiveCheckouts] = useState<ActiveCheckout[]>([]);
  const [loadingCheckouts, setLoadingCheckouts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Checkout form
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedCopy, setSelectedCopy] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  );

  // Return dialog
  const [returnTarget, setReturnTarget] = useState<ActiveCheckout | null>(null);
  const [returnCondition, setReturnCondition] = useState<BookCondition>('good');

  // Book options for checkout
  const { data: booksResult } = useFetch(
    ['books-available', schoolId],
    () => bookService.list(schoolId, { available: true, pageSize: 200 }),
    { enabled: !!schoolId && mode === 'checkout' && !!student },
  );

  const { data: copies } = useFetch(
    ['book-copies', selectedBook],
    () => bookCopyService.listByBook(selectedBook),
    { enabled: !!selectedBook },
  );

  const bookOptions = (booksResult?.data ?? []).map((b) => ({
    label: `${b.title}${b.author ? ` — ${b.author}` : ''} (${b.available_copies} avail.)`,
    value: b.id,
  }));

  const copyOptions = (copies ?? [])
    .filter((c) => c.status === 'available')
    .map((c) => ({ label: c.barcode, value: c.id }));

  // Fetch student's active checkouts when in return mode
  const fetchActiveCheckouts = useCallback(async (studentId: string) => {
    setLoadingCheckouts(true);
    try {
      const result = await checkoutService.list(schoolId, {
        studentId,
        isReturned: false,
        pageSize: 50,
      });
      const rows: ActiveCheckout[] = result.data.map((c) => {
        const copy = c.book_copies as Record<string, unknown>;
        const book = (copy.books ?? {}) as Record<string, string>;
        return {
          checkoutId: c.id,
          bookCopyId: c.book_copy_id,
          bookTitle: book.title ?? '',
          barcode: (copy.barcode as string) ?? '',
          dueDate: c.due_date,
          isOverdue: new Date(c.due_date) < new Date(),
        };
      });
      setActiveCheckouts(rows);
    } catch {
      notify.error('Failed to load student checkouts.');
    } finally {
      setLoadingCheckouts(false);
    }
  }, [schoolId]);

  // Reset when student changes
  useEffect(() => {
    setSelectedBook('');
    setSelectedCopy('');
    setActiveCheckouts([]);
    if (student && mode === 'return') {
      fetchActiveCheckouts(student.id);
    }
  }, [student, mode, fetchActiveCheckouts]);

  // ── Web NFC listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning) return;
    let abortController: AbortController | null = null;

    async function startNfc() {
      try {
        if (!('NDEFReader' in window)) {
          notify.error('NFC not supported on this device. Use manual entry below.');
          setScanning(false);
          return;
        }
        const NDEFReaderClass = (window as unknown as Record<string, unknown>).NDEFReader as new () => {
          scan: (opts: { signal: AbortSignal }) => Promise<void>;
          addEventListener: (event: string, handler: (e: unknown) => void) => void;
        };
        const ndef = new NDEFReaderClass();
        abortController = new AbortController();
        await ndef.scan({ signal: abortController.signal });
        ndef.addEventListener('reading', (event: unknown) => {
          const e = event as { serialNumber?: string };
          const chipId = (e.serialNumber ?? '').replace(/:/g, '').toUpperCase();
          if (chipId) handleNfcTap(chipId);
        });
        notify.info('NFC scanner active — ask student to tap their card.');
      } catch {
        notify.error('Failed to start NFC reader. Use manual entry.');
        setScanning(false);
      }
    }

    startNfc();
    return () => { abortController?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  // ── NFC tap handler ───────────────────────────────────────────────────────
  const handleNfcTap = useCallback(async (chipId: string) => {
    try {
      const { data: card } = await supabase
        .from('nfc_cards')
        .select('student_id, students:student_id(id, first_name, last_name, registration_number)')
        .eq('school_id', schoolId)
        .eq('nfc_chip_id', chipId)
        .eq('status', 'active')
        .maybeSingle();

      if (!card) {
        notify.error('Card not recognized. Make sure it is registered and active.');
        return;
      }
      const s = (card as Record<string, unknown>).students as {
        id: string; first_name: string; last_name: string; registration_number: string;
      };
      setStudent({ id: s.id, firstName: s.first_name, lastName: s.last_name, registration: s.registration_number });
      setScanning(false);
      notify.success(`Student identified: ${s.first_name} ${s.last_name}`);
    } catch {
      notify.error('NFC lookup failed. Try manual entry.');
    }
  }, [schoolId]);

  // ── Manual lookup by reg number or card number ────────────────────────────
  const handleManualLookup = async () => {
    const val = manualInput.trim().toUpperCase();
    if (!val) return;
    setLookupLoading(true);
    try {
      // Try NFC card number first
      const { data: byCard } = await supabase
        .from('nfc_cards')
        .select('student_id, students:student_id(id, first_name, last_name, registration_number)')
        .eq('school_id', schoolId)
        .eq('card_number', val)
        .eq('status', 'active')
        .maybeSingle();

      if (byCard) {
        const s = (byCard as Record<string, unknown>).students as {
          id: string; first_name: string; last_name: string; registration_number: string;
        };
        setStudent({ id: s.id, firstName: s.first_name, lastName: s.last_name, registration: s.registration_number });
        setManualInput('');
        notify.success(`Student found: ${s.first_name} ${s.last_name}`);
        return;
      }

      // Try registration number
      const { data: byReg } = await supabase
        .from('students')
        .select('id, first_name, last_name, registration_number')
        .eq('school_id', schoolId)
        .eq('registration_number', val)
        .maybeSingle();

      if (byReg) {
        setStudent({ id: byReg.id, firstName: byReg.first_name, lastName: byReg.last_name, registration: byReg.registration_number });
        setManualInput('');
        notify.success(`Student found: ${byReg.first_name} ${byReg.last_name}`);
        return;
      }

      notify.error('No student found. Check the card number or registration number.');
    } catch {
      notify.error('Lookup failed. Try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Checkout mutation ─────────────────────────────────────────────────────
  const doCheckout = useMutate(
    () => {
      if (!student || !selectedCopy) throw new Error('Missing data');
      return checkoutService.checkout({
        student_id: student.id,
        book_copy_id: selectedCopy,
        due_date: dueDate,
        checked_out_by: userId,
      });
    },
    [['book-checkouts'], ['books'], ['books-available']],
    {
      onSuccess: () => {
        notify.success(`Book checked out to ${student?.firstName} ${student?.lastName}`);
        setSelectedBook('');
        setSelectedCopy('');
        setStudent(null);
      },
    },
  );

  // ── Return mutation ───────────────────────────────────────────────────────
  const doReturn = useMutate(
    () => {
      if (!returnTarget || !student) throw new Error('Missing data');
      return checkoutService.returnBook({
        book_copy_id: returnTarget.bookCopyId,
        student_id: student.id,
        condition: returnCondition,
        checked_in_by: userId,
      });
    },
    [['book-checkouts'], ['books'], ['books-available']],
    {
      onSuccess: () => {
        notify.success('Book returned successfully');
        setReturnTarget(null);
        setReturnCondition('good');
        if (student) fetchActiveCheckouts(student.id);
      },
    },
  );

  const clearStudent = () => {
    setStudent(null);
    setSelectedBook('');
    setSelectedCopy('');
    setActiveCheckouts([]);
    setManualInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Library', href: '/librarian' }, { label: 'NFC Checkout / Return' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Nfc className="h-5 w-5 text-violet-600" /> NFC Smart Checkout
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Student taps their NFC card to identify themselves, then select the book action.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('checkout'); setStudent(null); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === 'checkout' ? 'bg-violet-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <BookUp className="h-4 w-4" /> Checkout
        </button>
        <button
          onClick={() => { setMode('return'); setStudent(null); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${mode === 'return' ? 'bg-teal-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <RotateCcw className="h-4 w-4" /> Return
        </button>
      </div>

      {/* Step 1: Identify Student */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* NFC Scanner */}
        <Card className={scanning ? 'border-violet-300 bg-violet-50/30' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              {scanning ? (
                <Wifi className="h-6 w-6 text-violet-600 animate-pulse" />
              ) : (
                <WifiOff className="h-6 w-6 text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-slate-800">
                  {scanning ? 'Waiting for card tap…' : 'NFC Scanner'}
                </p>
                <p className="text-xs text-slate-500">
                  {scanning ? 'Ask the student to tap their ID card' : 'Tap to start, then student taps card'}
                </p>
              </div>
            </div>
            <Button
              variant={scanning ? 'danger' : 'primary'}
              size="sm"
              className="w-full"
              onClick={() => setScanning(!scanning)}
              disabled={!!student}
            >
              {scanning ? 'Stop Scanner' : 'Start NFC Scanner'}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="h-6 w-6 text-slate-400" />
              <div>
                <p className="font-semibold text-slate-800">Manual Lookup</p>
                <p className="text-xs text-slate-500">Enter card number or registration number</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Card # or Reg #"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup(); }}
                disabled={!!student}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleManualLookup}
                disabled={lookupLoading || !manualInput.trim() || !!student}
              >
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 2: Student identified */}
      {student && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs font-mono text-slate-500">{student.registration}</p>
                </div>
              </div>
              <button
                onClick={clearStudent}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
              >
                <XCircle className="h-4 w-4" /> Clear
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3a: Checkout form */}
      {student && mode === 'checkout' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookUp className="h-5 w-5 text-violet-600" /> Select Book to Check Out
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            <Select
              label="Book"
              options={bookOptions}
              value={selectedBook}
              onChange={(e) => { setSelectedBook(e.target.value); setSelectedCopy(''); }}
              placeholder="Select an available book…"
            />
            {selectedBook && copyOptions.length > 0 && (
              <Select
                label="Copy (Barcode)"
                options={copyOptions}
                value={selectedCopy}
                onChange={(e) => setSelectedCopy(e.target.value)}
                placeholder="Select a copy…"
              />
            )}
            {selectedBook && copyOptions.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No available copies for this book.
              </div>
            )}
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => doCheckout.mutate(undefined)}
              loading={doCheckout.isPending}
              disabled={!selectedCopy || !dueDate}
            >
              <BookUp className="h-4 w-4 mr-2" /> Confirm Checkout
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3b: Return list */}
      {student && mode === 'return' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-teal-600" /> Active Checkouts
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {loadingCheckouts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : activeCheckouts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <GraduationCap className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">This student has no active checkouts.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeCheckouts.map((co) => (
                  <div key={co.checkoutId} className="flex items-center gap-3 py-3">
                    <BookOpen className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{co.bookTitle}</p>
                      <p className="text-xs text-slate-400 font-mono">{co.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {co.isOverdue ? (
                        <Badge variant="danger" size="sm">Overdue</Badge>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Due {new Date(co.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setReturnTarget(co); setReturnCondition('good'); }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Return Condition Dialog */}
      <Dialog open={!!returnTarget} onClose={() => setReturnTarget(null)}>
        <DialogHeader>
          <DialogTitle>Return Book</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {returnTarget && (
            <p className="text-sm text-slate-600">
              Returning <strong>{returnTarget.bookTitle}</strong> (copy: <span className="font-mono">{returnTarget.barcode}</span>)
            </p>
          )}
          <Select
            label="Book Condition"
            options={conditionOptions}
            value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value as BookCondition)}
          />
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
