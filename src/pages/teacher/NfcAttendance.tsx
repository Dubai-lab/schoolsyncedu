import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { attendanceService } from '@/services/attendanceService';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import type { AttendanceEntry } from '@/types/attendance.types';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Nfc,
  CheckCircle,
  XCircle,
  Users,
  Loader2,
  Wifi,
  WifiOff,
  Save,
  Keyboard,
} from 'lucide-react';

type ScannedStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  registration: string;
  tappedAt: string;
};

export default function NfcAttendance() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().split('T')[0]);
  const [scanning, setScanning] = useState(false);
  const [scannedStudents, setScannedStudents] = useState<ScannedStudent[]>(new Set() as unknown as ScannedStudent[]);
  const [manualInput, setManualInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only teacher's classes (school-scoped)
  const { data: myClasses } = useFetch(
    ['teacher-classes', schoolId, teacherId],
    () => teacherService.getMyClasses(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const { data: students } = useFetch(
    ['class-students', selectedClass],
    () => attendanceService.getClassStudents(selectedClass),
    { enabled: !!selectedClass },
  );

  // Fetch subjects the teacher teaches in the selected class
  const { data: mySubjects } = useFetch(
    ['teacher-subjects', schoolId, teacherId],
    () => teacherService.getMySubjects(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const classOptions = (myClasses ?? []).map((c) => ({
    label: `${c.name} — ${c.grade_level || ''}${c.section ? ` (${c.section})` : ''}`,
    value: c.id,
  }));

  const subjectOptions = (mySubjects ?? [])
    .filter((s) => s.class_id === selectedClass)
    .map((s) => ({ label: s.subject_name, value: s.subject_id }));

  // Reset scanned list when class or subject changes
  useEffect(() => {
    setScannedStudents([]);
    setSaved(false);
  }, [selectedClass, selectedSubject]);

  // Web NFC API listener (supported on Android Chrome)
  useEffect(() => {
    if (!scanning) return;

    let abortController: AbortController | null = null;

    async function startNfcReader() {
      try {
        if (!('NDEFReader' in window)) {
          notify.error('NFC not supported on this device. Use manual card entry below.');
          setScanning(false);
          return;
        }

        const NDEFReaderClass = (window as unknown as Record<string, unknown>).NDEFReader as new () => {
          scan: (opts: { signal: AbortSignal }) => Promise<void>;
          addEventListener: (event: string, handler: (e: unknown) => void) => void;
        };
        const ndef = new NDEFReaderClass();
        abortController = new AbortController();

        await ndef.scan({ signal: abortController.signal });

        ndef.addEventListener('reading', (event: unknown) => {
          const e = event as { serialNumber?: string; message?: { records?: { data?: ArrayBuffer }[] } };
          // Normalize to match the format used during encoding: no colons, uppercase
          const chipId = (e.serialNumber ?? '').replace(/:/g, '').toUpperCase();
          if (chipId) {
            handleNfcTap(chipId);
          }
        });
      } catch (err) {
        console.error('NFC scan error:', err);
        notify.error('Failed to start NFC reader. Try manual entry.');
        setScanning(false);
      }
    }

    startNfcReader();

    return () => {
      abortController?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  // Lookup student by NFC chip ID
  const handleNfcTap = useCallback(async (nfcChipId: string) => {
    try {
      const { data: card, error } = await supabase
        .from('nfc_cards')
        .select('id, student_id, students:student_id(id, first_name, last_name, registration_number)')
        .eq('school_id', schoolId)
        .eq('nfc_chip_id', nfcChipId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !card) {
        notify.error('Card not recognized. Make sure the card is registered and active.');
        return;
      }

      const student = (card as Record<string, unknown>).students as {
        id: string; first_name: string; last_name: string; registration_number: string;
      };

      addScannedStudent(student.id, student.first_name, student.last_name, student.registration_number);

      // Log the NFC tap
      await supabase.from('nfc_attendance_logs').insert({
        card_id: (card as Record<string, unknown>).id as string,
        student_id: student.id,
        tapped_at: new Date().toISOString(),
        reader_type: 'web_nfc',
        scan_type: 'attendance',
        status: 'verified',
      });
    } catch (err) {
      console.error('NFC tap processing failed:', err);
    }
  }, [schoolId]);

  // Manual card number / registration number lookup
  const handleManualLookup = async () => {
    if (!manualInput.trim()) return;
    setLookupLoading(true);
    try {
      // Try NFC card number first
      const { data: byCard } = await supabase
        .from('nfc_cards')
        .select('student_id, students:student_id(id, first_name, last_name, registration_number)')
        .eq('school_id', schoolId)
        .eq('card_number', manualInput.trim().toUpperCase())
        .eq('status', 'active')
        .maybeSingle();

      if (byCard) {
        const student = (byCard as Record<string, unknown>).students as {
          id: string; first_name: string; last_name: string; registration_number: string;
        };
        addScannedStudent(student.id, student.first_name, student.last_name, student.registration_number);
        setManualInput('');
        inputRef.current?.focus();
        return;
      }

      // Try registration number
      const { data: byReg } = await supabase
        .from('students')
        .select('id, first_name, last_name, registration_number')
        .eq('school_id', schoolId)
        .eq('registration_number', manualInput.trim().toUpperCase())
        .maybeSingle();

      if (byReg) {
        addScannedStudent(byReg.id, byReg.first_name, byReg.last_name, byReg.registration_number);
        setManualInput('');
        inputRef.current?.focus();
        return;
      }

      notify.error('No student found with that card or registration number.');
    } catch {
      notify.error('Lookup failed. Try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const addScannedStudent = (id: string, firstName: string, lastName: string, registration: string) => {
    setScannedStudents((prev) => {
      if (prev.some((s) => s.studentId === id)) {
        notify.info(`${firstName} ${lastName} already scanned.`);
        return prev;
      }
      notify.success(`✓ ${firstName} ${lastName}`);
      return [...prev, {
        studentId: id,
        firstName,
        lastName,
        registration,
        tappedAt: new Date().toLocaleTimeString(),
      }];
    });
  };

  const removeScanned = (studentId: string) => {
    setScannedStudents((prev) => prev.filter((s) => s.studentId !== studentId));
  };

  // Save: scanned = present, rest = absent
  const handleSave = async () => {
    if (!selectedClass || !selectedSubject || !students) return;
    const scannedIds = new Set(scannedStudents.map((s) => s.studentId));
    const entries: AttendanceEntry[] = students.map((s) => ({
      studentId: s.id,
      status: scannedIds.has(s.id) ? 'present' : 'absent',
    }));

    try {
      await attendanceService.markAttendance(selectedClass, selectedDate, entries, teacherId, selectedSubject);
      notify.success(`Attendance saved: ${scannedStudents.length} present, ${students.length - scannedStudents.length} absent`);
      setSaved(true);
    } catch {
      notify.error('Failed to save attendance');
    }
  };

  const totalStudents = students?.length ?? 0;
  const presentCount = scannedStudents.length;
  const absentCount = totalStudents - presentCount;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Teacher Portal', href: '/teacher' },
        { label: 'NFC Attendance' },
      ]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">NFC Attendance</h1>
        <p className="text-sm text-slate-500">
          Tap student NFC cards or enter card/registration numbers to mark attendance.
        </p>
      </div>

      {/* Class, Subject & Date */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          label="My Class"
          options={classOptions}
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
          placeholder="Select your class"
          className="sm:w-64"
        />
        <Select
          label="My Subject"
          options={subjectOptions}
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          placeholder={selectedClass ? 'Select subject' : 'Select class first'}
          className="sm:w-52"
          disabled={!selectedClass || subjectOptions.length === 0}
        />
        <Input
          label="Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="sm:w-44"
        />
      </div>

      {!selectedClass || !selectedSubject ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Nfc className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">
              {!selectedClass ? 'Select a class to begin NFC attendance.' : 'Select the subject you are teaching.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* NFC / Manual Controls */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* NFC Scanner */}
            <Card className={scanning ? 'border-emerald-300 bg-emerald-50/30' : ''}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  {scanning ? (
                    <Wifi className="h-6 w-6 text-emerald-600 animate-pulse" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-slate-400" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">
                      {scanning ? 'NFC Scanner Active' : 'NFC Scanner'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {scanning ? 'Waiting for card taps...' : 'Start scanning to accept NFC cards'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={scanning ? 'danger' : 'primary'}
                  size="sm"
                  className="w-full"
                  onClick={() => setScanning(!scanning)}
                >
                  {scanning ? 'Stop Scanning' : 'Start NFC Scanner'}
                </Button>
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Keyboard className="h-6 w-6 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-800">Manual Entry</p>
                    <p className="text-xs text-slate-500">Type card number or student ID</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Card # or Reg #"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup(); }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleManualLookup}
                    disabled={lookupLoading || !manualInput.trim()}
                  >
                    {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Total</p>
              <p className="text-lg font-bold text-slate-700">{totalStudents}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Present</p>
              <p className="text-lg font-bold text-emerald-700">{presentCount}</p>
            </div>
            <div className="rounded-lg bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Absent</p>
              <p className="text-lg font-bold text-red-700">{absentCount}</p>
            </div>
          </div>

          {/* Scanned Students */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Scanned Students ({presentCount})</CardTitle>
              <Button
                size="sm"
                icon={<Save className="h-4 w-4" />}
                onClick={handleSave}
                disabled={saved || presentCount === 0}
              >
                {saved ? 'Saved ✓' : 'Save Attendance'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {scannedStudents.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Users className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No students scanned yet. Tap a card or enter manually.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {scannedStudents.map((student) => (
                    <div
                      key={student.studentId}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{student.registration}</p>
                      </div>
                      <span className="text-xs text-slate-400">{student.tappedAt}</span>
                      <button
                        onClick={() => removeScanned(student.studentId)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Remove"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
