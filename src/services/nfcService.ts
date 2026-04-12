import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  NfcCard,
  NfcCardStatus,
  IdCardDesign,
  IdCardDesignData,
  IdCardGeneration,
  NfcCardStatusView,
  NfcChipAssignment,
} from '@/types/nfc.types';

// ==================== ID CARD DESIGNS ====================

export const cardDesignService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('id_card_designs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as IdCardDesign[];
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('id_card_designs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as IdCardDesign;
  },

  async create(schoolId: UUID, design: { name: string; design_json: IdCardDesignData; created_by: UUID }) {
    const { data, error } = await supabase
      .from('id_card_designs')
      .insert({ school_id: schoolId, ...design })
      .select()
      .single();
    if (error) throw error;
    return data as IdCardDesign;
  },

  async update(id: UUID, updates: Partial<{ name: string; design_json: IdCardDesignData; is_active: boolean }>) {
    const { data, error } = await supabase
      .from('id_card_designs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as IdCardDesign;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('id_card_designs').delete().eq('id', id);
    if (error) throw error;
  },

  async setActive(id: UUID, schoolId: UUID) {
    // Deactivate all others first
    await supabase.from('id_card_designs').update({ is_active: false }).eq('school_id', schoolId);
    const { data, error } = await supabase
      .from('id_card_designs')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as IdCardDesign;
  },
};

// ==================== ID CARD GENERATION ====================

export const cardGenerationService = {
  async list(schoolId: UUID) {
    const { data, error } = await supabase
      .from('id_card_generation')
      .select('*, id_card_designs:design_id(id, name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as (IdCardGeneration & { id_card_designs: { id: string; name: string } | null })[];
  },

  async create(schoolId: UUID, batch: {
    design_id: UUID; batch_number: string;
    student_range: { start?: string; end?: string; filter?: Record<string, unknown> };
    total_cards: number; generated_by: UUID;
  }) {
    const { data, error } = await supabase
      .from('id_card_generation')
      .insert({ school_id: schoolId, ...batch })
      .select()
      .single();
    if (error) throw error;
    return data as IdCardGeneration;
  },

  async updateStatus(id: UUID, updates: Partial<{
    generated_cards: number; failed_cards: number; pdf_url: string; status: string;
  }>) {
    const { data, error } = await supabase
      .from('id_card_generation')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as IdCardGeneration;
  },
};

// ==================== NFC CARDS ====================

export const nfcCardService = {
  async list(schoolId: UUID, status?: NfcCardStatus) {
    let query = supabase
      .from('nfc_cards')
      .select('*, students:student_id(id, first_name, last_name, registration_number, photo_url, current_grade_level)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as (NfcCard & { students: Record<string, string> })[], count: count ?? 0 };
  },

  async create(card: { school_id: UUID; student_id: UUID; card_number: string; valid_until?: string }) {
    const { data, error } = await supabase
      .from('nfc_cards')
      .insert(card)
      .select()
      .single();
    if (error) throw error;
    return data as NfcCard;
  },

  async updateStatus(id: UUID, status: NfcCardStatus) {
    const { data, error } = await supabase
      .from('nfc_cards')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as NfcCard;
  },

  async getCardStatusView(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_nfc_card_status')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as NfcCardStatusView[];
  },

  async encodeNfc(cardId: UUID, nfcChipId: string, chipData: Record<string, unknown>, encodedBy: UUID) {
    const { data, error } = await supabase
      .from('nfc_cards')
      .update({
        nfc_chip_id: nfcChipId,
        nfc_chip_data: chipData,
        status: 'encoded',
        encoded_by: encodedBy,
        encoded_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select()
      .single();
    if (error) throw error;
    return data as NfcCard;
  },

  async assignCard(payload: {
    card_id: UUID;
    assigned_to_student: UUID;
    assigned_by: UUID;
    assignment_method: 'external_reader' | 'pwa_scan' | 'manual';
  }) {
    const { data, error } = await supabase
      .from('nfc_chip_assignments')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    // Also update card assigned_at and status
    await supabase
      .from('nfc_cards')
      .update({ assigned_at: new Date().toISOString(), status: 'active' })
      .eq('id', payload.card_id);
    return data as NfcChipAssignment;
  },

  async getAssignments(schoolId: UUID) {
    // Filter by school via the nfc_cards join using PostgREST embedded filter syntax
    const { data, error } = await supabase
      .from('nfc_chip_assignments')
      .select(`
        *,
        nfc_cards:card_id!inner(id, card_number, status, nfc_chip_id, valid_until, student_id,
          students:student_id(id, first_name, last_name, registration_number, current_grade_level, photo_url)
        )
      `)
      .eq('nfc_cards.school_id', schoolId)
      .not('nfc_cards', 'is', null)
      .order('assignment_date', { ascending: false });
    if (error) throw error;
    // Client-side safety filter in case the embedded filter doesn't propagate
    return (data ?? []).filter((row: Record<string, unknown>) => {
      const card = row.nfc_cards as Record<string, unknown> | null;
      return card !== null;
    });
  },

  async getStudentsWithoutCards(schoolId: UUID) {
    // Get students who don't have an active NFC card
    const { data: cardsData } = await supabase
      .from('nfc_cards')
      .select('student_id')
      .eq('school_id', schoolId)
      .in('status', ['designed', 'printed', 'encoded', 'active']);
    const assignedStudentIds = (cardsData ?? []).map((c) => c.student_id);

    let query = supabase
      .from('students')
      .select('id, first_name, last_name, registration_number, current_grade_level, photo_url')
      .eq('school_id', schoolId)
      .eq('status', 'enrolled')
      .order('last_name');
    if (assignedStudentIds.length > 0) {
      query = query.not('id', 'in', `(${assignedStudentIds.join(',')})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
};