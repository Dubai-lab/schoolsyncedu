import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { cardDesignService } from '@/services/nfcService';
import { itAdminSiteService } from '@/services/itAdminService';
import { uploadSchoolLogo } from '@/utils/storage.upload';
import type { IdCardDesignData } from '@/types/nfc.types';
import type { School } from '@/types/school.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  Plus, Trash2, Star, Pencil, CreditCard, Eye, Save,
  Upload, Loader2, Image, RotateCw, ArrowLeft,
  Layout, Palette, Type, Layers, AlignLeft,
} from 'lucide-react';

// ==================== CONSTANTS ====================

const FONT_OPTIONS = [
  { label: 'Inter (Modern)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", Helvetica, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, "Arial Rounded MT Bold", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'System Default', value: 'system-ui, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Courier (Mono)', value: '"Courier New", Consolas, monospace' },
];

const COLOR_PRESETS = [
  { name: 'Navy Blue', bg: '#1e3a5f', header: '#0f2744', accent: '#f59e0b', text: '#ffffff' },
  { name: 'Midnight', bg: '#0f172a', header: '#020617', accent: '#6366f1', text: '#f8fafc' },
  { name: 'Forest Green', bg: '#14532d', header: '#052e16', accent: '#fbbf24', text: '#ffffff' },
  { name: 'Crimson', bg: '#7f1d1d', header: '#450a0a', accent: '#fcd34d', text: '#ffffff' },
  { name: 'Royal Purple', bg: '#3b0764', header: '#1e0336', accent: '#e879f9', text: '#ffffff' },
  { name: 'Teal Modern', bg: '#134e4a', header: '#042f2e', accent: '#2dd4bf', text: '#ffffff' },
  { name: 'Steel Gray', bg: '#1f2937', header: '#111827', accent: '#60a5fa', text: '#ffffff' },
  { name: 'Clean White', bg: '#f8fafc', header: '#e2e8f0', accent: '#3b82f6', text: '#1e293b' },
  { name: 'Ocean Blue', bg: '#0c4a6e', header: '#082f49', accent: '#38bdf8', text: '#ffffff' },
  { name: 'Emerald', bg: '#064e3b', header: '#022c22', accent: '#34d399', text: '#ffffff' },
];

const CARD_FIELDS = [
  { key: 'photo', label: 'Student Photo' },
  { key: 'student_name', label: 'Student Name' },
  { key: 'student_id', label: 'Registration No.' },
  { key: 'grade_level', label: 'Grade Level' },
  { key: 'class', label: 'Class / Section' },
  { key: 'valid_until', label: 'Valid Until' },
  { key: 'barcode', label: 'Barcode' },
];

const defaultDesign: IdCardDesignData = {
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

type DesignRow = {
  id: string;
  name: string;
  design_json: IdCardDesignData;
  is_active: boolean;
  created_at: string;
};

// ==================== CARD PREVIEW FRONT ====================

function CardPreview({
  design, school, size = 'normal',
}: { design: IdCardDesignData; school: School | undefined; size?: 'normal' | 'large' }) {
  const bgColor = design.background_color || '#1e3a5f';
  const textColor = design.text_color || '#ffffff';
  const accentColor = design.accent_color || '#f59e0b';
  const headerColor = design.header_color || '#0f2744';
  const schoolName = school?.name || 'School Name';
  const schoolMotto = school?.motto || 'Excellence in Education';
  const logoUrl = design.logo || school?.logo_url;
  const isLarge = size === 'large';
  const scale = isLarge ? 1.7 : 1;
  const isPortrait = design.orientation === 'portrait';
  const w = isPortrait ? (design.dimensions?.height ?? 54) : (design.dimensions?.width ?? 86);
  const h = isPortrait ? (design.dimensions?.width ?? 86) : (design.dimensions?.height ?? 54);
  const cardTitle = design.card_title || 'Student Identification Card';
  const photoShape = design.photo_shape || 'rounded';
  const photoRadius = photoShape === 'circle' ? '50%' : photoShape === 'square' ? '2px' : '6px';

  let borderRadius = '6px';
  if (design.border_style === 'rounded') borderRadius = '12px';
  if (design.border_style === 'none') borderRadius = '0';

  let borderStyle = {};
  if (design.border_style === 'solid') {
    borderStyle = { border: `2px solid ${design.border_color || '#ffffff'}` };
  }

  return (
    <div
      className="relative overflow-hidden shadow-xl"
      style={{
        width: `${w * scale * 3.2}px`,
        height: `${h * scale * 3.2}px`,
        borderRadius,
        fontFamily: design.font_family || 'system-ui',
        ...borderStyle,
      }}
    >
      {/* Background */}
      {design.card_bg_image ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${design.card_bg_image})` }}>
          <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: 0.82 }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      )}

      {/* Header bar */}
      <div
        className="relative flex items-center gap-2"
        style={{
          backgroundColor: headerColor,
          padding: `${4 * scale}px ${8 * scale}px`,
        }}
      >
        {design.show_school_logo !== false && (
          <div
            className="shrink-0 rounded-full bg-white/20 flex items-center justify-center overflow-hidden"
            style={{ width: `${24 * scale}px`, height: `${24 * scale}px` }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: `${10 * scale}px`, color: textColor }}>🏫</span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {design.show_school_name !== false && (
            <p className="font-bold truncate leading-tight" style={{ fontSize: `${8 * scale}px`, color: textColor }}>
              {schoolName}
            </p>
          )}
          {design.show_school_motto !== false && (
            <p className="truncate leading-tight opacity-80" style={{ fontSize: `${5 * scale}px`, color: textColor }}>
              {schoolMotto}
            </p>
          )}
        </div>
      </div>

      {/* Label strip */}
      <div
        className="relative text-center font-bold uppercase tracking-wider"
        style={{
          backgroundColor: accentColor,
          fontSize: `${5.5 * scale}px`,
          color: headerColor,
          padding: `${1.5 * scale}px 0`,
          letterSpacing: `${1.2 * scale}px`,
        }}
      >
        {cardTitle}
      </div>

      {/* Body */}
      <div className="relative flex gap-2" style={{ padding: `${6 * scale}px ${8 * scale}px` }}>
        {(design.fields ?? []).includes('photo') && (
          <div
            className="shrink-0 bg-white/20 flex items-center justify-center"
            style={{
              width: `${28 * scale}px`,
              height: `${32 * scale}px`,
              borderRadius: photoRadius,
              border: `1px solid ${accentColor}60`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5"
              style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-0.5">
          {(design.fields ?? []).includes('student_name') && (
            <div>
              <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Name</p>
              <p className="font-bold truncate" style={{ fontSize: `${7 * scale}px`, color: textColor }}>John K. Doe</p>
            </div>
          )}
          {(design.fields ?? []).includes('student_id') && (
            <div>
              <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Student ID</p>
              <p className="font-mono font-semibold" style={{ fontSize: `${6 * scale}px`, color: accentColor }}>SLR-2026-0001</p>
            </div>
          )}
          <div className="flex gap-3">
            {(design.fields ?? []).includes('grade_level') && (
              <div>
                <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Grade</p>
                <p className="font-semibold" style={{ fontSize: `${6 * scale}px`, color: textColor }}>10A</p>
              </div>
            )}
            {(design.fields ?? []).includes('class') && (
              <div>
                <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Class</p>
                <p className="font-semibold" style={{ fontSize: `${6 * scale}px`, color: textColor }}>Science</p>
              </div>
            )}
            {(design.fields ?? []).includes('valid_until') && (
              <div>
                <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Valid</p>
                <p className="font-semibold" style={{ fontSize: `${6 * scale}px`, color: textColor }}>2026-08</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barcode / QR footer */}
      {design.show_barcode !== false && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5"
          style={{ backgroundColor: headerColor, padding: `${2 * scale}px 0` }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{
              width: `${(i % 3 === 0 ? 2 : 1) * scale}px`,
              height: `${8 * scale}px`,
              backgroundColor: i % 5 === 0 ? accentColor : `${textColor}60`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== CARD PREVIEW BACK ====================

function CardBackPreview({
  design, school, size = 'normal',
}: { design: IdCardDesignData; school: School | undefined; size?: 'normal' | 'large' }) {
  const backBg = design.back_bg_color || design.background_color || '#1e3a5f';
  const backText = design.back_text_color || design.text_color || '#ffffff';
  const accentColor = design.accent_color || '#f59e0b';
  const isLarge = size === 'large';
  const scale = isLarge ? 1.7 : 1;
  const isPortrait = design.orientation === 'portrait';
  const w = isPortrait ? (design.dimensions?.height ?? 54) : (design.dimensions?.width ?? 86);
  const h = isPortrait ? (design.dimensions?.width ?? 86) : (design.dimensions?.height ?? 54);

  let borderRadius = '6px';
  if (design.border_style === 'rounded') borderRadius = '12px';
  if (design.border_style === 'none') borderRadius = '0';

  return (
    <div
      className="relative overflow-hidden shadow-xl flex flex-col"
      style={{
        width: `${w * scale * 3.2}px`,
        height: `${h * scale * 3.2}px`,
        borderRadius,
        fontFamily: design.font_family || 'system-ui',
        backgroundColor: backBg,
      }}
    >
      <div
        className="text-center font-bold uppercase tracking-wider shrink-0"
        style={{ backgroundColor: accentColor, fontSize: `${5 * scale}px`, color: backBg, padding: `${2 * scale}px 0` }}
      >
        Important Information
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-between" style={{ padding: `${5 * scale}px ${8 * scale}px` }}>
        {design.show_back_emergency_info !== false && (
          <div>
            <p className="font-bold" style={{ fontSize: `${5 * scale}px`, color: accentColor }}>Emergency Contact</p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Name: ________________</p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Phone: _______________</p>
          </div>
        )}
        {design.show_back_school_address !== false && (
          <div>
            <p className="font-bold" style={{ fontSize: `${5 * scale}px`, color: accentColor }}>
              {school?.name || 'School Name'}
            </p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>{school?.address || '123 School Street, City'}</p>
            {school?.phone && <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Tel: {school.phone}</p>}
          </div>
        )}
        {design.back_content && (
          <p className="italic text-center" style={{ fontSize: `${4 * scale}px`, color: `${backText}99` }}>
            {design.back_content}
          </p>
        )}
        <p className="text-center italic" style={{ fontSize: `${3.5 * scale}px`, color: `${backText}66` }}>
          This card is the property of the school. If found, please return.
        </p>
      </div>
      {design.show_back_barcode !== false && (
        <div
          className="shrink-0 flex items-center justify-center gap-0.5"
          style={{ backgroundColor: `${backText}10`, padding: `${2 * scale}px 0` }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{
              width: `${(i % 3 === 0 ? 2 : 1) * scale}px`,
              height: `${8 * scale}px`,
              backgroundColor: i % 5 === 0 ? accentColor : `${backText}60`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== EDITOR TABS ====================

type EditorTab = 'layout' | 'colors' | 'branding' | 'fields' | 'back';

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'branding', label: 'Branding', icon: Type },
  { id: 'fields', label: 'Fields', icon: Layers },
  { id: 'back', label: 'Back Side', icon: AlignLeft },
];

// ==================== FULL-PAGE EDITOR ====================

function CardEditor({
  editId,
  name,
  setName,
  design,
  setDesign,
  school,
  onSave,
  onCancel,
  saving,
}: {
  editId: string | null;
  name: string;
  setName: (v: string) => void;
  design: IdCardDesignData;
  setDesign: React.Dispatch<React.SetStateAction<IdCardDesignData>>;
  school: School | undefined;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>('layout');
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const cardLogoInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [cardLogoUploading, setCardLogoUploading] = useState(false);
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const setD = (key: keyof IdCardDesignData, value: unknown) =>
    setDesign((prev) => ({ ...prev, [key]: value }));

  const toggleField = (field: string) => {
    const current = design.fields ?? [];
    setDesign((prev) => ({
      ...prev,
      fields: current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field],
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <CreditCard className="h-5 w-5 text-blue-600" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Design name (e.g. 2025-2026 Student ID)"
          className="flex-1 text-base font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 placeholder-slate-300"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" loading={saving} disabled={!name.trim()} onClick={onSave}>
            <Save className="h-4 w-4 mr-1.5" />
            {editId ? 'Save Changes' : 'Create Design'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Controls */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {EDITOR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* ── LAYOUT TAB ── */}
            {activeTab === 'layout' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Orientation</label>
                  <div className="flex gap-2">
                    {(['landscape', 'portrait'] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => setD('orientation', o)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          design.orientation === o
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {o === 'landscape' ? '⬛ Landscape' : '▮ Portrait'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Card Size (mm)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Width" type="number" value={String(design.dimensions?.width ?? 86)}
                      onChange={(e) => setD('dimensions', { ...design.dimensions, width: Number(e.target.value) })} />
                    <Input label="Height" type="number" value={String(design.dimensions?.height ?? 54)}
                      onChange={(e) => setD('dimensions', { ...design.dimensions, height: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Card Corners</label>
                  <div className="flex gap-2">
                    {(['none', 'solid', 'rounded'] as const).map((s) => (
                      <button key={s} onClick={() => setD('border_style', s)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          design.border_style === s
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {s === 'none' ? 'Square' : s === 'solid' ? 'Border' : 'Rounded'}
                      </button>
                    ))}
                  </div>
                  {design.border_style === 'solid' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input type="color" value={design.border_color || '#ffffff'}
                        onChange={(e) => setD('border_color', e.target.value)}
                        className="h-8 w-10 rounded border cursor-pointer" />
                      <span className="text-xs text-slate-500">Border color</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Card Label / Title</label>
                  <input
                    value={design.card_title || 'Student Identification Card'}
                    onChange={(e) => setD('card_title', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Student Identification Card"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Front Sections</label>
                  <div className="space-y-2">
                    {[
                      { key: 'show_school_name' as const, label: 'School Name' },
                      { key: 'show_school_logo' as const, label: 'School Logo' },
                      { key: 'show_school_motto' as const, label: 'School Motto' },
                      { key: 'show_barcode' as const, label: 'Barcode Strip' },
                      { key: 'show_qr_code' as const, label: 'QR Code' },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={design[opt.key] !== false}
                          onChange={(e) => setD(opt.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-slate-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── COLORS TAB ── */}
            {activeTab === 'colors' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Themes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => setDesign((prev) => ({
                          ...prev,
                          background_color: preset.bg,
                          header_color: preset.header,
                          accent_color: preset.accent,
                          text_color: preset.text,
                        }))}
                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      >
                        <div className="flex gap-0.5 shrink-0">
                          <div className="w-4 h-6 rounded-l" style={{ backgroundColor: preset.bg }} />
                          <div className="w-2 h-6 rounded-r" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {school && (
                  <button
                    onClick={() => setDesign((prev) => ({
                      ...prev,
                      background_color: school.primary_color || prev.background_color,
                      accent_color: school.secondary_color || prev.accent_color,
                      header_color: school.primary_color ? `${school.primary_color}dd` : prev.header_color,
                    }))}
                    className="w-full py-2 rounded-lg border border-dashed border-blue-300 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Use school colors ({school.primary_color}, {school.secondary_color})
                  </button>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Front Colors</label>
                  <div className="space-y-2">
                    {[
                      { label: 'Background', key: 'background_color' as const, default: '#1e3a5f' },
                      { label: 'Header Bar', key: 'header_color' as const, default: '#0f2744' },
                      { label: 'Accent Strip', key: 'accent_color' as const, default: '#f59e0b' },
                      { label: 'Text', key: 'text_color' as const, default: '#ffffff' },
                    ].map((c) => (
                      <div key={c.key} className="flex items-center gap-3">
                        <input type="color" value={(design[c.key] as string) ?? c.default}
                          onChange={(e) => setD(c.key, e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{c.label}</p>
                          <p className="text-xs text-slate-400">{(design[c.key] as string) ?? c.default}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── BRANDING TAB ── */}
            {activeTab === 'branding' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Font</label>
                  <select
                    value={design.font_family ?? 'Inter, system-ui, sans-serif'}
                    onChange={(e) => setD('font_family', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-400" style={{ fontFamily: design.font_family }}>
                    Preview: The quick brown fox — 0123456789
                  </p>
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">School Logo</label>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                      {(design.logo || school?.logo_url) ? (
                        <img src={design.logo || school?.logo_url || ''} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <input ref={cardLogoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !schoolId) return;
                          setCardLogoUploading(true);
                          try {
                            const url = await uploadSchoolLogo(schoolId, file);
                            setD('logo', url);
                            notify.success('Logo uploaded');
                          } catch (err) {
                            notify.error(err instanceof Error ? err.message : 'Upload failed');
                          } finally { setCardLogoUploading(false); e.target.value = ''; }
                        }}
                      />
                      <button type="button" onClick={() => cardLogoInputRef.current?.click()}
                        disabled={cardLogoUploading}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        {cardLogoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {cardLogoUploading ? 'Uploading...' : 'Upload Logo'}
                      </button>
                      <p className="mt-1 text-[10px] text-slate-400">PNG, JPG, WebP, SVG — max 2 MB</p>
                    </div>
                  </div>
                </div>

                {/* Background Image */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Background Image</label>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                      {design.card_bg_image ? (
                        <img src={design.card_bg_image} alt="BG" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <input ref={bgImageInputRef} type="file" accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !schoolId) return;
                          setBgImageUploading(true);
                          try {
                            const url = await uploadSchoolLogo(schoolId, file);
                            setD('card_bg_image', url);
                            notify.success('Background uploaded');
                          } catch (err) {
                            notify.error(err instanceof Error ? err.message : 'Upload failed');
                          } finally { setBgImageUploading(false); e.target.value = ''; }
                        }}
                      />
                      <button type="button" onClick={() => bgImageInputRef.current?.click()}
                        disabled={bgImageUploading}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        {bgImageUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {bgImageUploading ? 'Uploading...' : 'Upload Image'}
                      </button>
                      {design.card_bg_image && (
                        <button type="button" onClick={() => setD('card_bg_image', undefined)}
                          className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {design.card_bg_image && (
                    <p className="mt-1.5 text-[10px] text-slate-400">Background color is applied as overlay on the image.</p>
                  )}
                </div>
              </>
            )}

            {/* ── FIELDS TAB ── */}
            {activeTab === 'fields' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Card Data Fields</label>
                  <p className="text-xs text-slate-400 mb-3">Select which student information appears on the front of the card.</p>
                  <div className="space-y-2">
                    {CARD_FIELDS.map((field) => {
                      const active = (design.fields ?? []).includes(field.key);
                      return (
                        <label key={field.key}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            active ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input type="checkbox" checked={active} onChange={() => toggleField(field.key)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                            {field.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {(design.fields ?? []).includes('photo') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Photo Shape</label>
                    <div className="flex gap-2">
                      {(['square', 'rounded', 'circle'] as const).map((shape) => (
                        <button key={shape} onClick={() => setD('photo_shape', shape)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            design.photo_shape === shape
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {shape === 'square' ? '▪ Square' : shape === 'rounded' ? '▢ Rounded' : '● Circle'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── BACK SIDE TAB ── */}
            {activeTab === 'back' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Back Colors</label>
                  <div className="space-y-2">
                    {[
                      { label: 'Background', key: 'back_bg_color' as const, fallback: design.background_color || '#1e3a5f' },
                      { label: 'Text', key: 'back_text_color' as const, fallback: design.text_color || '#ffffff' },
                    ].map((c) => (
                      <div key={c.key} className="flex items-center gap-3">
                        <input type="color" value={(design[c.key] as string) ?? c.fallback}
                          onChange={(e) => setD(c.key, e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{c.label}</p>
                          <p className="text-xs text-slate-400">{(design[c.key] as string) ?? c.fallback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Back Sections</label>
                  <div className="space-y-2">
                    {[
                      { key: 'show_back_emergency_info' as const, label: 'Emergency Contact fields' },
                      { key: 'show_back_school_address' as const, label: 'School name & address' },
                      { key: 'show_back_barcode' as const, label: 'Barcode strip' },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={design[opt.key] !== false}
                          onChange={(e) => setD(opt.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-slate-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Custom Message</label>
                  <textarea
                    rows={3}
                    value={design.back_content ?? ''}
                    onChange={(e) => setD('back_content', e.target.value || undefined)}
                    placeholder="e.g. If found, please call the school at 0888-000-000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right panel — Live Preview */}
        <div className="flex-1 bg-slate-100 flex flex-col items-center justify-start overflow-y-auto p-8 gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Preview</span>
            <button
              onClick={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {previewSide === 'front' ? 'Flip to Back' : 'Flip to Front'}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {previewSide === 'front' ? 'Front' : 'Back'}
            </span>
            {previewSide === 'front' ? (
              <CardPreview design={design} school={school} size="large" />
            ) : (
              <CardBackPreview design={design} school={school} size="large" />
            )}
          </div>

          <p className="text-xs text-slate-400 text-center max-w-xs">
            {previewSide === 'front'
              ? 'Actual student data and photo will replace the sample text when cards are generated.'
              : 'The back of the card holds emergency contact fields and school information.'}
          </p>

          {/* Both sides mini preview */}
          <div className="flex gap-6 mt-4 opacity-70">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 uppercase">Front</span>
              <CardPreview design={design} school={school} size="normal" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 uppercase">Back</span>
              <CardBackPreview design={design} school={school} size="normal" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function ITCardDesigner() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: designs = [], isLoading } = useFetch(
    ['card-designs', schoolId],
    () => cardDesignService.list(schoolId),
    { enabled: !!schoolId },
  );

  const { data: school } = useFetch<School>(
    ['it-admin-school', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [design, setDesign] = useState<IdCardDesignData>({ ...defaultDesign });
  const [previewDesign, setPreviewDesign] = useState<DesignRow | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  const createDesign = useMutate(
    () => cardDesignService.create(schoolId, { name, design_json: design, created_by: user?.id ?? '' }),
    [['card-designs']],
    { onSuccess: () => { notify.success('Card design created'); closeEditor(); } },
  );

  const updateDesign = useMutate(
    () => cardDesignService.update(editId!, { name, design_json: design }),
    [['card-designs']],
    { onSuccess: () => { notify.success('Card design updated'); closeEditor(); } },
  );

  const deleteDesign = useMutate(
    (id: string) => cardDesignService.delete(id),
    [['card-designs']],
    { onSuccess: () => notify.success('Design deleted') },
  );

  const setActive = useMutate(
    (id: string) => cardDesignService.setActive(id, schoolId),
    [['card-designs']],
    { onSuccess: () => notify.success('Design set as active') },
  );

  function openCreate() {
    setEditId(null);
    setName('');
    setDesign({ ...defaultDesign });
    setShowEditor(true);
  }

  function openEdit(d: DesignRow) {
    setEditId(d.id);
    setName(d.name);
    setDesign({ ...defaultDesign, ...d.design_json });
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditId(null);
    setName('');
    setDesign({ ...defaultDesign });
  }

  function handleSave() {
    if (!name.trim()) { notify.error('Please enter a design name'); return; }
    if (editId) {
      updateDesign.mutate(undefined, {
        onSuccess: () => {
          // If this is already the active design or the only design, keep/make it active
          const currentDesigns = (designs ?? []) as DesignRow[];
          const thisDesign = currentDesigns.find((d) => d.id === editId);
          if (thisDesign?.is_active || currentDesigns.length === 1) {
            setActive.mutate(editId!);
          }
        },
      });
    } else {
      createDesign.mutate(undefined, {
        onSuccess: () => {
          // Auto-activate if this is the first and only design
          const currentDesigns = (designs ?? []) as DesignRow[];
          if (currentDesigns.length === 0) {
            // Refetch will happen via cache invalidation; the new design is auto-active
          }
        },
      });
    }
  }

  // Full-page editor takes over
  if (showEditor) {
    return (
      <CardEditor
        editId={editId}
        name={name}
        setName={setName}
        design={design}
        setDesign={setDesign}
        school={school}
        onSave={handleSave}
        onCancel={closeEditor}
        saving={createDesign.isPending || updateDesign.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Card Designer' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" /> ID Card Designer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and customize professional student ID card designs with full control over layout, colors, branding, and fields.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New Design
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (designs as unknown as DesignRow[]).length === 0 ? (
        <Card className="p-16 text-center">
          <CreditCard className="h-14 w-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600">No card designs yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Create your first ID card design using the full-featured card editor with live preview.
          </p>
          <Button className="mt-5" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Create First Design
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {(designs as unknown as DesignRow[]).map((d) => (
            <Card key={d.id} className="p-5 relative group">
              {d.is_active && (
                <Badge variant="success" size="sm" className="absolute top-3 right-3">
                  <Star className="h-3 w-3 mr-0.5" /> Active
                </Badge>
              )}
              <h3 className="font-semibold text-slate-800 mb-0.5">{d.name}</h3>
              <p className="text-xs text-slate-400 mb-4">
                {d.design_json.orientation === 'portrait' ? 'Portrait' : 'Landscape'} &bull;{' '}
                {d.design_json.dimensions?.width ?? 86} × {d.design_json.dimensions?.height ?? 54} mm &bull;{' '}
                {new Date(d.created_at).toLocaleDateString()}
              </p>

              <div className="flex justify-center mb-4">
                <CardPreview design={{ ...defaultDesign, ...d.design_json }} school={school} />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {!d.is_active ? (
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                    onClick={() => setActive.mutate(d.id)}
                    loading={setActive.isPending}
                  >
                    <Star className="h-3.5 w-3.5 mr-1" /> Use for Printing
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <Star className="h-3 w-3" /> Used for Printing
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setPreviewDesign(d); setPreviewSide('front'); }}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {!d.is_active && (
                  <Button size="sm" variant="ghost" onClick={() => deleteDesign.mutate(d.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Full Preview Dialog */}
      {previewDesign && (
        <Dialog open onClose={() => setPreviewDesign(null)} className="max-w-3xl">
          <DialogHeader><DialogTitle>Preview: {previewDesign.name}</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="flex justify-center gap-3 mb-5">
              {(['front', 'back'] as const).map((side) => (
                <button key={side} onClick={() => setPreviewSide(side)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    previewSide === side
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {side === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
            <div className="flex justify-center py-4 bg-slate-50 rounded-xl">
              {previewSide === 'front' ? (
                <CardPreview design={{ ...defaultDesign, ...previewDesign.design_json }} school={school} size="large" />
              ) : (
                <CardBackPreview design={{ ...defaultDesign, ...previewDesign.design_json }} school={school} size="large" />
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {(previewDesign.design_json.fields ?? []).map((f) => (
                <Badge key={f} variant="info" size="sm">{f.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDesign(null)}>Close</Button>
            <Button onClick={() => { openEdit(previewDesign); setPreviewDesign(null); }}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit Design
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
