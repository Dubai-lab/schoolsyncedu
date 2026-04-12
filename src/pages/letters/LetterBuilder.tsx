import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { letterTemplateService, letterInstanceService, letterSendService } from '@/services/letterService';
import { schoolSettingsService } from '@/services/settingsService';
import { studentService } from '@/services/studentService';
import { LETTER_CATEGORIES, USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import { renderLetterHtml, buildSchoolPlaceholders, buildStudentPlaceholders, resolvePlaceholders } from '@/utils/letterRenderer';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Send, FileText, Eye, Info, Mail } from 'lucide-react';
import type { LetterCategory, LetterDeliveryChannel } from '@/types/letter.types';

const categoryOptions = Object.entries(LETTER_CATEGORIES).map(([, v]) => ({
  label: (v as string).charAt(0).toUpperCase() + (v as string).slice(1),
  value: v as string,
}));

const channelOptions: { label: string; value: LetterDeliveryChannel }[] = [
  { label: 'PDF Download', value: 'pdf' },
  { label: 'Portal Notification', value: 'portal' },
  { label: 'SMS', value: 'sms' },
  { label: 'Email', value: 'email' },
];

const TEMPLATE_MANAGERS: UserRole[] = [
  USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL,
  USER_ROLES.ADMIN_STAFF, USER_ROLES.IT_ADMIN,
];

// Roles that can approve letters — they skip the approval queue and send directly
const CAN_APPROVE: UserRole[] = [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL];

