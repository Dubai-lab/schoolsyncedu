import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { bursarImportService } from '@/services/bursarService';
import { registrarService } from '@/services/registrarService';
import { notify } from '@/components/shared/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CheckCircle2, Clock, Users, DollarSign, AlertTriangle, UserCheck,
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

  // Track which student is being actioned to show per-row loading
  const [confirming, setConfirming] = useState<string | null>(null);
  const [enrolling,  setEnrolling]  = useState<string | null>(null);

  const { data: students = [], refetch, isLoading } = useFetch(
    ['pending-import-students', schoolId],
    () => bursarImportService.getPendingImportStudents(schoolId),
    { enabled: !!schoolId },
  );

  // Split: awaiting bursar confirmation vs. fee cleared, awaiting registrar
  const awaitingBursar    = students.filter((s) => !s.reg_fee_paid);
  const awaitingRegistrar = students.filter((s) =>  s.reg_fee_paid);

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

  const handleEnroll = async (studentId: string, name: string) => {
    setEnrolling(studentId);
    try {
      await registrarService.confirmImportEnrollment(studentId);
      notify.success(`${name} enrolled — login account created`);
      void refetch();
    } catch (err) {
      notify.error((err as Error).message ?? 'Could not enroll student');
    } finally {
      setEnrolling(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
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
          can enroll the student and create their login account.
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
          <p className="text-2xl font-bold text-amber-700">{awaitingBursar.length}</p>
          <p className="text-xs text-amber-600 mt-0.5 flex items-center justify-center gap-1">
            <DollarSign className="h-3 w-3" /> Awaiting fee confirmation
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-emerald-700">{awaitingRegistrar.length}</p>
          <p className="text-xs text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
            <UserCheck className="h-3 w-3" /> Fee cleared, awaiting enrollment
          </p>
        </div>
      </div>

      {students.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No pending imported students</p>
            <p className="text-sm text-slate-400 mt-1">
              All imported students have been cleared and enrolled, or no imports have been done yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section 1 — Awaiting Bursar fee confirmation */}
      {awaitingBursar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Awaiting Registration Fee Confirmation ({awaitingBursar.length})
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
                  {awaitingBursar.map((s) => (
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
                          disabled={!!confirming || !!enrolling}
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

      {/* Section 2 — Fee cleared, waiting for Registrar to enroll */}
      {awaitingRegistrar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <Clock className="h-4 w-4" />
              Fee Confirmed — Awaiting Enrollment ({awaitingRegistrar.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Registration fee confirmed. Click <strong>Enroll</strong> to create the student's
              login account and activate their enrollment.
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
                  {awaitingRegistrar.map((s) => (
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
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleEnroll(
                            s.student_id,
                            `${s.first_name} ${s.last_name}`,
                          )}
                          loading={enrolling === s.student_id}
                          disabled={!!confirming || !!enrolling}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Enroll
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
    </div>
  );
}
