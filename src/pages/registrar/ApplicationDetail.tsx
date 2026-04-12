import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { registrarService } from '@/services/registrarService';
import { classService } from '@/services/classService';
import { sendApplicationEmail } from '@/services/letterEmailService';
import type { StudentApplication } from '@/types/application.types';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Mail,
  Loader2,
  DollarSign,
  UserCheck,
  Key,
  ShieldCheck,
} from 'lucide-react';

// ==================== STATUS CONFIG ====================

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  submitted: 'info',
  under_review: 'warning',
  documents_requested: 'warning',
  accepted: 'success',
  rejected: 'danger',
  waitlisted: 'default',
  enrolled: 'success',
  withdrawn: 'default',
};

const statusIcon: Record<string, React.ElementType> = {
  submitted: Clock,
  under_review: Clock,
  documents_requested: AlertTriangle,
  accepted: CheckCircle2,
  rejected: XCircle,
  waitlisted: Clock,
  enrolled: GraduationCap,
  withdrawn: XCircle,
};

// ==================== MAIN COMPONENT ====================

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; title: string; message?: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [enrolling, setEnrolling] = useState(false);

  const { data: app, isLoading, refetch } = useFetch<StudentApplication>(
    ['application-detail', id ?? ''],
    () => registrarService.getApplication(id!),
    { enabled: !!id },
  );

  const schoolId = user?.school_id ?? '';

  // Fetch classes for the school so registrar can assign student to a class on acceptance
  const { data: classes } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );

  const classOptions = (classes?.data ?? []).map((c) => ({
    label: `${c.name} — ${c.grade_level || ''}`,
    value: c.id,
  }));

  // Enrollment status — only meaningful once accepted
  const { data: enrollmentStatus, refetch: refetchEnrollment } = useFetch(
    ['enrollment-status', id ?? ''],
    () => registrarService.getEnrollmentStatus(id!),
    { enabled: !!id && app?.status === 'accepted' },
  );

  // Pre-select the class the student chose on the application form
  useEffect(() => {
    if (app?.class_id && !selectedClassId) {
      setSelectedClassId(app.class_id);
    }
  }, [app?.class_id]);

  const handleEnroll = async () => {
    if (!enrollmentStatus?.student_id) return;
    setEnrolling(true);
    try {
      const result = await registrarService.enrollStudent(enrollmentStatus.student_id);
      if (result.success) {
        setToast({
          type: 'success',
          title: result.already_exists ? 'Already Enrolled' : 'Student Enrolled!',
          message: result.message,
        });
        refetch();
        refetchEnrollment();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enroll student';
      setToast({ type: 'error', title: 'Enrollment Failed', message: msg });
    } finally {
      setEnrolling(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'under_review' | 'documents_requested' | 'waitlisted') => {
    if (!app) return;
    if (action === 'accept' && !selectedClassId) {
      setToast({ type: 'warning', title: 'Class Required', message: 'Please select a class to assign the student to before accepting.' });
      return;
    }
    setActionLoading(action);
    try {
      if (action === 'accept') {
        const result = await registrarService.acceptApplication(app.id, reviewNotes || undefined, selectedClassId || undefined);
        if (result.success) {
          const feeMsg = result.reg_fee_assigned
            ? ' All class fees assigned. Once the registration fee is paid, come back here to complete enrollment.'
            : ' No fee structures found for this class yet — ask the bursar to set them up.';
          setToast({ type: 'success', title: 'Student Accepted!', message: `Reg#: ${result.registration_number}.${feeMsg}` });
          refetchEnrollment();

          // Send acceptance email to guardian — non-blocking
          if (app.guardian_email) {
            const assignedClass = (classes?.data ?? []).find((c) => c.id === selectedClassId);
            setEmailStatus('sending');
            sendApplicationEmail(
              'acceptance_letter',
              app,
              {
                class_name: assignedClass?.name ?? '',
                registration_number: result.registration_number,
              },
              user?.id,
              result.student_id,
            ).then((res) => {
              setEmailStatus(res.sent ? 'sent' : 'failed');
            }).catch(() => setEmailStatus('failed'));
          }
        }
      } else if (action === 'reject') {
        await registrarService.rejectApplication(app.id, reviewNotes || undefined);
        setToast({ type: 'success', title: 'Application Rejected', message: app.guardian_email ? 'A rejection letter will be emailed to the guardian.' : 'Application marked as rejected.' });

        // Send rejection email to guardian — non-blocking
        if (app.guardian_email) {
          setEmailStatus('sending');
          sendApplicationEmail(
            'rejection_letter',
            app,
            { rejection_reason: reviewNotes || undefined },
            user?.id,
          ).then((res) => {
            setEmailStatus(res.sent ? 'sent' : 'failed');
          }).catch(() => setEmailStatus('failed'));
        }
      } else {
        await registrarService.updateApplicationStatus(app.id, action, reviewNotes || undefined);
      }
      setReviewNotes('');
      refetch();
    } catch (err) {
      console.error('Action failed:', err);
      setToast({ type: 'error', title: 'Action Failed', message: 'Something went wrong. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="text-center py-20">
        <FileText className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Application not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/registrar/applications')}>
          Back to Applications
        </Button>
      </div>
    );
  }

  const StatusIcon = statusIcon[app.status] ?? Clock;
  const canReview = ['submitted', 'under_review', 'documents_requested', 'waitlisted'].includes(app.status);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`relative rounded-xl border px-5 py-4 shadow-sm ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-900'
              : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : toast.type === 'error' ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message && <p className="mt-0.5 text-sm opacity-80">{toast.message}</p>}
            </div>
            <button
              onClick={() => setToast(null)}
              className="shrink-0 rounded-lg p-1 opacity-50 transition-opacity hover:opacity-100"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Breadcrumb
        items={[
          { label: 'Registrar', href: '/registrar' },
          { label: 'Applications', href: '/registrar/applications' },
          { label: app.application_number },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/registrar/applications')}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {app.first_name} {app.last_name}
              </h1>
              <Badge variant={statusVariant[app.status] ?? 'default'}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {app.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 font-mono">{app.application_number}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Student Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Full Name" value={`${app.first_name} ${app.middle_name ?? ''} ${app.last_name}`.trim()} />
              <InfoRow label="Date of Birth" value={app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : '—'} />
              <InfoRow label="Gender" value={app.gender ?? '—'} capitalize />
              <InfoRow label="Nationality" value={app.nationality ?? '—'} />
              <InfoRow label="Grade Applied" value={app.grade_level_applied} />
              <InfoRow label="Academic Year" value={app.academic_year} />
              <InfoRow label="Previous School" value={app.previous_school ?? '—'} />
              {app.address && <InfoRow label="Address" value={app.address} icon={MapPin} />}
            </div>
          </Card>

          {/* Guardian Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-900">Guardian Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Full Name" value={app.guardian_full_name} />
              <InfoRow label="Relationship" value={app.guardian_relationship ?? '—'} capitalize />
              <InfoRow label="Phone" value={app.guardian_phone} icon={Phone} />
              <InfoRow label="Email" value={app.guardian_email ?? '—'} icon={Mail} />
              <InfoRow label="Occupation" value={app.guardian_occupation ?? '—'} />
              {app.guardian_address && <InfoRow label="Address" value={app.guardian_address} icon={MapPin} />}
            </div>
          </Card>

          {/* Documents */}
          {app.documents && (app.documents as unknown as Record<string, string>[]).length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
              </div>
              <div className="space-y-2">
                {(app.documents as unknown as Record<string, string>[]).map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
                  >
                    <FileText className="h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{doc.name || `Document ${i + 1}`}</p>
                      {doc.type && <p className="text-xs text-slate-400">{doc.type}</p>}
                    </div>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Additional Notes from applicant */}
          {app.additional_notes && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Additional Notes</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{app.additional_notes}</p>
            </Card>
          )}
        </div>

        {/* Right column — Actions */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <TimelineItem
                label="Submitted"
                date={app.submitted_at}
                icon={Calendar}
                active
              />
              {app.reviewed_at && (
                <TimelineItem
                  label="Reviewed"
                  date={app.reviewed_at}
                  icon={CheckCircle2}
                  active
                />
              )}
              {app.status === 'accepted' && (
                <TimelineItem
                  label="Accepted"
                  date={app.reviewed_at ?? app.updated_at}
                  icon={CheckCircle2}
                  active
                  color="text-emerald-600"
                />
              )}
              {app.status === 'rejected' && (
                <TimelineItem
                  label="Rejected"
                  date={app.reviewed_at ?? app.updated_at}
                  icon={XCircle}
                  active
                  color="text-red-600"
                />
              )}
            </div>
          </Card>

          {/* Application Fee Status */}
          <Card className={`p-6 ${app.application_fee_paid ? 'border-green-200 bg-green-50/50' : app.application_fee_amount > 0 ? 'border-red-200 bg-red-50/50' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className={`h-5 w-5 ${app.application_fee_paid ? 'text-green-600' : app.application_fee_amount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
              <h2 className="text-sm font-semibold text-slate-700">Application Fee</h2>
            </div>
            {app.application_fee_amount > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-slate-800">${app.application_fee_amount.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-semibold ${app.application_fee_paid ? 'text-green-700' : 'text-red-600'}`}>
                    {app.application_fee_paid ? 'Paid' : 'Not Paid'}
                  </span>
                </div>
                {app.application_fee_paid && app.application_fee_paid_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Paid On</span>
                    <span className="text-slate-700">{new Date(app.application_fee_paid_at).toLocaleDateString()}</span>
                  </div>
                )}
                {app.application_fee_paid && app.application_fee_payment_ref && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Reference</span>
                    <span className="text-slate-700 font-mono text-xs">{app.application_fee_payment_ref}</span>
                  </div>
                )}
                {!app.application_fee_paid && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">
                      This student has <strong>not paid</strong> the application fee. Acceptance will be blocked until the fee is confirmed by Finance.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No application fee required for this school.</p>
            )}
          </Card>

          {/* Review Notes */}
          {app.review_notes && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Review Notes</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{app.review_notes}</p>
            </Card>
          )}

          {/* Registration Number (if accepted) */}
          {app.registration_number && (
            <Card className="p-6 border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-semibold text-emerald-700">Registration Number</h2>
              </div>
              <p className="text-lg font-bold font-mono text-emerald-800">{app.registration_number}</p>
            </Card>
          )}

          {/* Enrollment Status — shown once application is accepted */}
          {app.status === 'accepted' && enrollmentStatus && (
            <Card className={`p-6 ${
              enrollmentStatus.account_exists
                ? 'border-green-200 bg-green-50/50'
                : enrollmentStatus.reg_fee_paid
                ? 'border-blue-200 bg-blue-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {enrollmentStatus.account_exists ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : enrollmentStatus.reg_fee_paid ? (
                  <UserCheck className="h-5 w-5 text-blue-600" />
                ) : (
                  <Key className="h-5 w-5 text-amber-600" />
                )}
                <h2 className="text-sm font-semibold text-slate-700">Enrollment Status</h2>
              </div>

              {/* Registration fee row */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100 mb-3">
                <span className="text-sm text-slate-500">Registration Fee</span>
                {enrollmentStatus.reg_fee_paid ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                    <Clock className="h-3.5 w-3.5" /> Awaiting Payment
                  </span>
                )}
              </div>

              {/* Account row */}
              <div className="flex items-center justify-between py-2 mb-3">
                <span className="text-sm text-slate-500">Login Account</span>
                {enrollmentStatus.account_exists ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Created
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Not yet created</span>
                )}
              </div>

              {/* Enroll button — only when fee paid and no account yet */}
              {!enrollmentStatus.account_exists && enrollmentStatus.reg_fee_paid && (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {enrolling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {enrolling ? 'Enrolling…' : 'Enroll Student'}
                </button>
              )}

              {/* Already enrolled */}
              {enrollmentStatus.account_exists && (
                <p className="text-xs text-green-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Student can log in with their registration number and the school default password.
                </p>
              )}

              {/* Waiting for payment */}
              {!enrollmentStatus.reg_fee_paid && !enrollmentStatus.account_exists && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Waiting for the bursar to record registration fee payment.
                </p>
              )}
            </Card>
          )}

          {/* Actions */}
          {canReview && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Review Actions</h2>

              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add review notes (optional)..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none mb-4"
                rows={3}
              />

              <div className="space-y-2">
                {app.status === 'submitted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    loading={actionLoading === 'under_review'}
                    onClick={() => handleAction('under_review')}
                  >
                    <Clock className="h-4 w-4 mr-1" /> Mark Under Review
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  loading={actionLoading === 'documents_requested'}
                  onClick={() => handleAction('documents_requested')}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" /> Request Documents
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  loading={actionLoading === 'waitlisted'}
                  onClick={() => handleAction('waitlisted')}
                >
                  <Clock className="h-4 w-4 mr-1" /> Waitlist
                </Button>

                <div className="border-t border-slate-100 my-3" />

                <Select
                  label="Assign to Class *"
                  options={classOptions}
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  placeholder="Select class for enrollment"
                />

                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                  loading={actionLoading === 'accept'}
                  onClick={() => handleAction('accept')}
                  disabled={!selectedClassId}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept Student
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  loading={actionLoading === 'reject'}
                  onClick={() => handleAction('reject')}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>

              {/* Email status indicator — shown after accept or reject */}
              {emailStatus !== 'idle' && app.guardian_email && (
                <div className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                  emailStatus === 'sending' ? 'bg-blue-50 text-blue-700' :
                  emailStatus === 'sent'    ? 'bg-green-50 text-green-700' :
                                             'bg-red-50 text-red-600'
                }`}>
                  {emailStatus === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {emailStatus === 'sent'    && <Mail className="h-3.5 w-3.5" />}
                  {emailStatus === 'failed'  && <XCircle className="h-3.5 w-3.5" />}
                  <span>
                    {emailStatus === 'sending' && `Sending letter to ${app.guardian_email}…`}
                    {emailStatus === 'sent'    && `Letter emailed to ${app.guardian_email}`}
                    {emailStatus === 'failed'  && 'Email failed — check SMTP settings or send manually'}
                  </span>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== HELPER COMPONENTS ====================

function InfoRow({
  label,
  value,
  capitalize,
  icon: Icon,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <p className={`text-sm text-slate-700 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  icon: Icon,
  active,
  color,
}: {
  label: string;
  date: string;
  icon: React.ElementType;
  active?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${color ?? (active ? 'text-primary-600' : 'text-slate-300')}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{new Date(date).toLocaleString()}</p>
      </div>
    </div>
  );
}
