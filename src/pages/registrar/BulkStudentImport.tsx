import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentImportService, registrarService } from '@/services/registrarService';
import type { ImportStudentRow, ImportRowResult } from '@/services/registrarService';
import { classService } from '@/services/classService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Download, Upload, CheckCircle2, XCircle, AlertCircle,
  Users, FileSpreadsheet, Printer, ChevronRight, RefreshCw,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type ValidatedRow = ImportStudentRow & { _valid: boolean; _errors: string[] };

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}
void formatCurrency; // suppress unused warning

// ── Component ──────────────────────────────────────────────────────────────

export default function BulkStudentImport() {
  const { user } = useAuth();
  const schoolId  = user?.school_id ?? '';

  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [step, setStep]                 = useState<Step>('upload');
  const [rows, setRows]                 = useState<ValidatedRow[]>([]);
  const [parseError, setParseError]     = useState('');
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [progress, setProgress]         = useState({ done: 0, total: 0 });
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState('');

  // Load academic year, default password, and classes for validation
  const { data: academicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const { data: defaultPassword } = useFetch(
    ['school-setting-default-student-password', schoolId],
    () => registrarService.getSetting(schoolId, 'default_student_password'),
    { enabled: !!schoolId },
  );

  const { data: classesResult } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classNames = (classesResult?.data ?? []).map((c) => c.name);

  // ── Download template ────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = studentImportService.getTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'schoolsync_student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── File upload & parse ──────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setParseError('');
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: parsed, errors } = studentImportService.parseCsv(text);
      if (errors.length > 0) {
        setParseError(errors[0]);
        return;
      }
      if (parsed.length === 0) {
        setParseError('No data rows found in the file. Check you filled in the template correctly.');
        return;
      }
      const validated = studentImportService.validateRows(parsed, classNames);
      setRows(validated);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // reset so re-uploading same file works
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Import ───────────────────────────────────────────────────────────────
  const validRows  = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid);

  const runImport = async () => {
    if (validRows.length === 0) return;
    if (!academicYear) { setImportError('Academic year is not set. Ask the IT Admin to configure it first.'); return; }
    setImporting(true);
    setImportError('');
    setProgress({ done: 0, total: validRows.length });
    setStep('importing');

    try {
      const results = await studentImportService.importStudents(
        schoolId,
        academicYear,
        validRows,
        (done, total) => setProgress({ done, total }),
        defaultPassword ?? undefined,
      );
      setImportResults(results);
      setStep('done');
    } catch (err) {
      setImportError((err as Error).message ?? 'Import failed. Please try again.');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // ── Credentials print ────────────────────────────────────────────────────
  const printCredentials = () => window.print();

  const successful = importResults.filter((r) => r.success);
  const failed     = importResults.filter((r) => !r.success);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep('upload');
    setRows([]);
    setImportResults([]);
    setParseError('');
    setImportError('');
    setProgress({ done: 0, total: 0 });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Registrar', href: '/registrar' }, { label: 'Import Existing Students' }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Import Existing Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bulk-enroll students from your Excel register book — each student gets a login account automatically.
          </p>
        </div>
        {academicYear && (
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {academicYear}
          </span>
        )}
      </div>

      {/* No academic year warning */}
      {!academicYear && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Academic year is not configured. Ask the IT Admin to set it in School Settings before importing.</p>
        </div>
      )}

      {/* No classes warning */}
      {classNames.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>No classes exist yet. Ask the Principal to create classes (e.g. 12A, 10B) before importing students.</p>
        </div>
      )}

      {/* ── STEP INDICATOR ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 text-xs font-medium">
        {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = {
            upload:    '1. Upload File',
            preview:   '2. Review & Confirm',
            importing: '3. Importing…',
            done:      '4. Credentials',
          };
          const active = step === s;
          const past   = ['upload','preview','importing','done'].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              <span className={`rounded-full px-2 py-0.5 ${
                active ? 'bg-primary-600 text-white' :
                past   ? 'bg-emerald-100 text-emerald-700' :
                         'bg-slate-100 text-slate-400'
              }`}>
                {labels[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STEP 1 — UPLOAD                                                     */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Instructions */}
          <Card>
            <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">1</span>
                <p>Download the CSV template below. It has the exact columns the system needs.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">2</span>
                <p>Open it in Excel. Copy your existing student data into the template columns. Save as CSV.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">3</span>
                <p>Upload the file here. The system will validate each row and show you any errors before anything is saved.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">4</span>
                <p>Confirm the import. Each student gets a registration number, class assignment, fee assignment, and a login account automatically.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">5</span>
                <p>Print the credentials sheet and distribute login cards to students. Default password = their registration number.</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-2">
                <p className="text-xs font-semibold text-slate-700 mb-1">Available classes in the system:</p>
                {classNames.length === 0
                  ? <p className="text-xs text-slate-400">No classes yet — ask the Principal to create them first.</p>
                  : <div className="flex flex-wrap gap-1.5">
                      {classNames.map((c) => (
                        <span key={c} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{c}</span>
                      ))}
                    </div>
                }
                <p className="text-xs text-slate-400 mt-1">The class_name column in your CSV must exactly match one of these names.</p>
              </div>

              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" /> Download CSV Template
              </Button>
            </CardContent>
          </Card>

          {/* Drop zone */}
          <Card>
            <CardHeader><CardTitle>Upload Student File</CardTitle></CardHeader>
            <CardContent>
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center cursor-pointer transition-colors hover:border-primary-300 hover:bg-primary-50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700">Drop your CSV file here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                <p className="text-xs text-slate-400 mt-3">Accepted: .csv (Excel → Save As → CSV)</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />

              {parseError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {parseError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STEP 2 — PREVIEW & VALIDATE                                         */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total rows</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{validRows.length}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Ready to import</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${invalidRows.length > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <p className={`text-2xl font-bold ${invalidRows.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{invalidRows.length}</p>
              <p className={`text-xs mt-0.5 ${invalidRows.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Errors (will be skipped)</p>
            </div>
          </div>

          {/* Error rows */}
          {invalidRows.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                <XCircle className="inline h-4 w-4 mr-1" />
                {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} with errors — these will be skipped. Fix the CSV and re-upload to include them.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-red-700">
                      <th className="pb-1 pr-3">Row</th>
                      <th className="pb-1 pr-3">Name</th>
                      <th className="pb-1 pr-3">Class</th>
                      <th className="pb-1">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.map((r, i) => (
                      <tr key={i} className="border-t border-red-100">
                        <td className="py-1 pr-3 text-red-600 font-medium">{rows.indexOf(r) + 2}</td>
                        <td className="py-1 pr-3">{r.first_name} {r.last_name}</td>
                        <td className="py-1 pr-3">{r.class_name || '—'}</td>
                        <td className="py-1 text-red-600">{r._errors.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview table of valid rows */}
          {validRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-emerald-600" />
                  {validRows.length} students ready to import
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                      <tr className="text-left text-slate-500 text-xs">
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Class</th>
                        <th className="px-4 py-2 font-medium">Date of Birth</th>
                        <th className="px-4 py-2 font-medium">Gender</th>
                        <th className="px-4 py-2 font-medium">Guardian</th>
                        <th className="px-4 py-2 font-medium">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {validRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{r.first_name} {r.last_name}</td>
                          <td className="px-4 py-2">{r.class_name}</td>
                          <td className="px-4 py-2 text-slate-500">{r.date_of_birth || '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{r.gender || '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{r.guardian_name}</td>
                          <td className="px-4 py-2 text-slate-500">{r.guardian_phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {importError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> {importError}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={reset}>
              Start Over
            </Button>
            <Button
              onClick={() => void runImport()}
              disabled={validRows.length === 0 || !academicYear || importing}
              loading={importing}
            >
              <Users className="h-4 w-4 mr-1.5" />
              Import {validRows.length} Student{validRows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STEP 3 — IMPORTING PROGRESS                                         */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <RefreshCw className="mx-auto h-10 w-10 text-primary-600 animate-spin" />
            <div>
              <p className="text-lg font-semibold text-slate-900">Importing students…</p>
              <p className="text-sm text-slate-500 mt-1">
                {progress.done} of {progress.total} processed — please do not close this page
              </p>
            </div>
            {/* Progress bar */}
            <div className="mx-auto max-w-sm">
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary-600 transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* STEP 4 — RESULTS + CREDENTIALS SHEET                                */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{successful.length}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Imported successfully</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${failed.length > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <p className={`text-2xl font-bold ${failed.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{failed.length}</p>
              <p className={`text-xs mt-0.5 ${failed.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Failed</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center sm:col-span-1 col-span-2">
              <p className="text-2xl font-bold text-slate-900">{importResults.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total processed</p>
            </div>
          </div>

          {/* Failed rows */}
          {failed.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                <XCircle className="inline h-4 w-4 mr-1" />
                {failed.length} student{failed.length !== 1 ? 's' : ''} could not be imported:
              </p>
              {failed.map((r, i) => (
                <div key={i} className="text-xs text-red-700 border-t border-red-100 pt-1">
                  Row {r.row_number}: <strong>{r.first_name} {r.last_name}</strong> — {r.error}
                </div>
              ))}
            </div>
          )}

          {/* Credentials sheet */}
          {successful.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Student Login Credentials</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Print this sheet and distribute to students. Default password = registration number.
                    Students should change their password after first login.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={printCredentials}>
                  <Printer className="h-4 w-4 mr-1" /> Print Credentials
                </Button>
              </div>

              {/* Printable area */}
              <div ref={printRef} className="print-credentials">
                {/* Print-only header */}
                <div className="hidden print:block mb-4">
                  <h2 className="text-lg font-bold">Student Login Credentials — {academicYear}</h2>
                  <p className="text-xs text-gray-500">
                    Generated {new Date().toLocaleDateString()}.
                    Default password: <strong>{defaultPassword ?? '(registration number)'}</strong>.
                    Instruct students to change their password after first login.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs font-semibold text-slate-600">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Registration No.</th>
                        <th className="px-4 py-3">Login Email</th>
                        <th className="px-4 py-3">Default Password</th>
                        <th className="px-4 py-3 print:hidden">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {successful.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {r.first_name} {r.last_name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{r.class_name}</td>
                          <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                            {r.registration_number}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                            {r.login_email}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-sm text-primary-700 font-semibold">
                            {r.default_password}
                          </td>
                          <td className="px-4 py-2.5 print:hidden">
                            <Badge variant="success" size="sm">
                              <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> Active
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Tip: Cut this sheet into individual login slips using the registration number as each student's identifier. Remind students their password is temporary.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              <Upload className="h-4 w-4 mr-1" /> Import More Students
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
