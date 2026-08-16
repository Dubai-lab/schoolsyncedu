import type { IdCardDesignData } from '@/types/nfc.types';

/**
 * Renders a student's ID card using the school's own design.
 *
 * Why this exists: the student portal used to draw its own card from an
 * invented set of properties (bg_color, school_name, school_address) that the
 * designer never writes, and read them from design_data when the column is
 * design_json. Both lookups resolved to undefined, so every student saw the
 * hardcoded SchoolSync fallback — a completely different card from the one
 * their school designed and printed.
 *
 * This component is derived from MiniCardPreview in ITCardGenerator, which is
 * what actually gets printed, so the card on a student's phone matches the
 * plastic in their pocket.
 *
 * `scale` multiplies the 220x138 base. The generator's thumbnail is 1; the
 * student page uses roughly 1.6 so it reads at arm's length on a phone.
 */

/** Mirrors defaultDesign in ITCardDesigner — designs are stored as partials. */
export const DEFAULT_CARD_DESIGN: IdCardDesignData = {
  dimensions: { width: 86, height: 54 },
  fields: ['student_name', 'student_id', 'grade_level', 'photo', 'valid_until'],
  background_color: '#1e3a5f',
  text_color: '#ffffff',
  accent_color: '#f59e0b',
  header_color: '#0f2744',
  font_family: 'Inter, system-ui, sans-serif',
  card_title: 'Student Identification Card',
  show_school_name: true,
  show_school_logo: true,
  show_school_motto: true,
  show_barcode: true,
  show_qr_code: false,
  border_style: 'rounded',
  border_color: '#ffffff',
  photo_shape: 'rounded',
  orientation: 'landscape',
  back_bg_color: '#1e3a5f',
  back_text_color: '#ffffff',
  show_back_barcode: true,
  show_back_emergency_info: true,
  show_back_school_address: true,
};

export interface IdCardStudent {
  first_name?: string | null;
  last_name?: string | null;
  registration_number?: string | null;
  current_grade_level?: string | null;
  /**
   * The OFFICIAL school-issued ID photo (students.photo_url), written by staff
   * through ITCardGenerator.
   *
   * Deliberately NOT students.profile_photo_url, and there is deliberately no
   * fallback to it. A student uploading a portal picture must never change the
   * photo on their identity card — the school issues the card, so the school
   * controls the face on it. See migration 205.
   */
  photo_url?: string | null;
}

export interface IdCardSchool {
  name?: string | null;
  logo_url?: string | null;
  motto?: string | null;
  address?: string | null;
}

interface StudentIdCardProps {
  design?: IdCardDesignData | null;
  student: IdCardStudent | null;
  school: IdCardSchool | null;
  scale?: number;
  className?: string;
}

export function StudentIdCard({
  design, student, school, scale = 1, className,
}: StudentIdCardProps) {
  // Stored designs are partial — merge over defaults exactly as the designer
  // and generator do, otherwise a design saved before a field existed renders
  // with blank colours.
  const d: IdCardDesignData = { ...DEFAULT_CARD_DESIGN, ...(design ?? {}) };

  const bg = d.background_color || '#1e3a5f';
  const text = d.text_color || '#ffffff';
  const accent = d.accent_color || '#f59e0b';
  const header = d.header_color || '#0f2744';
  const logo = d.logo || school?.logo_url;

  const px = (n: number) => `${n * scale}px`;

  return (
    <div
      className={`relative overflow-hidden shadow-lg ${className ?? ''}`}
      style={{
        width: px(220),
        height: px(138),
        borderRadius: d.border_style === 'rounded' ? px(8) : px(4),
        fontFamily: d.font_family,
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: bg }} />

      {/* Header */}
      <div
        className="relative flex items-center"
        style={{ backgroundColor: header, gap: px(6), padding: `${px(4)} ${px(8)}` }}
      >
        {d.show_school_logo && logo && (
          <img src={logo} alt="" className="object-contain" style={{ width: px(32), height: px(32) }} />
        )}
        <div className="min-w-0 flex-1">
          {d.show_school_name && (
            <p className="truncate font-bold leading-tight" style={{ fontSize: px(7), color: text }}>
              {school?.name || 'School'}
            </p>
          )}
          {d.show_school_motto && school?.motto && (
            <p className="truncate leading-tight" style={{ fontSize: px(4.5), color: `${text}aa` }}>
              {school.motto}
            </p>
          )}
        </div>
      </div>

      {/* Title band */}
      <div
        className="relative text-center font-bold uppercase"
        style={{
          backgroundColor: accent,
          fontSize: px(5),
          color: header,
          padding: `${px(1)} 0`,
          letterSpacing: px(1),
        }}
      >
        {d.card_title || 'Student ID Card'}
      </div>

      {/* Body */}
      <div className="relative flex" style={{ gap: px(8), padding: px(8) }}>
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden bg-white/20"
          style={{
            width: px(32),
            height: px(40),
            border: `${px(1)} solid ${accent}40`,
            borderRadius:
              d.photo_shape === 'circle' ? '9999px' : d.photo_shape === 'square' ? '0' : px(4),
          }}
        >
          {student?.photo_url ? (
            <img src={student.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg
              viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5"
              style={{ width: px(16), height: px(16) }}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p style={{ fontSize: px(4), color: `${text}99` }}>Name</p>
          <p className="truncate font-bold" style={{ fontSize: px(7), color: text }}>
            {[student?.first_name, student?.last_name].filter(Boolean).join(' ') || '—'}
          </p>
          <p style={{ fontSize: px(4), color: `${text}99`, marginTop: px(2) }}>ID</p>
          <p className="font-mono font-semibold" style={{ fontSize: px(6), color: accent }}>
            {student?.registration_number || '—'}
          </p>
          {student?.current_grade_level && (
            <p className="font-semibold" style={{ fontSize: px(5), color: text, marginTop: px(2) }}>
              {student.current_grade_level}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Back of the card — school address and emergency note, per the design flags. */
export function StudentIdCardBack({
  design, school, scale = 1, className,
}: Omit<StudentIdCardProps, 'student'>) {
  const d: IdCardDesignData = { ...DEFAULT_CARD_DESIGN, ...(design ?? {}) };
  const bg = d.back_bg_color || '#1e3a5f';
  const text = d.back_text_color || '#ffffff';
  const px = (n: number) => `${n * scale}px`;

  return (
    <div
      className={`relative overflow-hidden shadow-lg ${className ?? ''}`}
      style={{
        width: px(220),
        height: px(138),
        borderRadius: d.border_style === 'rounded' ? px(8) : px(4),
        backgroundColor: bg,
        color: text,
        fontFamily: d.font_family,
        padding: px(10),
      }}
    >
      <p className="font-bold" style={{ fontSize: px(7) }}>{school?.name || 'School'}</p>

      {d.show_back_school_address && school?.address && (
        <p style={{ fontSize: px(5), color: `${text}bb`, marginTop: px(3) }}>{school.address}</p>
      )}

      {d.back_content && (
        <p style={{ fontSize: px(5), color: `${text}bb`, marginTop: px(6) }}>{d.back_content}</p>
      )}

      {d.show_back_emergency_info && (
        <p style={{ fontSize: px(4.5), color: `${text}99`, marginTop: px(6), lineHeight: 1.5 }}>
          If found, please return this card to the school address above.
        </p>
      )}
    </div>
  );
}
