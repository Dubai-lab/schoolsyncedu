import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { bursarImportService } from '@/services/bursarService';
import { notify } from '@/components/shared/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Search, User, DollarSign, CheckCircle2, AlertTriangle, X,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

function feeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    registration_fee: 'Registration Fee',
    tuition_fee:      'Tuition Fee',
    exam_fee:         'Exam Fee',
    activity_fee:     'Activity Fee',
    uniform_fee:      'Uniform Fee',
    other:            'Other Fee',
  };
  return labels[type] ?? type;
}

type StudentResult = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  current_grade_level: string;
  classes: { name: string } | null;
};

type StudentFeeRow = {
  id: string;
  student_id: string;
  school_id: string;
  fee_structure_id: string;
  academic_year: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
  fee_structures: {
    fee_type: string;
    academic_year: string;
    grade_level: string;
  } | null;
};

// ── Correction modal ───────────────────────────────────────────────────────

function CorrectionModal({
  fee,
  onClose,
  onSaved,
}: {
  fee: StudentFeeRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paidAmount, setPaidAmount] = useState(String(fee.amount_paid));
  const [reason, setReason]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const feeLabel = feeTypeLabel(fee.fee_structures?.fee_type ?? '');
  const year     = fee.fee_structures?.academic_year ?? fee.academic_year;

  const handleSave = async () => {
    const parsed = parseFloat(paidAmount);
    if (isNaN(parsed) || parsed < 0) {
      setError('Enter a valid paid amount (0 or greater)');
      return;
    }
    if (parsed > fee.amount_due) {
      setError(`Cannot exceed the amount due (${formatCurrency(fee.amount_due)})`);
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for the audit record');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await bursarImportService.correctFee(fee.id, parsed, reason.trim());
      notify.success('Fee record updated and audit entry created');
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? 'Could not save correction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Correct Fee Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">{feeLabel} — {year}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current state */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Amount Due</p>
              <p className="font-bold text-slate-800">{formatCurrency(fee.amount_due)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Currently Paid</p>
              <p className="font-bold text-slate-800">{formatCurrency(fee.amount_paid)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Balance</p>
              <p className={`font-bold ${fee.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(fee.balance)}
              </p>
            </div>
          </div>

          {/* New paid amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Corrected Amount Paid ($)
            </label>
            <Input
              type="number"
              min="0"
              max={fee.amount_due}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0.00"
            />
            {parseFloat(paidAmount) !== fee.amount_paid && !isNaN(parseFloat(paidAmount)) && (
              <p className="text-xs text-slate-500 mt-1">
                New balance: <strong>{formatCurrency(fee.amount_due - parseFloat(paidAmount))}</strong>
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student paid $300 in previous system — updating balance from old records"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              This reason will be saved in the payment audit record for the Principal and Proprietor.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void handleSave()} loading={saving}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Save Correction
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function FeeCorrection() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [query, setQuery]                   = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [editingFee, setEditingFee]         = useState<StudentFeeRow | null>(null);
  const [feesKey, setFeesKey]               = useState(0); // increment to refetch fees

  const debouncedQuery = useDebounce(query, 300);

  const { data: searchResults = [], isLoading: searching } = useFetch(
    ['student-search', schoolId, debouncedQuery],
    () => bursarImportService.searchStudents(schoolId, debouncedQuery),
    { enabled: !!debouncedQuery && debouncedQuery.length >= 2 && !selectedStudent },
  );

  const { data: fees = [], isLoading: feesLoading } = useFetch(
    ['student-fees-correction', selectedStudent?.id, feesKey],
    () => bursarImportService.getStudentFees(selectedStudent!.id),
    { enabled: !!selectedStudent },
  );

  const handleSelectStudent = (s: StudentResult) => {
    setSelectedStudent(s);
    setQuery(`${s.first_name} ${s.last_name}`);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setQuery('');
  };

  const handleFeeSaved = () => {
    setEditingFee(null);
    setFeesKey((k) => k + 1);
  };

  const statusBadge = (status: string) => {
    if (status === 'paid')    return <Badge variant="success" size="sm">Paid</Badge>;
    if (status === 'partial') return <Badge variant="warning" size="sm">Partial</Badge>;
    if (status === 'overdue') return <Badge variant="danger"  size="sm">Overdue</Badge>;
    return <Badge variant="default" size="sm">Pending</Badge>;
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <Breadcrumb
        items={[{ label: 'Finance', href: '/bursar' }, { label: 'Fee Correction' }]}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Fee Correction</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Search a student to view and correct their fee payment records.
          All corrections create an audit entry visible to the Principal and Proprietor.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedStudent) setSelectedStudent(null);
              }}
              placeholder="Search by student name or registration number…"
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {query && (
              <button
                onClick={handleClearStudent}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {!selectedStudent && debouncedQuery.length >= 2 && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-50 max-h-60 overflow-y-auto">
              {searching && (
                <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-400">No students found</div>
              )}
              {!searching && searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectStudent(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 shrink-0">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.registration_number} · {s.classes?.name ?? s.current_grade_level}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected student chip */}
          {selectedStudent && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-200 shrink-0">
                <User className="h-4 w-4 text-blue-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </p>
                <p className="text-xs text-blue-600">
                  {selectedStudent.registration_number} ·{' '}
                  {selectedStudent.classes?.name ?? selectedStudent.current_grade_level}
                </p>
              </div>
              <button
                onClick={handleClearStudent}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee records */}
      {selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-500" />
              Fee Records — {selectedStudent.first_name} {selectedStudent.last_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {feesLoading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-6 w-6 rounded-full border-b-2 border-blue-600" />
              </div>
            )}
            {!feesLoading && fees.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                No fee records found for this student.
              </div>
            )}
            {!feesLoading && fees.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-left text-xs font-medium text-slate-500">
                      <th className="px-4 py-3">Fee Type</th>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3">Amount Due</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(fees as StudentFeeRow[]).map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {feeTypeLabel(fee.fee_structures?.fee_type ?? '')}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {fee.fee_structures?.academic_year ?? fee.academic_year}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCurrency(fee.amount_due)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatCurrency(fee.amount_paid)}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${fee.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatCurrency(fee.balance)}
                        </td>
                        <td className="px-4 py-3">{statusBadge(fee.status)}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingFee(fee)}
                          >
                            Correct
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Correction modal */}
      {editingFee && (
        <CorrectionModal
          fee={editingFee}
          onClose={() => setEditingFee(null)}
          onSaved={handleFeeSaved}
        />
      )}
    </div>
  );
}