export default function LetterBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const userRole = (user?.role ?? '') as UserRole;
  const isManager = TEMPLATE_MANAGERS.includes(userRole);
  const canSendDirectly = CAN_APPROVE.includes(userRole);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [studentId, setStudentId] = useState('');
  const [recipientType, setRecipientType] = useState('student');
  const [channels, setChannels] = useState<LetterDeliveryChannel[]>(['portal']);
  // Extra values staff fill in for template-specific placeholders (fee_amount, due_date, etc.)
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});

  // ── Fetch school data (used to resolve {{school_name}}, {{logo}}, etc.) ──
  const { data: school } = useFetch(
    ['school-data', schoolId],
    () => schoolSettingsService.get(schoolId),
    { enabled: !!schoolId },
  );

  // ── Fetch templates filtered by category (RLS already limits to allowed roles) ──
  const { data: templatesResult, isLoading: templatesLoading } = useFetch(
    ['letter-templates', schoolId, selectedCategory],
    () => letterTemplateService.list(schoolId, (selectedCategory as LetterCategory) || undefined),
    { enabled: !!schoolId },
  );

  const templates = templatesResult?.data ?? [];
  const templateOptions = templates.map((t) => ({ label: t.name, value: t.id }));
  const currentTemplate = templates.find((t) => t.id === selectedTemplate);

  // ── Fetch student when student ID or reg number is provided ──
  // Accepts either a UUID (e.g. "abc123-...") or registration number (e.g. "SEY-2026-0001")
  const { data: studentData } = useFetch(
    ['student-for-letter', studentId],
    () => studentService.findByIdOrRegNumber(studentId),
    { enabled: !!studentId && studentId.length > 4 },
  );

  // ── Build resolved preview HTML ──
  // School + student placeholders resolve automatically; extra values fill
  // the template-specific fields (fee_amount, due_date, etc.) the staff typed in.
  const previewHtml = (() => {
    if (!currentTemplate || !school) return '';
    return renderLetterHtml(
      currentTemplate.body_html,
      school,
      (studentData as unknown as Parameters<typeof renderLetterHtml>[2]) ?? undefined,
      extraValues,
    );
  })();

  const toggleChannel = (ch: LetterDeliveryChannel) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  // ── Helpers to build the stored rendered_html and recipient_data ──
  function buildRenderedHtml(): string {
    if (!currentTemplate || !school) return '';
    return renderLetterHtml(
      currentTemplate.body_html,
      school,
      (studentData as unknown as Parameters<typeof renderLetterHtml>[2]) ?? undefined,
      extraValues,
    );
  }

  function buildRecipientData(): Record<string, unknown> {
    if (!school) return {};
    return {
      ...buildSchoolPlaceholders(school),
      ...(studentData
        ? {
            student_name: `${studentData.first_name ?? ''} ${studentData.last_name ?? ''}`.trim(),
            student_id_number: studentData.registration_number ?? '',
            class_name: studentData.current_grade_level ?? '',
          }
        : {}),
      ...extraValues,
    };
  }

  // ── Create letter instance (save as draft) ──
  const createMutation = useMutate(
    () =>
      letterInstanceService.create(schoolId, {
        template_id: selectedTemplate,
        student_id: studentData?.id ?? studentId,
        recipient_type: recipientType,
        recipient_data: buildRecipientData(),
        delivery_channels: channels,
        created_by: userId,
        rendered_html: buildRenderedHtml(),
      }),
    [['letter-instances']],
    {
      onSuccess: () => {
        notify.success('Letter created as draft');
        navigate('/letters');
      },
      onError: (err: unknown) => notify.error('Failed to save draft: ' + (err as Error).message),
    },
  );

  // ── Submit for approval ──
  const submitMutation = useMutate(
    async () => {
      const studentUuid = studentData?.id ?? studentId;
      const instance = await letterInstanceService.create(schoolId, {
        template_id: selectedTemplate,
        student_id: studentUuid,
        recipient_type: recipientType,
        recipient_data: buildRecipientData(),
        delivery_channels: channels,
        created_by: userId,
        rendered_html: buildRenderedHtml(),
      });
      await letterInstanceService.submitForApproval(instance.id);
      return instance;
    },
    [['letter-instances']],
    {
      onSuccess: () => {
        notify.success('Letter submitted for approval');
        navigate('/letters');
      },
      onError: (err: unknown) => notify.error('Submit failed: ' + (err as Error).message),
    },
  );

  // ── Principal/VP: Create + Send directly (no approval queue) ──
  const sendDirectlyMutation = useMutate(
    async () => {
      const studentUuid = studentData?.id ?? studentId;
      const instance = await letterInstanceService.create(schoolId, {
        template_id: selectedTemplate,
        student_id: studentUuid,
        recipient_type: recipientType,
        recipient_data: buildRecipientData(),
        delivery_channels: channels,
        created_by: userId,
        rendered_html: buildRenderedHtml(),
      });
      const result = await letterSendService.sendToGuardian(instance.id, schoolId, userId);
      if (!result.sent) throw new Error(result.reason ?? 'Email delivery failed');
      return instance;
    },
    [['letter-instances']],
    {
      onSuccess: () => {
        notify.success('Letter created and emailed to guardian');
        navigate('/letters');
      },
      onError: (err: unknown) => notify.error((err as Error).message ?? 'Send failed'),
    },
  );

  const canCreate = selectedTemplate && studentData && channels.length > 0;

  // ── Placeholders the template uses that aren't auto-filled by school/student data ──
  // These are the fields the user must fill in manually (fee_amount, due_date, etc.)
  const schoolKeys = ['school_name', 'school_logo_url', 'school_address', 'school_phone',
    'school_website', 'moe_registration_number', 'principal_name', 'date', 'academic_year',
    'school_motto', 'school_county'];
  const studentKeys = ['student_name', 'student_first_name', 'student_last_name',
    'student_id_number', 'class_name', 'student_gender'];

  const unresolvedPlaceholders = currentTemplate
    ? (currentTemplate.placeholders_used as string[]).filter(
        (p) => !schoolKeys.includes(p) && !studentKeys.includes(p),
      )
    : [];

  // Subset of the above that the user still hasn't typed a value for
  const stillUnfilled = unresolvedPlaceholders.filter((p) => !extraValues[p]?.trim());

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Letters', href: '/letters' }, { label: 'Create Letter' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Create Letter</h1>
        {!isManager && (
          <p className="text-sm text-slate-500 italic">
            Templates shown are assigned to your role by the Principal.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ─── Left: Form ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Letter Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Category"
                options={categoryOptions}
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setSelectedTemplate(''); }}
                placeholder="Filter by category"
              />
              <Select
                label="Template"
                options={templateOptions}
                value={selectedTemplate}
                onChange={(e) => { setSelectedTemplate(e.target.value); setExtraValues({}); }}
                placeholder={templatesLoading ? 'Loading...' : 'Select template'}
                disabled={templatesLoading}
              />
              <Input
                label="Student Registration No. or ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. SEY-2026-0001 or paste UUID"
                hint={
                  studentId && studentId.length > 4
                    ? studentData
                      ? (() => {
                          const guardians = (studentData.guardians as Array<{ email?: string | null }> | null) ?? [];
                          const guardianEmail = guardians.find((g) => g.email?.trim())?.email;
                          return `✓ ${studentData.first_name} ${studentData.last_name} — ${studentData.current_grade_level ?? ''}${guardianEmail ? ` · Email: ${guardianEmail}` : ' · ⚠ No guardian email on file'}`;
                        })()
                      : 'Student not found — check the registration number'
                    : undefined
                }
              />
              <Select
                label="Recipient Type"
                options={[
                  { label: 'Student', value: 'student' },
                  { label: 'Guardian', value: 'guardian' },
                  { label: 'Both', value: 'both' },
                ]}
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Channels</label>
                <div className="flex flex-wrap gap-2">
                  {channelOptions.map((ch) => (
                    <button
                      key={ch.value}
                      onClick={() => toggleChannel(ch.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        channels.includes(ch.value)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable fields for template-specific placeholders */}
              {unresolvedPlaceholders.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">
                      Fill in the fields below — they will appear in the letter
                    </p>
                  </div>
                  {unresolvedPlaceholders.map((p) => (
                    <div key={p}>
                      <label className="block text-xs font-medium text-amber-900 mb-1 capitalize">
                        {p.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder={`Enter ${p.replace(/_/g, ' ')}…`}
                        value={extraValues[p] ?? ''}
                        onChange={(e) =>
                          setExtraValues((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end flex-wrap">
            <Button
              variant="outline"
              onClick={() => createMutation.mutate(undefined)}
              loading={createMutation.isPending}
              disabled={!canCreate}
            >
              <FileText className="h-4 w-4 mr-1" /> Save as Draft
            </Button>
            {canSendDirectly ? (
              <Button
                onClick={() => sendDirectlyMutation.mutate(undefined)}
                loading={sendDirectlyMutation.isPending}
                disabled={!canCreate}
                title="Create and immediately email the guardian — no approval needed"
              >
                <Mail className="h-4 w-4 mr-1" /> Send to Guardian
              </Button>
            ) : (
              <Button
                onClick={() => submitMutation.mutate(undefined)}
                loading={submitMutation.isPending}
                disabled={!canCreate}
                title="Submit this letter for the Principal to review and approve"
              >
                <Send className="h-4 w-4 mr-1" /> Submit for Approval
              </Button>
            )}
          </div>
        </div>

        {/* ─── Right: Live Preview ─── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-400" />
              <CardTitle>Preview</CardTitle>
              {school && currentTemplate && (
                <span className="ml-auto text-xs text-emerald-600 font-medium">
                  School info auto-filled
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!currentTemplate ? (
              <p className="text-sm text-slate-400 text-center py-12">Select a template to preview.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="text-slate-400">Subject</p>
                  <p className="font-medium">
                    {school
                      ? resolvePlaceholders(currentTemplate.subject, {
                          ...buildSchoolPlaceholders(school),
                          ...(studentData ? buildStudentPlaceholders(studentData as unknown as Parameters<typeof buildStudentPlaceholders>[0]) : {}),
                          ...extraValues,
                        })
                      : currentTemplate.subject}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 overflow-auto max-h-[600px]">
                  {previewHtml
                    ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    : <p className="text-xs text-slate-400">Loading school data…</p>
                  }
                </div>
                {stillUnfilled.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Fill in: <span className="font-medium">{stillUnfilled.map((p) => p.replace(/_/g, ' ')).join(', ')}</span> — shown as <span className="font-mono">{'{{…}}'}</span> in the letter above.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
