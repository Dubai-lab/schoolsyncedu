import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { letterSendService } from '@/services/letterService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Upload,
  FileText,
  X,
  Send,
  User,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentOption {
  id: string;
  name: string;
  registration_number: string;
  guardian_email: string | null;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const ACCEPTED_EXT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const MAX_MB = 20;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomLetterUpload() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId   = user?.id ?? '';

  // File state
  const [file, setFile]           = useState<File | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recipient state
  const [recipientMode, setRecipientMode] = useState<'student' | 'manual'>('student');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents]           = useState<StudentOption[]>([]);
  const [searching, setSearching]         = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [manualEmail, setManualEmail]     = useState('');
  const [manualName, setManualName]       = useState('');

  // Email fields
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Status
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; reason?: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const validateAndSet = (f: File) => {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError('Only PDF, Word (.doc/.docx), JPG, and PNG files are supported.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`File is too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
  };

  // ── Student search ─────────────────────────────────────────────────────────

  const searchStudents = async (q: string) => {
    if (q.trim().length < 2) { setStudents([]); return; }
    setSearching(true);
    try {
      const like = `%${q.trim()}%`;
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, registration_number')
        .eq('school_id', schoolId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},registration_number.ilike.${like}`)
        .eq('status', 'enrolled')
        .limit(8);

      const list: StudentOption[] = [];
      for (const s of data ?? []) {
        // Look up guardian email
        const { data: gd } = await supabase
          .from('guardians')
          .select('email')
          .eq('student_id', s.id)
          .not('email', 'is', null)
          .limit(1)
          .maybeSingle();

        list.push({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          registration_number: s.registration_number,
          guardian_email: (gd as { email?: string } | null)?.email ?? null,
        });
      }
      setStudents(list);
    } finally {
      setSearching(false);
    }
  };

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    setResult(null);

    if (!file)    { setResult({ ok: false, reason: 'Please select a file to send.' }); return; }
    if (!subject.trim()) { setResult({ ok: false, reason: 'Please enter a subject line.' }); return; }

    let recipientEmail = '';
    let recipientName  = '';
    let studentId: string | null = null;

    if (recipientMode === 'student') {
      if (!selectedStudent) { setResult({ ok: false, reason: 'Please select a student.' }); return; }
      if (!selectedStudent.guardian_email) {
        setResult({ ok: false, reason: `No guardian email on file for ${selectedStudent.name}. Add one under the student's Guardians tab.` });
        return;
      }
      recipientEmail = selectedStudent.guardian_email;
      recipientName  = `Guardian of ${selectedStudent.name}`;
      studentId      = selectedStudent.id;
    } else {
      if (!manualEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualEmail)) {
        setResult({ ok: false, reason: 'Please enter a valid recipient email address.' });
        return;
      }
      recipientEmail = manualEmail.trim();
      recipientName  = manualName.trim();
    }

    setSending(true);
    try {
      const res = await letterSendService.sendCustomLetter({
        schoolId,
        sentBy: userId,
        file,
        recipientEmail,
        recipientName,
        studentId,
        subject: subject.trim(),
        message: message.trim(),
      });

      setResult({ ok: res.sent, reason: res.reason });
      if (res.sent) {
        // Reset form on success
        setFile(null);
        setSelectedStudent(null);
        setStudentSearch('');
        setStudents([]);
        setManualEmail('');
        setManualName('');
        setSubject('');
        setMessage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (e) {
      setResult({ ok: false, reason: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const fileSize = file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '';

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumb items={[
        { label: 'Letters', href: '/letters' },
        { label: 'Upload & Send Custom Letter' },
      ]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-600" />
          Upload & Send Custom Letter
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Send a letter you prepared in Word or PDF format using your school's email configuration.
        </p>
      </div>

      {/* ── Step 1: File ── */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">1. Select Your Letter File</h2>
        <p className="text-xs text-slate-400">PDF, Word (.doc/.docx), JPG or PNG · Max {MAX_MB} MB</p>

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors ${
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : 'border-slate-200 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/40'
            }`}
          >
            <Upload className="h-8 w-8 text-slate-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">Drag & drop your file here</p>
              <p className="text-xs text-slate-400 mt-0.5">or click to browse</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXT}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <FileText className="h-8 w-8 shrink-0 text-green-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{fileSize}</p>
            </div>
            <button
              onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {fileError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {fileError}
          </p>
        )}
      </Card>

      {/* ── Step 2: Recipient ── */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">2. Choose Recipient</h2>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            onClick={() => setRecipientMode('student')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              recipientMode === 'student'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="h-3.5 w-3.5" /> Student Guardian
          </button>
          <button
            onClick={() => setRecipientMode('manual')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              recipientMode === 'manual'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Custom Email
          </button>
        </div>

        {recipientMode === 'student' ? (
          <div className="space-y-3">
            {/* Student search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setSelectedStudent(null);
                  searchStudents(e.target.value);
                }}
                placeholder="Search by name or registration number…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {/* Results */}
            {searching && <p className="text-xs text-slate-400">Searching…</p>}
            {!searching && students.length > 0 && !selectedStudent && (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setStudents([]); setStudentSearch(s.name); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.registration_number}</p>
                    </div>
                    {s.guardian_email ? (
                      <span className="shrink-0 text-xs text-green-600 font-medium">{s.guardian_email}</span>
                    ) : (
                      <span className="shrink-0 text-xs text-amber-600">No email on file</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Selected student */}
            {selectedStudent && (
              <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50/40 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{selectedStudent.name}</p>
                  <p className="text-xs text-slate-500">
                    {selectedStudent.registration_number} ·{' '}
                    {selectedStudent.guardian_email
                      ? <span className="text-green-700">Sending to: {selectedStudent.guardian_email}</span>
                      : <span className="text-amber-600">No guardian email on file</span>
                    }
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Email *</label>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="guardian@example.com"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Name (optional)</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Mr. James Kollie"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── Step 3: Email content ── */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">3. Email Details</h2>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Important Letter from [School Name]"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Short message in email body <span className="text-slate-400">(optional — appears above the attachment notice)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Please review the attached letter and contact us if you have any questions."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm resize-none focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-xs text-slate-400">
            The email will say "Please find attached a letter from [School Name]." The uploaded file is the actual letter.
          </p>
        </div>
      </Card>

      {/* ── Result banner ── */}
      {result && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          result.ok
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {result.ok
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          }
          <div>
            <p className="text-sm font-medium">
              {result.ok ? 'Letter sent successfully!' : 'Failed to send'}
            </p>
            {result.reason && !result.ok && (
              <p className="text-sm mt-0.5">{result.reason}</p>
            )}
            {result.ok && (
              <p className="text-xs mt-0.5 text-green-700">
                The letter has been delivered and saved to the letter history.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Send button ── */}
      <div className="flex justify-end">
        <Button onClick={handleSend} loading={sending} disabled={!file || sending}>
          <Send className="h-4 w-4 mr-1.5" />
          {sending ? 'Sending…' : 'Send Letter'}
        </Button>
      </div>
    </div>
  );
}
