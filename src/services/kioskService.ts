import { supabase } from '@/lib/supabase';

export interface KioskSchool {
  school_id: string;
  school_name: string;
  school_code: string;
  logo_url: string | null;
  address: string | null;
  academic_year: string;
}

export interface KioskClass {
  id: string;
  name: string;
  grade_level: string | null;
  section: string | null;
}

export interface ClearanceResult {
  student_id: string;
  student_name: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  class_name: string;
  card_number: string;
  wrong_class?: boolean;
  expected_class?: string;
  is_cleared: boolean;
  total_balance_usd: number;
  fee_details: FeeDetail[];
  semester: string;
}

export interface FeeDetail {
  fee_type: string;
  term: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
}

export interface ScanRecord {
  id: string;
  student_name: string;
  registration_number: string;
  class_name: string;
  is_cleared: boolean;
  total_balance_usd: number;
  scanned_at: string;
  fee_details: FeeDetail[];
}

export const kioskService = {
  /** Verify school code + PIN → returns school info */
  async verifyAccess(schoolCode: string, pin: string): Promise<KioskSchool> {
    const { data, error } = await supabase.rpc('verify_kiosk_access', {
      p_school_code: schoolCode.trim().toUpperCase(),
      p_pin:         pin.trim(),
    });
    if (error) throw new Error(error.message);
    return data as KioskSchool;
  },

  /** Get classes for a school */
  async getClasses(schoolId: string): Promise<KioskClass[]> {
    const { data, error } = await supabase.rpc('kiosk_get_classes', {
      p_school_id: schoolId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as KioskClass[];
  },

  /** Check student clearance by scanning their NFC chip */
  async checkClearance(
    schoolId: string,
    nfcChipId: string,
    semester: string,
    classId?: string,
  ): Promise<ClearanceResult> {
    const { data, error } = await supabase.rpc('kiosk_check_clearance', {
      p_school_id:   schoolId,
      p_nfc_chip_id: nfcChipId,
      p_semester:    semester,
      p_class_id:    classId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as ClearanceResult;
  },

  /** Find today's existing session for the same class+semester, or create a new one */
  async findOrCreateSession(
    schoolId: string,
    semester: string,
    classId: string,
    className: string,
    academicYear: string,
  ): Promise<{ session_id: string; is_new: boolean }> {
    const { data, error } = await supabase.rpc('kiosk_find_or_create_session', {
      p_school_id:    schoolId,
      p_semester:     semester,
      p_class_id:     classId,
      p_class_name:   className,
      p_academic_year: academicYear,
    });
    if (error) throw new Error(error.message);
    return data as { session_id: string; is_new: boolean };
  },

  /** Save a scan record */
  async saveScan(
    sessionId: string,
    schoolId: string,
    result: ClearanceResult,
  ): Promise<string> {
    const { data, error } = await supabase.rpc('kiosk_save_scan', {
      p_session_id:          sessionId,
      p_school_id:           schoolId,
      p_student_id:          result.student_id,
      p_student_name:        result.student_name,
      p_registration_number: result.registration_number,
      p_class_name:          result.class_name,
      p_is_cleared:          result.is_cleared,
      p_total_balance_usd:   result.total_balance_usd,
      p_fee_details:         result.fee_details,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  /** Get all records for a session */
  async getSessionRecords(sessionId: string): Promise<ScanRecord[]> {
    const { data, error } = await supabase.rpc('kiosk_get_session_records', {
      p_session_id: sessionId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as ScanRecord[];
  },

  /** Export records to CSV and trigger download */
  exportToCsv(records: ScanRecord[], sessionLabel: string) {
    const header = ['Student Name', 'Registration #', 'Class', 'Status', 'Balance (USD)', 'Scanned At'];
    const rows = records.map((r) => [
      r.student_name,
      r.registration_number,
      r.class_name,
      r.is_cleared ? 'CLEARED' : 'BALANCE OWED',
      r.total_balance_usd.toFixed(2),
      new Date(r.scanned_at).toLocaleString(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `clearance-${sessionLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
