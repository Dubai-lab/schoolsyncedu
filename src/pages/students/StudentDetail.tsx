import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentService, enrollmentService, studentDocumentService } from '@/services/studentService';
import type { StudentDocument } from '@/services/studentService';
import { notify } from '@/components/shared/Toast';
import { Tabs, TabList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { StudentStatus } from '@/types/student.types';
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  GraduationCap,
  User,
  Users,
  FileText,
  DollarSign,
  Upload,
  Trash2,
  ExternalLink,
  FolderOpen,
  Plus,
  X,
  Loader2,
} from 'lucide-react';

const statusVariant: Record<StudentStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  enrolled: 'success',
  suspended: 'warning',
  expelled: 'danger',
  withdrawn: 'default',
  graduated: 'info',
  on_leave: 'warning',
};

const DOCUMENT_TYPES = [
  { value: 'birth_certificate',  label: 'Birth Certificate' },
  { value: 'transcript',         label: 'Academic Transcript' },
  { value: 'report_card',        label: 'Report Card' },
  { value: 'national_id',        label: 'National ID / Passport' },
  { value: 'medical_record',     label: 'Medical Record' },
  { value: 'immunization',       label: 'Immunization Record' },
  { value: 'recommendation',     label: 'Recommendation Letter' },
  { value: 'other',              label: 'Other' },
];

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Upload modal state
  const [showUpload,    setShowUpload]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [docType,       setDocType]       = useState('birth_certificate');
  const [docName,       setDocName]       = useState('');
  const [docFile,       setDocFile]       = useState<File | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: student, isLoading } = useFetch(
    ['student', id!],
    () => studentService.getById(id!),
    { enabled: !!id },
  );

  const { data: enrollments } = useFetch(
    ['enrollments', id!],
    () => enrollmentService.listByStudent(id!),
    { enabled: !!id },
  );

  const {
    data: staffDocs = [],
    refetch: refetchDocs,
  } = useFetch(
    ['student-documents', id!],
    () => studentDocumentService.list(id!),
    { enabled: !!id },
  );

  const { data: linkedApp } = useFetch(
    ['student-linked-app', id!],
    () => studentDocumentService.getLinkedApplication(id!),
    { enabled: !!id },
  );

  // Application docs: stored as { "Label": "url", ... } JSONB object
  const appDocEntries: [string, string][] = linkedApp?.documents
    ? Object.entries(linkedApp.documents as Record<string, string>)
    : [];

  const documents = staffDocs as StudentDocument[];

  async function handleUpload() {
    if (!docFile || !user?.school_id || !id) return;
    setUploading(true);
    try {
      const label = docName.trim() || (DOCUMENT_TYPES.find((t) => t.value === docType)?.label ?? docType);
      await studentDocumentService.upload(
        user.school_id,
        id,
        docFile,
        docType,
        label,
        user.id,
      );
      notify.success('Document uploaded successfully');
      setShowUpload(false);
      setDocFile(null);
      setDocName('');
      setDocType('birth_certificate');
      void refetchDocs();
    } catch (err) {
      notify.error((err as Error).message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: StudentDocument) {
    if (!confirm(`Delete "${doc.document_name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      await studentDocumentService.delete(doc.id, doc.file_path);
      notify.success('Document deleted');
      void refetchDocs();
    } catch (err) {
      notify.error((err as Error).message ?? 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading student..." />;
  if (!student) return <p className="py-10 text-center text-slate-400">Student not found.</p>;

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Students', href: '/students' },
        { label: fullName },
      ]} />

      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/students')} />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
            {student.first_name[0]}{student.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-slate-500 font-mono">{student.registration_number}</span>
              <Badge variant={statusVariant[student.status]}>{student.status.replace(/_/g, ' ')}</Badge>
            </div>
          </div>
        </div>
        <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/students/${id}/edit`)}>
          Edit Student
        </Button>
      </div>

      {/* Pending Registration Fee Warning */}
      {enrollments?.some((e) => (e.status as string) === 'pending_payment') && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <DollarSign className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Registration Fee Pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This student's enrollment is waiting for the registration fee to be paid.
              The Bursar must record the payment to activate enrollment.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabList>
          <TabTrigger value="profile"><User className="h-4 w-4" /> Profile</TabTrigger>
          <TabTrigger value="guardians"><Users className="h-4 w-4" /> Guardians</TabTrigger>
          <TabTrigger value="enrollment"><FileText className="h-4 w-4" /> Enrollment</TabTrigger>
          <TabTrigger value="documents">
            <FolderOpen className="h-4 w-4" /> Documents
            {(appDocEntries.length + documents.length) > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                {appDocEntries.length + documents.length}
              </span>
            )}
          </TabTrigger>
        </TabList>

        {/* Profile tab */}
        <TabContent value="profile">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Gender" value={student.gender} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—'} />
                <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Grade Level" value={student.current_grade_level ?? '—'} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Enrolled" value={student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : '—'} />
                {student.previous_school && (
                  <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Previous School" value={student.previous_school} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={student.emergency_contact_name ?? '—'} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={student.emergency_contact_phone ?? '—'} />
              </CardContent>
            </Card>
          </div>
        </TabContent>

        {/* Guardians tab */}
        <TabContent value="guardians">
          {student.guardians.length === 0 ? (
            <Card><CardContent><p className="text-sm text-slate-400 py-4">No guardians on record.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {student.guardians.map((g) => (
                <Card key={g.id}>
                  <CardContent className="space-y-2.5 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                        {g.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{g.full_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{g.relationship}</p>
                      </div>
                    </div>
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={g.phone ?? '—'} />
                    {g.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={g.email} />}
                    {g.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={g.address} />}
                    {g.occupation && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={g.occupation} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabContent>

        {/* Enrollment tab */}
        <TabContent value="enrollment">
          <Card>
            <CardHeader><CardTitle>Enrollment History</CardTitle></CardHeader>
            <CardContent>
              {!enrollments || enrollments.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No enrollment records.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{e.academic_year}</p>
                        <p className="text-xs text-slate-400">
                          Enrolled {new Date(e.enrollment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={
                        e.status === 'active' ? 'success' :
                        e.status === 'completed' ? 'info' :
                        (e.status as string) === 'pending_payment' ? 'warning' :
                        'default'
                      }>
                        {(e.status as string) === 'pending_payment' ? 'Pending Payment' : e.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>

        {/* Documents tab */}
        <TabContent value="documents">
          <div className="space-y-5">

            {/* Upload button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowUpload(true)}
              >
                Upload Document
              </Button>
            </div>

            {/* Application documents (read-only, from online application) */}
            {appDocEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Submitted with Application
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      (Application {linkedApp?.application_number})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-50">
                    {appDocEntries.map(([label, url]) => (
                      <div key={label} className="flex items-center gap-3 px-5 py-3">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <p className="flex-1 text-sm font-medium text-slate-700">{label}</p>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> View
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Staff-uploaded documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-emerald-500" />
                  Staff Uploaded Documents
                </CardTitle>
              </CardHeader>
              <CardContent className={documents.length === 0 ? 'py-8 text-center' : 'p-0'}>
                {documents.length === 0 ? (
                  <div>
                    <FolderOpen className="h-9 w-9 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No documents uploaded yet.</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Click "Upload Document" to add documents for this student.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{doc.document_name}</p>
                          <p className="text-xs text-slate-400 capitalize">
                            {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type}
                            {' · '}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> View
                          </a>
                          <button
                            onClick={() => void handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            {deletingId === doc.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabContent>
      </Tabs>

      {/* Upload Document Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUpload(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Document type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Document name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Document Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={DOCUMENT_TYPES.find((t) => t.value === docType)?.label ?? ''}
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* File picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {docFile ? (
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <FileText className="h-5 w-5" />
                      <span className="font-medium truncate max-w-xs">{docFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 text-slate-300 mb-1" />
                      <p className="text-sm text-slate-500">Click to select file</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG — max 10 MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowUpload(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!docFile || uploading}
                  loading={uploading}
                  onClick={() => void handleUpload()}
                >
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HELPER ====================

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 capitalize">{value}</p>
      </div>
    </div>
  );
}