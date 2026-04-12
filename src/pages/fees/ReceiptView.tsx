import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Printer,
  ArrowLeft,
  Receipt,
  CheckCircle,
  School,
} from 'lucide-react';

async function fetchPaymentReceipt(paymentId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      students!inner(id, first_name, last_name, registration_number, current_class_id),
      student_fees!inner(
        amount_due, amount_paid, balance, status,
        fee_structures!inner(fee_type, grade_level, description, academic_year)
      )
    `)
    .eq('id', paymentId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchSchoolInfo(schoolId: string) {
  const { data } = await supabase
    .from('schools')
    .select('name, logo_url, address, phone, email')
    .eq('id', schoolId)
    .single();
  return data;
}

function formatCurrency(amount: number, currency: string = 'USD') {
  if (currency === 'LRD') {
    return `L$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReceiptView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const { data: payment, isLoading } = useFetch(
    ['payment-receipt', id ?? ''],
    () => fetchPaymentReceipt(id!),
    { enabled: !!id },
  );

  const { data: school } = useFetch(
    ['school-info', schoolId],
    () => fetchSchoolInfo(schoolId),
    { enabled: !!schoolId },
  );

  const student = payment?.students as Record<string, string> | null;
  const fee = payment?.student_fees as Record<string, unknown> | null;
  const structure = fee?.fee_structures as Record<string, string> | null;

  // Parse gateway_ref for payer info and receipt URL
  const refParts = (payment?.gateway_ref as string || '').split(' | ');
  const txnRef = refParts.find((p: string) => !p.startsWith('Payer:') && !p.startsWith('Notes:') && !p.startsWith('Receipt:')) || '';
  const payer = refParts.find((p: string) => p.startsWith('Payer:'))?.replace('Payer: ', '') || '';
  const notes = refParts.find((p: string) => p.startsWith('Notes:'))?.replace('Notes: ', '') || '';
  const receiptUrl = refParts.find((p: string) => p.startsWith('Receipt:'))?.replace('Receipt: ', '') || '';

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Breadcrumb items={[{ label: 'Fees', href: '/fees' }, { label: 'Payment History', href: '/fees/history' }, { label: 'Receipt' }]} />
      </div>

      <div className="print:hidden flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Print Receipt
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : !payment ? (
        <Card className="p-12 text-center">
          <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">Receipt not found</h3>
        </Card>
      ) : (
        <Card className="max-w-2xl mx-auto p-8 print:shadow-none print:border-none print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-5">
            <div className="flex items-center gap-3">
              {school?.logo_url ? (
                <img src={school.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <School className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-slate-900">{school?.name || 'School'}</h1>
                {school?.address && <p className="text-xs text-slate-400">{school.address}</p>}
                {school?.phone && <p className="text-xs text-slate-400">Tel: {school.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-blue-600 flex items-center gap-1 justify-end">
                <Receipt className="h-5 w-5" /> PAYMENT RECEIPT
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                #{(payment.id as string).slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Payment Info Grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm mb-6">
            <div>
              <p className="text-xs text-slate-400">Date</p>
              <p className="font-medium text-slate-800">
                {payment.payment_date ? new Date(payment.payment_date as string).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <Badge variant={(payment.status as string) === 'success' ? 'success' : 'warning'} size="sm">
                <CheckCircle className="h-3 w-3 mr-0.5" /> {(payment.status as string) || 'Recorded'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400">Student</p>
              <p className="font-medium text-slate-800">
                {student ? `${student.first_name} ${student.last_name}` : '—'}
              </p>
              <p className="text-xs text-slate-400 font-mono">{student?.registration_number || ''}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Fee Type</p>
              <p className="font-medium text-slate-800 capitalize">{structure?.fee_type || '—'}</p>
              <p className="text-xs text-slate-400">{structure?.grade_level} · {structure?.academic_year}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Payment Method</p>
              <p className="font-medium text-slate-800 capitalize">{(payment.payment_method as string)?.replace(/_/g, ' ') || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Currency</p>
              <p className="font-medium text-slate-800">{(payment.currency_charged as string) || 'USD'}</p>
            </div>
            {txnRef && (
              <div>
                <p className="text-xs text-slate-400">Reference / Transaction ID</p>
                <p className="font-medium text-slate-800 font-mono text-xs">{txnRef}</p>
              </div>
            )}
            {payer && (
              <div>
                <p className="text-xs text-slate-400">Paid By</p>
                <p className="font-medium text-slate-800">{payer}</p>
              </div>
            )}
          </div>

          {/* Amount Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-medium capitalize">{structure?.fee_type} Fee — {structure?.grade_level}</p>
                    {structure?.description && <p className="text-xs text-slate-400">{structure.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(Number(fee?.amount_due ?? 0))}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-2 text-slate-500">Previously Paid</td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {formatCurrency(Number(fee?.amount_paid ?? 0) - Number(payment.amount_usd ?? 0) - Number(payment.amount_lrd ?? 0))}
                  </td>
                </tr>
                <tr className="bg-emerald-50 border-b border-emerald-100">
                  <td className="px-4 py-3 font-semibold text-emerald-800">This Payment</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-emerald-700">
                    {formatCurrency(
                      Number(payment.amount_usd ?? 0) || Number(payment.amount_lrd ?? 0),
                      (payment.currency_charged as string) || 'USD',
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-600">Remaining Balance</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                    {formatCurrency(Number(fee?.balance ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {notes && (
            <div className="mb-5 text-sm">
              <p className="text-xs text-slate-400 mb-1">Notes</p>
              <p className="text-slate-600 bg-slate-50 rounded-lg p-3">{notes}</p>
            </div>
          )}

          {/* Receipt Image */}
          {receiptUrl && (
            <div className="mb-5 print:hidden">
              <p className="text-xs text-slate-400 mb-2">Attached Receipt / Deposit Slip</p>
              {receiptUrl.match(/\.(pdf)$/i) ? (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                  View PDF Document
                </a>
              ) : (
                <img src={receiptUrl} alt="Receipt" className="max-h-48 rounded-lg border border-slate-200" />
              )}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-4 text-center">
            <p className="text-xs text-slate-400">
              This is an official receipt from {school?.name || 'the school'}.
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
