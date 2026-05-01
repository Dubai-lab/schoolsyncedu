import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { cardDesignService, cardGenerationService, nfcCardService } from '@/services/nfcService';
import { itAdminSiteService } from '@/services/itAdminService';
import type { IdCardDesignData } from '@/types/nfc.types';
import type { School } from '@/types/school.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import {
  Printer,
  Download,
  FileStack,
  CreditCard,
  Users,
  Search,
  CheckCircle2,
  Camera,
  Eye,
} from 'lucide-react';

// ==================== TYPES ====================

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  current_grade_level: string;
  photo_url: string | null;
  status: string;
};

type CardRow = {
  id: string;
  card_number: string;
  status: string;
  student_id: string;
  valid_until: string | null;
  nfc_chip_id: string | null;
  created_at: string;
  students: { id: string; first_name: string; last_name: string; registration_number: string; current_grade_level: string; photo_url: string | null };
};

type BatchRow = {
  id: string;
  batch_number: string;
  total_cards: number;
  generated_cards: number;
  failed_cards: number;
  pdf_url: string | null;
  status: string;
  created_at: string;
  id_card_designs: { id: string; name: string } | null;
};

// ==================== SINGLE CARD PREVIEW ====================

function MiniCardPreview({ student, design, school, overridePhotoUrl }: {
  student: StudentRow;
  design: IdCardDesignData;
  school: School | undefined;
  overridePhotoUrl?: string | null;
}) {
  const photoSrc = overridePhotoUrl || student.photo_url;
  const bg = design.background_color || '#1e3a5f';
  const text = design.text_color || '#ffffff';
  const accent = design.accent_color || '#f59e0b';
  const header = design.header_color || '#0f2744';

  return (
    <div
      className="relative overflow-hidden shadow-md"
      style={{
        width: '220px',
        height: '138px',
        borderRadius: design.border_style === 'rounded' ? '8px' : '4px',
        fontSize: '10px',
      }}
    >
      {/* Background */}
      <div className="absolute inset-0" style={{ backgroundColor: bg }} />

      {/* Header */}
      <div className="relative flex items-center gap-1.5 px-2 py-1" style={{ backgroundColor: header }}>
        {school?.logo_url && (
          <img src={school.logo_url} alt="" className="w-8 h-8 object-contain" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate leading-tight" style={{ fontSize: '7px', color: text }}>
            {school?.name || 'School'}
          </p>
        </div>
      </div>

      {/* Label */}
      <div className="relative text-center font-bold uppercase" style={{
        backgroundColor: accent,
        fontSize: '5px',
        color: header,
        padding: '1px 0',
        letterSpacing: '1px',
      }}>
        Student ID Card
      </div>

      {/* Body */}
      <div className="relative flex gap-2 p-2">
        {/* Photo */}
        <div className="shrink-0 w-8 h-10 bg-white/20 rounded flex items-center justify-center overflow-hidden"
          style={{ border: `1px solid ${accent}40` }}>
          {photoSrc ? (
            <img src={photoSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" className="w-4 h-4">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: '4px', color: `${text}99` }}>Name</p>
          <p className="font-bold truncate" style={{ fontSize: '7px', color: text }}>
            {student.first_name} {student.last_name}
          </p>
          <p style={{ fontSize: '4px', color: `${text}99` }}>ID</p>
          <p className="font-mono font-semibold" style={{ fontSize: '6px', color: accent }}>
            {student.registration_number}
          </p>
          <p className="font-semibold" style={{ fontSize: '5px', color: text }}>
            {student.current_grade_level}
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== CARD PRINT HELPER ====================

type PrintDesign = {
  id?: string;
  is_active?: boolean;
  design_json: IdCardDesignData;
};

function buildCardHtml(
  cards: CardRow[],
  design: PrintDesign | undefined,
  schoolName: string,
  schoolLogo: string | null | undefined,
  schoolMotto: string | null | undefined,
  schoolAddress?: string | null,
  schoolPhone?: string | null,
  emergencyContacts?: Record<string, { name: string; phone: string }>,
): string {
  const dj = design?.design_json;
  const bg       = dj?.background_color || '#1e3a5f';
  const text     = dj?.text_color       || '#ffffff';
  const accent   = dj?.accent_color     || '#f59e0b';
  const header   = dj?.header_color     || '#0f2744';
  // back falls back to front colors if not separately configured
  const backBg   = dj?.back_bg_color   && dj.back_bg_color !== '' ? dj.back_bg_color : (dj?.background_color || '#1e3a5f');
  const backText = dj?.back_text_color && dj.back_text_color !== '' ? dj.back_text_color : (dj?.text_color || '#ffffff');
  const font     = dj?.font_family      || 'Arial, sans-serif';
  const radius   = dj?.border_style === 'rounded' ? '8px' : dj?.border_style === 'none' ? '0' : '4px';
  const bgImage  = dj?.card_bg_image;
  const showLogo = dj?.show_school_logo !== false;
  const showName = dj?.show_school_name !== false;
  const showMotto = dj?.show_school_motto !== false;
  const showBarcode = dj?.show_barcode !== false;
  const showBackBarcode = dj?.show_back_barcode !== false;
  const showEmergency = dj?.show_back_emergency_info !== false;
  const showAddress = dj?.show_back_school_address !== false;
  const backContent = dj?.back_content || '';
  const cardTitle = dj?.card_title || 'Student Identification Card';
  const fields   = dj?.fields ?? ['photo', 'student_name', 'student_id', 'grade_level'];

  const CARD_W = '85.6mm';
  const CARD_H = '53.98mm';

  const barcodeHtml = (color: string) =>
    `<div style="display:flex;gap:0.5px;">${Array.from({ length: 24 }, (_, i) =>
      `<div style="width:${i % 3 === 0 ? 2 : 1}px;height:5mm;background:${color}${i % 2 === 0 ? 'cc' : '55'};"></div>`
    ).join('')}</div>`;

  const cardPairs = cards.map((card) => {
    const s = card.students;

    // ── FRONT ─────────────────────────────────────────────────
    const backgroundHtml = bgImage
      ? `<div style="position:absolute;inset:0;background-image:url('${bgImage}');background-size:cover;background-position:center;">
           <div style="position:absolute;inset:0;background:${bg};opacity:0.85;"></div>
         </div>`
      : `<div style="position:absolute;inset:0;background:${bg};"></div>`;

    const logoHtml = showLogo && schoolLogo
      ? `<img src="${schoolLogo}" style="width:13mm;height:13mm;object-fit:contain;flex-shrink:0;" />`
      : showLogo
        ? `<div style="width:13mm;height:13mm;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:6pt;">&#x1F3EB;</div>`
        : '';
    const nameHtml = showName
      ? `<div style="font-weight:bold;font-size:7pt;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:${text};">${schoolName}</div>`
      : '';
    const mottoHtml = showMotto && schoolMotto
      ? `<div style="font-size:5pt;opacity:0.8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:${text};">${schoolMotto}</div>`
      : '';

    const photoHtml = fields.includes('photo')
      ? `<div style="width:18mm;height:22mm;background:rgba(255,255,255,0.15);border-radius:2px;border:1px solid ${accent}40;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          ${s?.photo_url
            ? `<img src="${s.photo_url}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.5" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
         </div>`
      : '';

    const nameFieldHtml = fields.includes('student_name')
      ? `<div style="font-size:4.5pt;color:${text}99;">Name</div>
         <div style="font-weight:bold;font-size:9pt;color:${text};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-bottom:1.5mm;">${s?.first_name || ''} ${s?.last_name || ''}</div>`
      : '';
    const idFieldHtml = fields.includes('student_id')
      ? `<div style="font-size:4.5pt;color:${text}99;">Student ID</div>
         <div style="font-size:7pt;font-weight:bold;font-family:monospace;color:${accent};margin-bottom:1mm;">${s?.registration_number || card.card_number}</div>`
      : '';
    const gradeFieldHtml = fields.includes('grade_level')
      ? `<div style="font-size:7pt;color:${text};">${s?.current_grade_level || ''}</div>`
      : '';
    const validHtml = card.valid_until
      ? `<div style="font-size:5pt;color:${text}88;margin-top:1mm;">Valid: ${new Date(card.valid_until).toLocaleDateString()}</div>`
      : '';

    const frontHtml = `
      <div style="position:relative;width:${CARD_W};height:${CARD_H};border-radius:${radius};
        overflow:hidden;display:inline-block;font-family:${font};
        box-shadow:0 2px 8px rgba(0,0,0,0.3);vertical-align:top;">
        ${backgroundHtml}
        <div style="position:relative;background:${header};padding:2.5mm 3mm;display:flex;align-items:center;gap:2mm;">
          ${logoHtml}
          <div style="flex:1;min-width:0;">${nameHtml}${mottoHtml}</div>
        </div>
        <div style="position:relative;background:${accent};text-align:center;font-size:5pt;font-weight:bold;
          text-transform:uppercase;letter-spacing:1.5px;color:${header};padding:1mm 0;">
          ${cardTitle}
        </div>
        <div style="position:relative;display:flex;gap:3mm;padding:2.5mm 3mm;">
          ${photoHtml}
          <div style="flex:1;min-width:0;">${nameFieldHtml}${idFieldHtml}${gradeFieldHtml}${validHtml}</div>
        </div>
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.25);padding:1mm 3mm;
          display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:5.5pt;font-family:monospace;color:${text}88;">${card.card_number}</span>
          ${showBarcode ? barcodeHtml(text) : ''}
        </div>
      </div>`;

    // ── BACK ──────────────────────────────────────────────────
    const ec = emergencyContacts?.[card.id];
    const ecName  = ec?.name  || '';
    const ecPhone = ec?.phone || '';

    const emergencyHtml = showEmergency
      ? `<div style="margin-bottom:2.5mm;">
           <div style="font-weight:bold;font-size:5.5pt;color:${accent};margin-bottom:1.5mm;">Emergency Contact</div>
           <div style="display:flex;align-items:baseline;gap:1mm;border-bottom:0.3mm solid ${backText}30;padding-bottom:1mm;margin-bottom:1mm;">
             <span style="font-size:4.5pt;color:${backText}99;white-space:nowrap;">Name:</span>
             <span style="font-size:5.5pt;font-weight:${ecName ? '600' : '400'};color:${ecName ? backText : backText + '55'};flex:1;">
               ${ecName || '________________________'}
             </span>
           </div>
           <div style="display:flex;align-items:baseline;gap:1mm;border-bottom:0.3mm solid ${backText}30;padding-bottom:1mm;">
             <span style="font-size:4.5pt;color:${backText}99;white-space:nowrap;">Phone:</span>
             <span style="font-size:5.5pt;font-weight:${ecPhone ? '600' : '400'};color:${ecPhone ? backText : backText + '55'};flex:1;">
               ${ecPhone || '_______________________'}
             </span>
           </div>
         </div>`
      : '';
    const addressHtml = showAddress
      ? `<div style="margin-bottom:2mm;">
           <div style="font-weight:bold;font-size:5.5pt;color:${accent};">${schoolName}</div>
           ${schoolAddress ? `<div style="font-size:4.5pt;color:${backText}bb;">${schoolAddress}</div>` : ''}
           ${schoolPhone ? `<div style="font-size:4.5pt;color:${backText}bb;">Tel: ${schoolPhone}</div>` : ''}
         </div>`
      : '';
    const backCustomHtml = backContent
      ? `<div style="font-size:4.5pt;font-style:italic;color:${backText}99;text-align:center;">${backContent}</div>`
      : '';

    // Use an absolute background div (same as front) so print-color-adjust applies correctly
    const backHtml = `
      <div style="position:relative;width:${CARD_W};height:${CARD_H};border-radius:${radius};
        overflow:hidden;display:inline-block;font-family:${font};
        box-shadow:0 2px 8px rgba(0,0,0,0.3);vertical-align:top;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <!-- Background layer -->
        <div style="position:absolute;inset:0;background-color:${backBg};
          -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
        <!-- Back header strip -->
        <div style="position:relative;background-color:${accent};text-align:center;font-size:5pt;font-weight:bold;
          text-transform:uppercase;letter-spacing:1px;color:${backBg};padding:1.5mm 0;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;">
          Important Information
        </div>
        <!-- Back body -->
        <div style="position:relative;padding:2.5mm 3mm;display:flex;flex-direction:column;
          height:calc(100% - 7mm - 7mm);box-sizing:border-box;">
          ${emergencyHtml}
          ${addressHtml}
          ${backCustomHtml}
          <div style="margin-top:auto;font-size:3pt;color:${backText}55;text-align:center;">
            This card is the property of the school. If found, please return.
          </div>
        </div>
        <!-- Back barcode footer -->
        ${showBackBarcode
          ? `<div style="position:absolute;bottom:0;left:0;right:0;
               background-color:${backText}15;padding:1mm 3mm;
               display:flex;justify-content:center;align-items:center;gap:3mm;
               -webkit-print-color-adjust:exact;print-color-adjust:exact;">
               ${barcodeHtml(backText)}
             </div>`
          : ''}
      </div>`;

    // Front + Back side by side — break-inside:avoid keeps the pair on the same page
    return `<div style="display:inline-flex;gap:4mm;margin:4mm;break-inside:avoid;">
      ${frontHtml}
      ${backHtml}
    </div>`;
  });

  return `<!DOCTYPE html><html><head><title>Print ID Cards</title>
    <style>
      /* Force browsers to print background colors */
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: A4 landscape; margin: 8mm; }
      body { margin: 0; background: #f0f0f0; font-family: Arial, sans-serif; }
      @media print {
        body { background: #f0f0f0; }
        .no-print { display: none !important; }
      }
    </style>
  </head><body>
    <div class="no-print" style="padding:10px;background:#1e3a5f;color:white;font-family:Arial;
      display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:9;">
      <span style="font-size:14px;font-weight:bold;">ID Cards — ${cards.length} card${cards.length !== 1 ? 's' : ''}</span>
      <button onclick="window.print()" style="background:#f59e0b;color:#000;border:none;padding:6px 16px;
        border-radius:4px;font-weight:bold;cursor:pointer;font-size:13px;">
        🖨️ Print Now
      </button>
      <span style="font-size:12px;opacity:0.8;">Front + Back pairs · Credit card size (85.6mm × 54mm)</span>
    </div>
    <div style="padding:6mm;">${cardPairs.join('')}</div>
  </body></html>`;
}

// ==================== MAIN COMPONENT ====================

export default function ITCardGenerator() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  // Tab state
  const [tab, setTab] = useState<'students' | 'batches' | 'cards'>('students');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: school } = useFetch<School>(
    ['it-admin-school', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const { data: designs = [] } = useFetch(
    ['card-designs', schoolId],
    () => cardDesignService.list(schoolId),
    { enabled: !!schoolId },
  );

  const activeDesign = (designs as { design_json: IdCardDesignData; is_active: boolean }[]).find((d) => d.is_active);

  // Students without cards
  const { data: unassignedStudents = [], isLoading: studentsLoading } = useFetch(
    ['students-no-cards', schoolId],
    () => nfcCardService.getStudentsWithoutCards(schoolId),
    { enabled: !!schoolId },
  );

  // All cards
  const { data: cardsData } = useFetch(
    ['nfc-cards', schoolId],
    () => nfcCardService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Batches
  const { data: batches = [] } = useFetch(
    ['card-generations', schoolId],
    () => cardGenerationService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Print: open browser print window with card layouts
  // designId: use a specific design; falls back to active design, then first available
  function openPrintWindow(
    cardsToPrint: CardRow[],
    designId?: string | null,
    emergencyContacts?: Record<string, { name: string; phone: string }>,
  ) {
    if (cardsToPrint.length === 0) return;
    const allDesigns = designs as (PrintDesign & { id: string; is_active: boolean })[];

    const design = designId
      ? (allDesigns.find((d) => d.id === designId) ?? allDesigns.find((d) => d.is_active) ?? allDesigns[0])
      : (allDesigns.find((d) => d.is_active) ?? allDesigns[0]);

    // Inject locally-uploaded photos that may not yet be in the DB cache
    const cardsWithPhotos = cardsToPrint.map((c) => ({
      ...c,
      students: c.students
        ? { ...c.students, photo_url: uploadedPhotos[c.student_id] || c.students.photo_url }
        : c.students,
    }));

    const html = buildCardHtml(
      cardsWithPhotos,
      design,
      school?.name ?? 'School',
      school?.logo_url,
      school?.motto,
      school?.address,
      school?.phone,
      emergencyContacts,
    );
    const w = window.open('', '_blank', 'width=1100,height=780');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  function toggleCard(id: string) {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Photo upload state: studentId -> temp local URL
  const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const handlePhotoUpload = async (studentId: string, file: File) => {
    // Create a local object URL for preview immediately
    const previewUrl = URL.createObjectURL(file);
    setUploadedPhotos((prev) => ({ ...prev, [studentId]: previewUrl }));

    // Upload to Supabase storage
    try {
      const { supabase } = await import('@/lib/supabase');
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `students/${schoolId}/${studentId}_photo.${ext}`;
      const { error } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        // Update the student record
        await supabase.from('students').update({ photo_url: urlData.publicUrl }).eq('id', studentId);
        setUploadedPhotos((prev) => ({ ...prev, [studentId]: urlData.publicUrl }));
        notify.success('Photo uploaded');
      }
    } catch {
      notify.error('Failed to upload photo');
    }
    setUploadingFor(null);
  };

  // Auto-generate a batch number
  function generateBatchNumber(): string {
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000); // 4-digit
    return `BATCH-${year}-${seq}`;
  }

  // Edit photo & reprint dialog
  const [editCard, setEditCard] = useState<CardRow | null>(null);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const [editEmergency, setEditEmergency] = useState({ name: '', phone: '' });

  const handleEditPhotoUpload = async (file: File) => {
    if (!editCard) return;
    setEditPhotoUploading(true);
    const previewUrl = URL.createObjectURL(file);
    // Optimistic update in both local stores
    setUploadedPhotos((prev) => ({ ...prev, [editCard.student_id]: previewUrl }));
    setEditCard((prev) => prev ? { ...prev, students: prev.students ? { ...prev.students, photo_url: previewUrl } : prev.students } : prev);
    try {
      const { supabase } = await import('@/lib/supabase');
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `students/${schoolId}/${editCard.student_id}_photo.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type, upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        await supabase.from('students').update({ photo_url: urlData.publicUrl }).eq('id', editCard.student_id);
        setUploadedPhotos((prev) => ({ ...prev, [editCard.student_id]: urlData.publicUrl }));
        setEditCard((prev) => prev ? { ...prev, students: prev.students ? { ...prev.students, photo_url: urlData.publicUrl } : prev.students } : prev);
        notify.success('Photo saved');
      } else {
        notify.error('Upload failed');
      }
    } catch {
      notify.error('Failed to upload photo');
    }
    setEditPhotoUploading(false);
  };

  // Generate dialog
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ design_id: '', valid_months: '12' });

  const openGenerateDialog = () => {
    // Auto-select active design or first available design
    const defaultDesignId = activeDesign
      ? (activeDesign as unknown as { id: string }).id
      : (designs as unknown as { id: string }[])[0]?.id ?? '';
    setGenForm({ design_id: defaultDesignId, valid_months: '12' });
    setShowGenerate(true);
  };

  const generateCards = useMutate(
    async () => {
      const selectedArray = Array.from(selectedStudents);
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + Number(genForm.valid_months || 12));

      // Create individual NFC cards for each selected student
      const results = await Promise.allSettled(
        selectedArray.map(async (studentId) => {
          const student = (filteredStudents as StudentRow[]).find((s) => s.id === studentId);
          const cardNumber = `NFC-${new Date().getFullYear()}-${student?.registration_number || studentId.slice(0, 6)}`;
          return nfcCardService.create({
            school_id: schoolId,
            student_id: studentId,
            card_number: cardNumber,
            valid_until: validUntil.toISOString().split('T')[0],
          });
        }),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Create a batch record and mark progress
      if (genForm.design_id) {
        const batch = await cardGenerationService.create(schoolId, {
          design_id: genForm.design_id,
          batch_number: generateBatchNumber(),
          student_range: { filter: { student_ids: selectedArray } },
          total_cards: selectedArray.length,
          generated_by: user?.id ?? '',
        });
        // Update progress immediately so it doesn't stay "in_progress / 0"
        await cardGenerationService.updateStatus(batch.id, {
          generated_cards: succeeded,
          failed_cards: failed,
          status: failed === selectedArray.length ? 'failed' : 'completed',
        });
      }

      return { succeeded, failed };
    },
    [['nfc-cards'], ['card-generations'], ['students-no-cards']],
    {
      onSuccess: (data) => {
        const { succeeded, failed } = data as { succeeded: number; failed: number };
        notify.success(`${succeeded} cards generated${failed > 0 ? `, ${failed} failed` : ''}`);
        setSelectedStudents(new Set());
        setShowGenerate(false);
        setGenForm({ design_id: '', valid_months: '12' });
      },
    },
  );

  // Filter students
  const filteredStudents = (unassignedStudents as StudentRow[]).filter((s) => {
    const matchesSearch = !search ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      s.registration_number.toLowerCase().includes(search.toLowerCase());
    const matchesGrade = !gradeFilter || s.current_grade_level === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  // Grade options
  const gradeOptions = [
    { label: 'All Grades', value: '' },
    ...Array.from(new Set((unassignedStudents as StudentRow[]).map((s) => s.current_grade_level)))
      .filter(Boolean)
      .sort()
      .map((g) => ({ label: g, value: g })),
  ];

  const designOptions = (designs as { id: string; name: string }[]).map((d) => ({ label: d.name, value: d.id }));

  // Toggle selection
  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  // Cards table columns
  const cards = (cardsData?.data ?? []) as unknown as CardRow[];
  const cardColumns: Column<CardRow>[] = [
    {
      key: 'select', header: '',
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedCards.has(r.id)}
          onChange={() => toggleCard(r.id)}
          className="h-4 w-4 accent-blue-600"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'card_number', header: 'Card #',
      render: (r) => <span className="font-mono text-sm font-medium">{r.card_number}</span>,
    },
    {
      key: 'student', header: 'Student',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden">
            {r.students?.photo_url
              ? <img src={r.students.photo_url} alt="" className="w-full h-full object-cover" />
              : `${r.students?.first_name?.[0] ?? ''}${r.students?.last_name?.[0] ?? ''}`}
          </div>
          <div>
            <p className="text-sm font-medium">{r.students?.first_name} {r.students?.last_name}</p>
            <p className="text-xs text-slate-400 font-mono">{r.students?.registration_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const color = r.status === 'active' ? 'success' : r.status === 'encoded' ? 'warning' : r.status === 'printed' ? 'info' : 'default';
        return <Badge variant={color} size="sm">{r.status}</Badge>;
      },
    },
    {
      key: 'nfc', header: 'NFC',
      render: (r) => r.nfc_chip_id
        ? <Badge variant="success" size="sm">Encoded</Badge>
        : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'valid', header: 'Valid Until',
      render: (r) => r.valid_until
        ? <span className="text-sm text-slate-500">{new Date(r.valid_until).toLocaleDateString()}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'print', header: '',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setEditCard(r); setEditEmergency({ name: '', phone: '' }); }}>
            <Camera className="h-3.5 w-3.5 mr-1" /> Edit & Print
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openPrintWindow([r])}>
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Batch table columns
  const batchList = (batches ?? []) as unknown as BatchRow[];
  const batchColumns: Column<BatchRow>[] = [
    {
      key: 'batch', header: 'Batch',
      render: (r) => <span className="font-mono text-sm font-medium">{r.batch_number}</span>,
    },
    {
      key: 'design', header: 'Design',
      render: (r) => <span className="text-sm">{r.id_card_designs?.name ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const v = r.status === 'completed' ? 'success' : r.status === 'in_progress' ? 'warning' : 'danger';
        return <Badge variant={v} size="sm">{r.status.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      key: 'progress', header: 'Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-2 w-20">
            <div className="bg-blue-500 rounded-full h-2"
              style={{ width: `${r.total_cards > 0 ? (r.generated_cards / r.total_cards) * 100 : 0}%` }} />
          </div>
          <span className="text-xs text-slate-500">{r.generated_cards}/{r.total_cards}</span>
        </div>
      ),
    },
    {
      key: 'date', header: 'Date',
      render: (r) => <span className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => {
        const batchCards = cards.filter((c) => {
          // Match cards created around the same time as this batch (within 1 minute)
          const batchTime = new Date(r.created_at).getTime();
          const cardTime = new Date(c.created_at).getTime();
          return Math.abs(cardTime - batchTime) < 120_000;
        });
        return (
          <div className="flex items-center gap-2">
            {r.pdf_url && (
              <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => openPrintWindow(batchCards.length > 0 ? batchCards : cards, r.id_card_designs?.id)}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Generate Cards' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <FileStack className="inline-block h-6 w-6 mr-2 text-blue-600" />
            Card Generation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select students and generate professional ID cards for printing.
          </p>
        </div>
        {tab === 'students' && selectedStudents.size > 0 && (
          <Button onClick={openGenerateDialog}>
            <Printer className="h-4 w-4 mr-1.5" />
            Generate {selectedStudents.size} Card{selectedStudents.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Active design indicator */}
      {activeDesign ? (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            Active card design: <strong>{(activeDesign as unknown as { name: string }).name}</strong> — cards will be printed with this design.
          </p>
          <a href="/it-admin/cards" className="ml-auto text-xs font-medium text-blue-600 hover:underline shrink-0">
            Change Design →
          </a>
        </div>
      ) : designs.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <Eye className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            No active design set — printing will use <strong>{(designs as unknown as { name: string }[])[0]?.name}</strong> (first available).
            <a href="/it-admin/cards" className="ml-2 font-semibold underline">Set an active design →</a>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <Eye className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            No card design found. <a href="/it-admin/cards" className="font-semibold underline">Create a design first →</a>
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{(unassignedStudents as StudentRow[]).length}</p>
          <p className="text-xs text-slate-500">Need Cards</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{cards.filter((c) => c.status === 'active').length}</p>
          <p className="text-xs text-slate-500">Active Cards</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{cards.filter((c) => ['designed', 'printed', 'encoded'].includes(c.status)).length}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{cards.length}</p>
          <p className="text-xs text-slate-500">Total Cards</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {([
          { key: 'students', label: 'Students Without Cards', icon: Users },
          { key: 'cards', label: 'All Cards', icon: CreditCard },
          { key: 'batches', label: 'Generation Batches', icon: FileStack },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Students Tab */}
      {tab === 'students' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <Select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              options={gradeOptions}
            />
            <Button variant="outline" onClick={selectAll}>
              {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {studentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-600">All students have cards!</h3>
              <p className="text-sm text-slate-400 mt-1">Every enrolled student already has an ID card assigned.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredStudents.map((student) => {
                const selected = selectedStudents.has(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`text-left rounded-xl border-2 p-3 transition-all ${
                      selected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                      }`}>
                        {selected && (
                          <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                      {/* Photo with upload button */}
                      <div className="relative group shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold overflow-hidden">
                          {uploadedPhotos[student.id] || student.photo_url ? (
                            <img src={uploadedPhotos[student.id] || student.photo_url!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            `${student.first_name[0]}${student.last_name[0]}`
                          )}
                        </div>
                        {/* Upload overlay */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadingFor(student.id); photoInputRef.current?.click(); }}
                          className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Upload photo"
                        >
                          <Camera className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{student.registration_number}</p>
                        <p className="text-xs text-slate-400">{student.current_grade_level}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cards Tab */}
      {tab === 'cards' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCards(selectedCards.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)))}
              className="text-xs text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
            >
              {selectedCards.size === cards.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedCards.size > 0 && (
              <Button size="sm" onClick={() => openPrintWindow(cards.filter((c) => selectedCards.has(c.id)))}>
                <Printer className="h-4 w-4 mr-1.5" />
                Print {selectedCards.size} Card{selectedCards.size > 1 ? 's' : ''}
              </Button>
            )}
            {selectedCards.size === 0 && cards.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => openPrintWindow(cards)}>
                <Eye className="h-4 w-4 mr-1.5" />
                Print All ({cards.length})
              </Button>
            )}
          </div>
          <Table
            columns={cardColumns}
            data={cards}
            isLoading={!cardsData}
            emptyMessage="No ID cards have been generated yet."
          />
        </div>
      )}

      {/* Hidden photo file input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingFor) {
            handlePhotoUpload(uploadingFor, file);
          }
          e.target.value = '';
        }}
      />

      {/* Batches Tab */}
      {tab === 'batches' && (
        <Table
          columns={batchColumns}
          data={batchList}
          isLoading={!batches}
          emptyMessage="No generation batches yet."
        />
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onClose={() => setShowGenerate(false)}>
        <DialogHeader>
          <DialogTitle>Generate {selectedStudents.size} ID Card{selectedStudents.size > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <Select
              label="Card Design *"
              options={designOptions}
              value={genForm.design_id}
              onChange={(e) => setGenForm((f) => ({ ...f, design_id: e.target.value }))}
            />
            <Input
              label="Card Validity (months)"
              type="number"
              value={genForm.valid_months}
              onChange={(e) => setGenForm((f) => ({ ...f, valid_months: e.target.value }))}
            />
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm font-medium text-slate-700 mb-1">Selected Students ({selectedStudents.size})</p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {Array.from(selectedStudents).map((id) => {
                  const s = (unassignedStudents as StudentRow[]).find((st) => st.id === id);
                  return s ? (
                    <Badge key={id} variant="info" size="sm">
                      {s.first_name} {s.last_name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>

            {/* Preview — uses the design selected in the dropdown */}
            {genForm.design_id && (
              <div>
                {(() => {
                  const selectedDesign = (designs as (PrintDesign & { id: string; name: string })[]).find((d) => d.id === genForm.design_id);
                  if (!selectedDesign) return null;
                  const previewStudentId = Array.from(selectedStudents)[0];
                  const previewStudent = (unassignedStudents as StudentRow[]).find((s) => s.id === previewStudentId)
                    || (unassignedStudents as StudentRow[])[0]
                    || { id: '', first_name: 'Sample', last_name: 'Student', registration_number: 'SLR-2026-0001', current_grade_level: 'Grade 10', photo_url: null, status: 'enrolled' };
                  return (
                    <>
                      <p className="text-sm font-medium text-slate-700 mb-2">Card Preview — {selectedDesign.name}</p>
                      <div className="flex justify-center">
                        <MiniCardPreview
                          student={previewStudent}
                          design={selectedDesign.design_json}
                          school={school}
                          overridePhotoUrl={uploadedPhotos[previewStudent.id]}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowGenerate(false)}>Cancel</Button>
          <Button
            onClick={() => generateCards.mutate(undefined)}
            loading={generateCards.isPending}
            disabled={!genForm.design_id}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Generate Cards
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Photo & Reprint Dialog */}
      {editCard && (
        <Dialog open onClose={() => setEditCard(null)} className="max-w-lg">
          <DialogHeader onClose={() => setEditCard(null)}>
            <DialogTitle>Edit & Reprint</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">

              {/* Top row: photo + student info + card preview side by side */}
              <div className="flex gap-3">
                {/* Photo upload */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className="w-16 h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => editPhotoRef.current?.click()}
                    title="Click to upload photo"
                  >
                    {editCard.students?.photo_url ? (
                      <img src={editCard.students.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="text-[11px] px-2 py-1 h-auto"
                    onClick={() => editPhotoRef.current?.click()} loading={editPhotoUploading}>
                    {editPhotoUploading ? '…' : editCard.students?.photo_url ? 'Replace' : 'Upload'}
                  </Button>
                  <input ref={editPhotoRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditPhotoUpload(f); }} />
                </div>

                {/* Student info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {editCard.students?.first_name} {editCard.students?.last_name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{editCard.students?.registration_number}</p>
                  <p className="text-xs text-slate-400">{editCard.students?.current_grade_level}</p>
                </div>

                {/* Card preview */}
                {activeDesign && (
                  <div className="shrink-0">
                    <MiniCardPreview
                      student={{
                        id: editCard.student_id,
                        first_name: editCard.students?.first_name ?? '',
                        last_name: editCard.students?.last_name ?? '',
                        registration_number: editCard.students?.registration_number ?? editCard.card_number,
                        current_grade_level: editCard.students?.current_grade_level ?? '',
                        photo_url: editCard.students?.photo_url ?? null,
                        status: 'active',
                      }}
                      design={(activeDesign as unknown as { design_json: IdCardDesignData }).design_json}
                      school={school}
                      overridePhotoUrl={uploadedPhotos[editCard.student_id] || editCard.students?.photo_url}
                    />
                  </div>
                )}
              </div>

              {/* Emergency contact */}
              <div className="rounded-lg border border-slate-200 px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Emergency Contact <span className="normal-case font-normal text-slate-400">· back of card</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-10 shrink-0">Name</span>
                  <input type="text" placeholder="Parent / Guardian name"
                    value={editEmergency.name}
                    onChange={(e) => setEditEmergency((p) => ({ ...p, name: e.target.value }))}
                    className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-10 shrink-0">Phone</span>
                  <input type="tel" placeholder="+231 000 000 0000"
                    value={editEmergency.phone}
                    onChange={(e) => setEditEmergency((p) => ({ ...p, phone: e.target.value }))}
                    className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
              </div>

            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCard(null)}>Close</Button>
            <Button
              onClick={() => {
                const ec = (editEmergency.name || editEmergency.phone)
                  ? { [editCard.id]: editEmergency }
                  : undefined;
                openPrintWindow([editCard], undefined, ec);
                setEditCard(null);
              }}
              disabled={editPhotoUploading}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Print Card
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
