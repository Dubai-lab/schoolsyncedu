import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useMutate } from '@/hooks/useFetch';
import { letterApprovalService, letterSendService } from '@/services/letterService';
import { USER_ROLES, type UserRole } from '@/utils/constants';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { XCircle, RotateCcw, MessageSquare, ChevronDown, ChevronUp, Eye, Mail, Lock } from 'lucide-react';
import type { LetterApprovalStatus } from '@/types/letter.types';
import { notify } from '@/components/shared/Toast';

const APPROVER_ROLES: UserRole[] = [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL];

function severityVariant(s: string) {
  if (s === 'critical') return 'danger' as const;
  if (s === 'high') return 'warning' as const;
  if (s === 'medium') return 'info' as const;
  return 'default' as const;
}

export default function LetterApproval() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const userRole = (user?.role ?? '') as UserRole;
  const isApprover = APPROVER_ROLES.includes(userRole);

  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: pendingLetters, isLoading } = useFetch(
    ['letter-approvals-pending', schoolId],
    () => letterApprovalService.listPending(schoolId),
    { enabled: !!schoolId },
  );

  const approve = useMutate(
    (vars: { id: string; status: LetterApprovalStatus; comments?: string }) =>
      letterApprovalService.approve(vars.id, userId, vars.status, vars.comments),
    [['letter-approvals-pending'], ['letter-instances']],
    {
      onSuccess: () => notify.success('Letter decision submitted'),
    },
  );

  const approveAndSend = useMutate(
    async (vars: { id: string }) => {
      await letterApprovalService.approve(vars.id, userId, 'approved');
      // Email failure is non-fatal — approval stands, we report both outcomes
      return letterSendService.sendToGuardian(vars.id, schoolId, userId);
    },
    [['letter-approvals-pending'], ['letter-instances']],
    {
      onSuccess: (result) => {
        const r = result as { sent: boolean; reason?: string };
        if (r.sent) {
          notify.success('Letter approved and emailed to guardian');
        } else {
          notify.success('Letter approved');
          notify.error(`Email not sent: ${r.reason ?? 'Unknown error'}`);
        }
      },
      onError: (err: unknown) =>
        notify.error((err as Error).message ?? 'Approval failed'),
    },
  );

  const handleAction = (id: string, status: LetterApprovalStatus) => {
    if (status !== 'approved' && !comment && commentFor !== id) {
      setCommentFor(id);
      return;
    }
    approve.mutate({ id, status, comments: comment || undefined });
    setCommentFor(null);
    setComment('');
  };

  const letters = pendingLetters ?? [];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Letters', href: '/letters' }, { label: 'Approvals' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Pending Approvals</h1>
        <Badge variant="warning" size="sm">{letters.length} pending</Badge>
      </div>

      {!isApprover && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            Only the <strong>Principal</strong> or <strong>Vice Principal</strong> can approve letters.
            You can preview them here, but approval actions are restricted to those roles.
          </span>
        </div>
      )}

      {isLoading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!isLoading && letters.length === 0 && (
        <Card className="p-8 text-center text-slate-500">No letters pending approval.</Card>
      )}

      <div className="space-y-4">
        {letters.map((letter) => {
          const student = letter.students as Record<string, string> | undefined;
          const template = letter.letter_templates as Record<string, string> | undefined;
          // Use rendered_html (school info already resolved) — fall back to raw template body if old record
          const bodyHtml = letter.rendered_html ?? (template?.body_html ?? '');
          const isExpanded = expandedId === letter.id;

          return (
            <Card key={letter.id} className="overflow-hidden">
              {/* ── Header row ── */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{letter.reference_number}</span>
                      <Badge variant={severityVariant(template?.severity ?? '')} size="sm">
                        {template?.severity ?? ''}
                      </Badge>
                    </div>
                    <p className="font-semibold text-slate-900">{template?.name ?? 'Unknown template'}</p>
                    <p className="text-sm text-slate-600">
                      Student:{' '}
                      <span className="font-medium">
                        {student ? `${student.first_name} ${student.last_name}` : '—'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Submitted {new Date(letter.created_at).toLocaleDateString()} · Channels:{' '}
                      {letter.delivery_channels.join(', ')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <div className="flex gap-2 flex-wrap justify-end">
                      {/* Preview toggle — available to everyone */}
                      {bodyHtml && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {isExpanded ? (
                            <><ChevronUp className="h-3 w-3 mr-0.5" /> Hide</>
                          ) : (
                            <><ChevronDown className="h-3 w-3 mr-0.5" /> Preview</>
                          )}
                        </Button>
                      )}
                      {/* Approval actions — principal / VP only */}
                      {isApprover && (
                        <>
                          {/* Approve & Send is primary — approval always triggers email */}
                          <Button
                            size="sm"
                            onClick={() => approveAndSend.mutate({ id: letter.id })}
                            loading={approveAndSend.isPending}
                            title="Approve and email the guardian via school SMTP"
                          >
                            <Mail className="h-4 w-4 mr-1" /> Approve & Send
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(letter.id, 'changes_requested')}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" /> Request Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleAction(letter.id, 'rejected')}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>

                    {commentFor === letter.id && (
                      <div className="flex gap-2 w-full mt-1">
                        <input
                          type="text"
                          className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Add comments…"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(
                              letter.id,
                              commentFor === letter.id ? 'changes_requested' : 'rejected',
                            )
                          }
                        >
                          <MessageSquare className="h-4 w-4 mr-1" /> Send
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Expandable letter body preview ── */}
              {isExpanded && bodyHtml && (
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                    Letter Preview
                  </p>
                  <div className="bg-white rounded-lg border border-slate-200 p-5 overflow-auto max-h-[500px]">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
