import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { bankTransferService, type BankTransferProof } from '@/services/bankTransferService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  Image,
  FileText,
  RefreshCw,
  ZoomIn,
  AlertTriangle,
  User,
  GraduationCap,
  DollarSign,
} from 'lucide-react';

function fmtUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type StatusFilter = 'pending' | 'verified' | 'rejected' | 'all';

function statusBadge(s: string) {
  if (s === 'verified') return <Badge variant="success">Verified</Badge>;
  if (s === 'rejected') return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

// ── Proof image viewer ─────────────────────────────────────────────────────────

function ProofViewer({ proof }: { proof: BankTransferProof }) {
  const [zoomed, setZoomed] = useState(false);

  if (!proof.proof_url) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <FileText className="h-4 w-4" />
        No file uploaded
      </div>
    );
  }

  const isPdf = proof.proof_filename?.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return (
      <a
        href={proof.proof_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        View PDF Receipt
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative overflow-hidden rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
      >
        <img
          src={proof.proof_url}
          alt="Proof"
          className="h-20 w-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
          <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomed(false)}
        >
          <img
            src={proof.proof_url}
            alt="Proof (full size)"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}

// ── Verify / Reject dialog ─────────────────────────────────────────────────────

interface ActionDialogProps {
  proof: BankTransferProof;
  action: 'verify' | 'reject';
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}

function ActionDialog({ proof, action, userId, onDone, onCancel }: ActionDialogProps) {
  const [notes,     setNotes]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const feeType = proof.student_fee?.fee_structures?.fee_type?.replace(/_/g, ' ') ?? 'Fee';
  const studentName = proof.student
    ? `${proof.student.first_name} ${proof.student.last_name}`
    : '—';

  async function handleConfirm() {
    if (action === 'reject' && !notes.trim()) {
      setError('Please provide a reason for rejection so the student knows what to fix.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (action === 'verify') {
        await bankTransferService.verifyProof({
          proofId:      proof.id,
          schoolId:     proof.school_id,
          studentId:    proof.student_id,
          studentFeeId: proof.student_fee_id,
          amountUsd:    proof.amount_usd,
          bursarNotes:  notes,
          verifiedBy:   userId,
        });
      } else {
        await bankTransferService.rejectProof({
          proofId:     proof.id,
          verifiedBy:  userId,
          bursarNotes: notes,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className={`px-6 py-4 ${action === 'verify' ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
          <h2 className={`font-bold text-lg ${action === 'verify' ? 'text-green-800' : 'text-red-800'}`}>
            {action === 'verify' ? 'Verify Payment' : 'Reject Proof'}
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            {studentName} — {feeType} — {fmtUSD(proof.amount_usd)}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {action === 'verify' && (
            <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              This will mark the student fee as paid by <strong>{fmtUSD(proof.amount_usd)}</strong> and update their balance automatically.
            </div>
          )}

          {action === 'reject' && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              The student will be notified to re-submit. Provide a clear reason below.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {action === 'verify' ? 'Notes (optional)' : 'Reason for rejection *'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                action === 'verify'
                  ? 'e.g. Confirmed with bank statement'
                  : 'e.g. Amount transferred does not match, please re-transfer the correct amount'
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors
                ${action === 'verify'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading
                ? (action === 'verify' ? 'Verifying…' : 'Rejecting…')
                : (action === 'verify' ? 'Confirm Verified' : 'Confirm Reject')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BankTransferVerification() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId   = user?.id ?? '';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actionProof,  setActionProof]  = useState<{ proof: BankTransferProof; action: 'verify' | 'reject' } | null>(null);

  const { data: proofs = [], isLoading, refetch } = useFetch<BankTransferProof[]>(
    ['bank-transfer-proofs', schoolId],
    () => bankTransferService.listPendingForSchool(schoolId),
    { enabled: !!schoolId },
  );

  const filtered = statusFilter === 'all'
    ? proofs
    : proofs.filter((p) => p.status === statusFilter);

  const pendingCount  = proofs.filter((p) => p.status === 'pending').length;
  const verifiedCount = proofs.filter((p) => p.status === 'verified').length;
  const rejectedCount = proofs.filter((p) => p.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Bursar', href: '/bursar' }, { label: 'Bank Transfer Verification' }]} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="h-6 w-6 text-blue-600" />
            Bank Transfer Verification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review proof of payment uploads from students and verify or reject each one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', count: pendingCount,  icon: Clock,         color: 'amber'  },
          { label: 'Verified',       count: verifiedCount, icon: CheckCircle2,  color: 'green'  },
          { label: 'Rejected',       count: rejectedCount, icon: XCircle,       color: 'red'    },
        ].map(({ label, count, icon: Icon, color }) => (
          <Card key={label} className="p-4 text-center">
            <Icon className={`h-7 w-7 mx-auto mb-1 text-${color}-500`} />
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </Card>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'pending',  label: `Pending (${pendingCount})`    },
          { key: 'verified', label: `Verified (${verifiedCount})`  },
          { key: 'rejected', label: `Rejected (${rejectedCount})`  },
          { key: 'all',      label: `All (${proofs.length})`        },
        ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Landmark className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {statusFilter === 'pending' ? 'No pending submissions' : `No ${statusFilter} submissions`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter === 'pending' && 'Students who pay via bank transfer will appear here for review.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((proof) => (
            <Card key={proof.id} className={`p-5 ${proof.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                {/* Student info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(proof.status)}
                    <span className="text-xs text-gray-400">
                      {new Date(proof.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="h-3 w-3" /> Student
                      </p>
                      <p className="font-semibold text-gray-800">
                        {proof.student
                          ? `${proof.student.first_name} ${proof.student.last_name}`
                          : '—'}
                      </p>
                      <p className="text-xs text-gray-500">{proof.student?.registration_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" /> Grade
                      </p>
                      <p className="font-medium text-gray-700">{proof.student?.current_grade_level ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Amount
                      </p>
                      <p className="font-bold text-gray-900">{fmtUSD(proof.amount_usd)}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {proof.student_fee?.fee_structures?.fee_type?.replace(/_/g, ' ') ?? 'Fee'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Reference Number</p>
                    <p className="font-mono text-sm font-bold text-blue-700">{proof.reference_number}</p>
                  </div>

                  {proof.student_notes && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                      <span className="text-xs font-semibold text-gray-400 block">Student note:</span>
                      {proof.student_notes}
                    </div>
                  )}

                  {proof.bursar_notes && (
                    <div className={`rounded-lg border px-3 py-2 text-sm ${
                      proof.status === 'verified'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <span className="text-xs font-semibold block">
                        {proof.status === 'verified' ? 'Verified:' : 'Rejection reason:'}
                      </span>
                      {proof.bursar_notes}
                    </div>
                  )}
                </div>

                {/* Proof image + actions */}
                <div className="flex flex-col items-start gap-3 shrink-0">
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                      <Image className="h-3.5 w-3.5" /> Proof
                    </p>
                    <ProofViewer proof={proof} />
                  </div>

                  {proof.status === 'pending' && (
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setActionProof({ proof, action: 'verify' })}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Verify & Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionProof({ proof, action: 'reject' })}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Action dialog ── */}
      {actionProof && (
        <ActionDialog
          proof={actionProof.proof}
          action={actionProof.action}
          userId={userId}
          onDone={() => { setActionProof(null); refetch(); }}
          onCancel={() => setActionProof(null)}
        />
      )}
    </div>
  );
}
