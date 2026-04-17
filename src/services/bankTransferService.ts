import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankTransferProof {
  id: string;
  school_id: string;
  student_id: string;
  student_fee_id: string;
  amount_usd: number;
  reference_number: string;
  proof_url: string | null;
  proof_filename: string | null;
  status: 'pending' | 'verified' | 'rejected';
  student_notes: string | null;
  bursar_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: {
    first_name: string;
    last_name: string;
    registration_number: string;
    current_grade_level: string;
  };
  student_fee?: {
    amount_due: number;
    amount_paid: number;
    balance: number;
    fee_structures: { fee_type: string } | null;
  };
}

// ── Reference generation ───────────────────────────────────────────────────────

/** Generate a unique bank transfer reference for a student fee */
export function generateBankRef(schoolId: string, regNumber: string): string {
  const schoolPart = schoolId.slice(-6).toUpperCase();
  const datePart   = Date.now().toString(36).toUpperCase().slice(-5);
  const regPart    = regNumber.replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase();
  return `BTR-${schoolPart}-${regPart}-${datePart}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const bankTransferService = {

  /** Upload proof image to Supabase Storage and return the public URL */
  async uploadProof(file: File, schoolId: string, reference: string): Promise<string> {
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${schoolId}/${reference}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('bank-transfer-proofs')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage
      .from('bank-transfer-proofs')
      .getPublicUrl(path);

    return data.publicUrl;
  },

  /** Submit a bank transfer proof — called by the student after uploading */
  async submitProof(opts: {
    schoolId: UUID;
    studentId: UUID;
    studentFeeId: UUID;
    amountUsd: number;
    referenceNumber: string;
    proofUrl: string | null;
    proofFilename: string | null;
    studentNotes?: string;
  }): Promise<BankTransferProof> {
    const { data, error } = await supabase
      .from('bank_transfer_proofs')
      .insert({
        school_id:        opts.schoolId,
        student_id:       opts.studentId,
        student_fee_id:   opts.studentFeeId,
        amount_usd:       opts.amountUsd,
        reference_number: opts.referenceNumber,
        proof_url:        opts.proofUrl,
        proof_filename:   opts.proofFilename,
        student_notes:    opts.studentNotes ?? null,
        status:           'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as BankTransferProof;
  },

  /** Get pending proof for a specific student fee (to check if already submitted) */
  async getProofForFee(studentFeeId: UUID): Promise<BankTransferProof | null> {
    const { data, error } = await supabase
      .from('bank_transfer_proofs')
      .select('*')
      .eq('student_fee_id', studentFeeId)
      .in('status', ['pending', 'verified'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as BankTransferProof | null;
  },

  /** List all pending proofs for a school (bursar view) */
  async listPendingForSchool(schoolId: UUID): Promise<BankTransferProof[]> {
    const { data, error } = await supabase
      .from('bank_transfer_proofs')
      .select(`
        *,
        student:students(first_name, last_name, registration_number, current_grade_level),
        student_fee:student_fees(amount_due, amount_paid, balance, fee_structures(fee_type))
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as BankTransferProof[];
  },

  /** Bursar verifies a proof — marks fee as paid via RPC */
  async verifyProof(opts: {
    proofId: UUID;
    schoolId: UUID;
    studentId: UUID;
    studentFeeId: UUID;
    amountUsd: number;
    bursarNotes?: string;
    verifiedBy: UUID;
  }): Promise<void> {
    // 1. Record the payment via the existing RPC
    const { error: payError } = await supabase.rpc('record_fee_payment', {
      p_school_id:        opts.schoolId,
      p_student_id:       opts.studentId,
      p_student_fee_id:   opts.studentFeeId,
      p_amount_usd:       opts.amountUsd,
      p_amount_lrd:       0,
      p_currency_charged: 'USD',
      p_payment_method:   'bank',
      p_gateway_ref:      `BTR-${opts.proofId.slice(-8)}`,
      p_recorded_by:      opts.verifiedBy,
    });

    if (payError) throw new Error(payError.message);

    // 2. Mark the proof as verified
    const { error: proofError } = await supabase
      .from('bank_transfer_proofs')
      .update({
        status:       'verified',
        bursar_notes: opts.bursarNotes ?? null,
        verified_by:  opts.verifiedBy,
        verified_at:  new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', opts.proofId);

    if (proofError) throw new Error(proofError.message);
  },

  /** Bursar rejects a proof */
  async rejectProof(opts: {
    proofId: UUID;
    verifiedBy: UUID;
    bursarNotes: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('bank_transfer_proofs')
      .update({
        status:       'rejected',
        bursar_notes: opts.bursarNotes,
        verified_by:  opts.verifiedBy,
        verified_at:  new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', opts.proofId);

    if (error) throw new Error(error.message);
  },
};
