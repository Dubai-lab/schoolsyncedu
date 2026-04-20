import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { registrarService } from '@/services/registrarService';
import { useDebounce } from '@/hooks/useDebounce';
import type { StudentApplication } from '@/types/application.types';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import {
  Search,
  DollarSign,
  CheckCircle2,
  User,
  FileText,
  Printer,
  AlertCircle,
  Clock,
} from 'lucide-react';

// ==================== RECEIPT COMPONENT ====================

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #receipt-printable, #receipt-printable * { visibility: visible !important; }
  #receipt-printable {
    position: fixed !important;
    top: 0; left: 0;
    width: 80mm;
    padding: 8mm;
    font-size: 11px;
    background: white;
  }
}
`;

function ReceiptModal({
  application,
  onClose,
}: {
  application: StudentApplication;
  onClose: () => void;
}) {
  const handlePrint = () => window.print();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <Dialog open onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div id="receipt-printable" className="p-3 space-y-3 text-sm">
            {/* Header */}
            <div className="text-center border-b border-slate-200 pb-3">
              <div className="flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-emerald-100 mb-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Payment Receipt</h2>
              <p className="text-xs text-slate-500">Application Fee — Cash</p>
              <p className="text-xs text-slate-400">{date}</p>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              {[
                { label: 'Application #', value: application.application_number, mono: true },
                { label: 'Student',       value: `${application.first_name} ${application.last_name}` },
                { label: 'Grade',         value: application.grade_level_applied },
                { label: 'Guardian',      value: application.guardian_full_name },
                { label: 'Method',        value: 'Cash' },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{label}</span>
                  <span className={`text-slate-800 font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 border-t border-slate-300 mt-1">
                <span className="font-semibold text-slate-700">Amount Paid</span>
                <span className="font-bold text-emerald-700">
                  ${Number(application.application_fee_amount ?? 0).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status</span>
                <Badge variant="success" size="sm">PAID</Badge>
              </div>
            </div>

            <p className="text-center text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">
              Present to the Registrar's Office to proceed with application review.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
            Print
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ApplicationFeePayments() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [_selectedApp, _setSelectedApp] = useState<StudentApplication | null>(null);
  const [confirmApp, setConfirmApp] = useState<StudentApplication | null>(null);
  const [receiptApp, setReceiptApp] = useState<StudentApplication | null>(null);
  const [showPaidList, setShowPaidList] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  // Unpaid applications
  const { data: unpaid = [], isLoading, refetch } = useFetch(
    ['unpaid-applications', schoolId, debouncedSearch],
    () => registrarService.listUnpaidApplications(schoolId, debouncedSearch || undefined),
    { enabled: !!schoolId },
  );

  // Recently paid applications (all with fee_paid = true, recent)
  const { data: allApps = [] } = useFetch(
    ['all-applications-fee', schoolId],
    () => registrarService.listApplications(schoolId, undefined, 1, 50),
    { enabled: !!schoolId && showPaidList },
  );
  const paidApps = (allApps as { data: StudentApplication[] }).data?.filter((a) => a.application_fee_paid) ?? [];

  const markPaidMutation = useMutate(
    (app: StudentApplication) => registrarService.markApplicationFeePaid(app.id, notes || undefined),
    [['unpaid-applications']],
    {
      onSuccess: (data) => {
        notify.success(`Application fee marked as paid for ${(data as StudentApplication).first_name} ${(data as StudentApplication).last_name}`);
        setReceiptApp(data as StudentApplication);
        setConfirmApp(null);
        setNotes('');
        refetch();
      },
      onError: () => notify.error('Failed to mark fee as paid'),
    },
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Finance', href: '/bursar' }, { label: 'Application Fees' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <DollarSign className="inline-block h-6 w-6 mr-2 text-blue-600" />
          Application Fee Payments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Record cash payments for students who paid their application fee in person.
          After payment is confirmed here, the Registrar can review the application.
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-900 text-sm">Workflow: How Application Fees Work</p>
          <ol className="mt-2 text-xs text-amber-700 space-y-1 list-decimal list-inside">
            <li>Student submits application online (no payment required at submission)</li>
            <li>Student visits campus and pays application fee in cash to Finance Office</li>
            <li>Finance records the cash payment on this page and prints receipt</li>
            <li>Registrar can now see and review the application</li>
            <li>After acceptance, student pays registration fee — then enrollment activates</li>
          </ol>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, application #, or guardian name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={() => setShowPaidList((v) => !v)}
            className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${showPaidList ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
            {showPaidList ? 'Hide Paid' : 'Show Paid'}
          </button>
        </div>
      </Card>

      {/* Unpaid Applications */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Awaiting Payment ({(unpaid as StudentApplication[]).length})</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (unpaid as StudentApplication[]).length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-600">No pending fee payments</h3>
            <p className="text-sm text-slate-400 mt-1">
              {search ? 'No results found. Try a different search.' : 'All submitted applications have their fee paid.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {(unpaid as StudentApplication[]).map((app) => (
              <Card key={app.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                      {app.first_name[0]}{app.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800">{app.first_name} {app.last_name}</p>
                        <Badge variant="warning" size="sm">Fee Unpaid</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{app.application_number}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                        <span><User className="inline h-3 w-3 mr-1" />{app.guardian_full_name}</span>
                        <span><FileText className="inline h-3 w-3 mr-1" />{app.grade_level_applied}</span>
                        <span><Clock className="inline h-3 w-3 mr-1" />{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Fee Due</p>
                      <p className="font-bold text-slate-800">
                        ${Number(app.application_fee_amount ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setConfirmApp(app)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Mark Paid
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recently Paid Applications */}
      {showPaidList && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Fee Paid ({paidApps.length})</h2>
          </div>
          {paidApps.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-400">No paid applications yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {paidApps.slice(0, 20).map((app) => (
                <Card key={app.id} className="p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-xs">
                        {app.first_name[0]}{app.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{app.first_name} {app.last_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{app.application_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="success" size="sm">Fee Paid</Badge>
                      <button
                        onClick={() => setReceiptApp(app)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Printer className="h-3.5 w-3.5" /> Reprint
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Payment Dialog */}
      {confirmApp && (
        <Dialog open onClose={() => setConfirmApp(null)}>
          <DialogHeader>
            <DialogTitle>Confirm Cash Payment</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Student</span>
                  <span className="font-semibold">{confirmApp.first_name} {confirmApp.last_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Application #</span>
                  <span className="font-mono">{confirmApp.application_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Grade Applied</span>
                  <span>{confirmApp.grade_level_applied}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700">Amount to Collect</span>
                  <span className="font-bold text-emerald-700">
                    ${Number(confirmApp.application_fee_amount ?? 0).toFixed(2)} USD
                  </span>
                </div>
              </div>

              <Input
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid in cash by guardian, Mr. James Doe"
              />

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                <strong>Confirm:</strong> The student or guardian has physically paid the application fee in cash.
                A receipt will be generated for printing.
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmApp(null)}>Cancel</Button>
            <Button
              onClick={() => markPaidMutation.mutate(confirmApp)}
              loading={markPaidMutation.isPending}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Confirm & Generate Receipt
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Receipt Modal */}
      {receiptApp && (
        <ReceiptModal application={receiptApp} onClose={() => setReceiptApp(null)} />
      )}
    </div>
  );
}
