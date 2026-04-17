import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { bursarImportService } from '@/services/bursarService';
import { notify } from '@/components/shared/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CheckCircle2, Users, DollarSign, AlertTriangle, Clock,
} from 'lucide-react';

function formatCurrency(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function RegFeeConfirmation() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [confirming, setConfirming] = useState<string | null>(null);

  const { data: students = [], refetch, isLoading, isError, error } = useFetch(
    ['pending-import-students', schoolId],
    () => bursarImportService.getPendingImportStudents(schoolId),
    { enabled: !!schoolId },
  );

  // Bursar only sees students whose reg fee has NOT yet been confirmed
  const awaitingConfirmation = students.filter((s) => !s.reg_fee_paid);
  // Students already confirmed are shown as info (read-only) — Registrar handles enrollment
  const feeConfirmed = students.filter((s) => s.reg_fee_paid);

  const handleConfirmFee = async (studentId: string, name: string) => {
    setConfirming(studentId);
    try {
      await bursarImportService.confirmRegFee(studentId);
      notify.success(`Registration fee confirmed for ${name}`);
      void refetch();
    } catch (err) {
      notify.error((err as Error).message ?? 'Could not confirm fee');
    } finally {
      setConfirming(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-5xl space-y-5">
        <Breadcrumb
          items={[{ label: 'Finance', href: '/bursar' }, { label: 'Reg Fee Confirmation' }]}
        />
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="font-semibold text-red-800">Failed to load pending students</p>
          <p className="text-sm text-red-600 mt-1 font-mono">{(error as Error)?.message ?? 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <Breadcrumb
        items={[{ label: 'Finance', href: '/bursar' }, { label: 'Reg Fee Confirmation' }]}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Registration Fee Confirmation</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Confirm registration fee payments for imported students. Once confirmed, the Registrar
          will be able to complete their enrollment.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{students.length}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> Total pending
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{awaitingConfirmation.length}</p>
          <p className="text-xs text-amber-600 mt-0.5 flex items-center justify-center gap-1">
            <DollarSign className="h-3 w-3" /> Awaiting fee confirmation
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-emerald-700">{feeConfirmed.length}</p>
          <p className="text-xs text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Fee confirmed, awaiting Registrar
          </p>
        </div>
      </div>

      {students.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No pending imported students</p>
            <p className="text-sm text-slate-400 mt-1">
              All imported students have been cleared, or no imports have been done yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section 1 — Awaiting Bursar fee confirmation */}
      {awaitingConfirmation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Awaiting Registration Fee Confirmation ({awaitingConfirmation.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify each student's payment in your records, then click <strong>Confirm Paid</strong>.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Reg No.</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Reg Fee</th>
                    <th className="px-4 py-3">Imported</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {awaitingConfirmation.map((s) => (
                    <tr key={s.student_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {s.registration_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.class_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {s.reg_fee_amount > 0 ? formatCurrency(s.reg_fee_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(s.imported_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => void handleConfirmFee(
                            s.student_id,
                            `${s.first_name} ${s.last_name}`,
                          )}
                          loading={confirming === s.student_id}
                          disabled={!!confirming}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Confirm Paid
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2 — Fee confirmed, read-only info for bursar */}
      {feeConfirmed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Fee Confirmed — Pending Registrar Enrollment ({feeConfirmed.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Registration fee confirmed. The Registrar will complete enrollment and create
              login accounts for these students.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Reg No.</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Reg Fee</th>
                    <th className="px-4 py-3">Imported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {feeConfirmed.map((s) => (
                    <tr key={s.student_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {s.registration_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.class_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Paid
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(s.imported_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
