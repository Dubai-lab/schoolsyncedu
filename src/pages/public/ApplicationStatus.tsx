import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApplicationService } from '@/services/registrarService';
import {
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  AlertCircle,
  Loader2,
  GraduationCap,
  Calendar,
  User,
  BookOpen,
} from 'lucide-react';

type StatusResult = Awaited<ReturnType<typeof publicApplicationService.checkStatus>>;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, description: 'Your application has been received and is awaiting review.' },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: FileText, description: 'Your application is currently being reviewed by the admissions team.' },
  documents_requested: { label: 'Documents Requested', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertCircle, description: 'Additional documents are needed. Please contact the school.' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, description: 'Congratulations! Your application has been accepted.' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, description: 'Unfortunately, your application was not accepted at this time.' },
  waitlisted: { label: 'Waitlisted', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock, description: 'You have been placed on the waiting list. We will contact you if a spot becomes available.' },
  enrolled: { label: 'Enrolled', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: GraduationCap, description: 'You have been enrolled! Please contact the school for next steps.' },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle, description: 'This application has been withdrawn.' },
};

const TIMELINE_ORDER = ['submitted', 'under_review', 'accepted', 'enrolled'];

export default function ApplicationStatus() {
  const { slug } = useParams<{ slug: string }>();
  const [applicationNumber, setApplicationNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StatusResult | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationNumber.trim() || !dateOfBirth) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await publicApplicationService.checkStatus(applicationNumber.trim(), dateOfBirth);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to check application status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = result?.status ? STATUS_CONFIG[result.status] : null;
  const StatusIcon = statusInfo?.icon ?? Clock;

  const currentStepIndex = result?.status ? TIMELINE_ORDER.indexOf(result.status) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            to={slug ? `/school/${slug}` : '/'}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to School Site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <Search className="h-7 w-7 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Check Application Status</h1>
          <p className="mt-2 text-slate-500">
            Enter your application number and date of birth to view your application status.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleCheck} className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="appNumber" className="mb-1 block text-sm font-medium text-slate-700">
                Application Number
              </label>
              <input
                id="appNumber"
                type="text"
                placeholder="e.g. APP-BHA-2026-0001"
                value={applicationNumber}
                onChange={(e) => setApplicationNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                required
              />
            </div>
            <div>
              <label htmlFor="dob" className="mb-1 block text-sm font-medium text-slate-700">
                Date of Birth
              </label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                required
              />
              <p className="mt-1 text-xs text-slate-400">Must match the date of birth on the application.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !applicationNumber.trim() || !dateOfBirth}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Check Status
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* Not Found */}
        {result && !result.found && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <p className="font-medium text-amber-800">{result.message}</p>
            <p className="mt-1 text-sm text-amber-600">
              Double-check your application number and date of birth and try again.
            </p>
          </div>
        )}

        {/* Result */}
        {result?.found && statusInfo && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`rounded-xl border-2 p-6 ${statusInfo.color}`}>
              <div className="flex items-center gap-3">
                <StatusIcon className="h-8 w-8" />
                <div>
                  <h2 className="text-lg font-bold">{statusInfo.label}</h2>
                  <p className="text-sm opacity-80">{statusInfo.description}</p>
                </div>
              </div>
            </div>

            {/* Application Details */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-800">Application Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Application #</p>
                    <p className="font-mono text-sm font-medium text-slate-700">{result.application_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Student Name</p>
                    <p className="text-sm font-medium text-slate-700">{result.student_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Grade Applied</p>
                    <p className="text-sm font-medium text-slate-700">{result.grade_level}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Academic Year</p>
                    <p className="text-sm font-medium text-slate-700">{result.academic_year}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Submitted</p>
                    <p className="text-sm font-medium text-slate-700">
                      {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
                {result.reviewed_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400">Reviewed</p>
                      <p className="text-sm font-medium text-slate-700">
                        {new Date(result.reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Application Fee */}
              {(result.application_fee_amount ?? 0) > 0 && (
                <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Application Fee</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">${result.application_fee_amount?.toFixed(2)}</span>
                      {result.application_fee_paid ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Paid</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Unpaid</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Number */}
              {result.registration_number && (
                <div className="mt-4 rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <p className="text-xs text-green-600">Assigned Registration Number</p>
                  <p className="text-lg font-bold font-mono text-green-800">{result.registration_number}</p>
                </div>
              )}

              {/* Review Notes */}
              {result.review_notes && (
                <div className="mt-4 rounded-lg border bg-blue-50 p-4">
                  <p className="mb-1 text-xs font-medium text-blue-600">Message from Registrar</p>
                  <p className="text-sm text-blue-800">{result.review_notes}</p>
                </div>
              )}
            </div>

            {/* Progress Timeline */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-800">Application Progress</h3>
              <div className="flex items-center justify-between">
                {TIMELINE_ORDER.map((step, i) => {
                  const stepConf = STATUS_CONFIG[step];
                  const isCompleted = currentStepIndex >= i;
                  const isCurrent = currentStepIndex === i;
                  return (
                    <div key={step} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                            isCompleted
                              ? 'border-green-500 bg-green-500 text-white'
                              : isCurrent
                              ? 'border-primary-500 bg-primary-100 text-primary-700'
                              : 'border-slate-200 bg-white text-slate-300'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-bold">{i + 1}</span>
                          )}
                        </div>
                        <span
                          className={`mt-1.5 text-center text-[10px] leading-tight sm:text-xs ${
                            isCompleted ? 'font-medium text-green-700' : 'text-slate-400'
                          }`}
                        >
                          {stepConf.label}
                        </span>
                      </div>
                      {i < TIMELINE_ORDER.length - 1 && (
                        <div
                          className={`mx-1 h-0.5 flex-1 ${
                            currentStepIndex > i ? 'bg-green-400' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Show special statuses outside normal flow */}
              {result.status && !TIMELINE_ORDER.includes(result.status) && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Current status: <strong className="capitalize">{result.status.replace(/_/g, ' ')}</strong>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setResult(null); setApplicationNumber(''); setDateOfBirth(''); }}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Check Another
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Print Status
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
