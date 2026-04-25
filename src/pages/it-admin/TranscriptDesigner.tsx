import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { itAdminSiteService } from '@/services/itAdminService';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Save, Eye, Palette } from 'lucide-react';
import type { TranscriptConfig } from '@/types/school.types';

const DEFAULTS: TranscriptConfig = {
  header_bg_color:   '#b91c1c',
  header_text_color: '#ffffff',
  table_header_bg:   '#f1f5f9',
  row_alt_bg:        '#f8fafc',
  header_layout:     'centered',
  show_logo:         false,
  seal_url:          '',
  show_outer_border: true,
  school_system_name: '',
  transcript_title:  'OFFICIAL TRANSCRIPT',
  show_contact_info: true,
  principal_name:    '',
  registrar_name:    '',
  show_motto_footer: true,
};

// ── Field components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2 mb-3">
      {children}
    </h2>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <label className="text-sm text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-mono w-16 text-right">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
        />
      </div>
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, hint }: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
      />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 leading-tight">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

function LayoutOption({ value, current, label, description, onClick }: {
  value: string; current: string; label: string; description: string; onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </button>
  );
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function Preview({ cfg, schoolName, logoUrl, motto }: {
  cfg: TranscriptConfig;
  schoolName: string;
  logoUrl: string | null;
  motto: string | null;
}) {
  const logoEl = cfg.show_logo && logoUrl ? (
    <img src={logoUrl} alt="logo" className="h-12 w-12 object-contain flex-shrink-0" />
  ) : cfg.show_logo ? (
    <div className="h-12 w-12 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-bold opacity-60 flex-shrink-0">LOGO</div>
  ) : null;

  const sealEl = cfg.seal_url ? (
    <img src={cfg.seal_url} alt="seal" className="h-12 w-12 object-contain flex-shrink-0" />
  ) : cfg.header_layout === 'logo-both' ? (
    <div className="h-12 w-12 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-bold opacity-60 flex-shrink-0">SEAL</div>
  ) : null;

  const centerInfo = (
    <div className="text-center flex-1 min-w-0">
      {cfg.school_system_name && (
        <p className="text-[8px] uppercase tracking-widest opacity-80 leading-tight">{cfg.school_system_name}</p>
      )}
      <p className="text-[11px] font-bold uppercase tracking-wide leading-tight">{schoolName}</p>
      {cfg.show_contact_info && (
        <p className="text-[8px] opacity-70 mt-0.5">Monrovia, Liberia · info@school.com</p>
      )}
    </div>
  );

  return (
    <div
      className="font-serif text-[10px] rounded overflow-hidden shadow-md"
      style={{ border: cfg.show_outer_border ? '2px solid #334155' : 'none' }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5"
        style={{ backgroundColor: cfg.header_bg_color, color: cfg.header_text_color }}
      >
        {cfg.header_layout === 'centered' && (
          <div className="text-center">
            {logoEl && <div className="flex justify-center mb-1">{logoEl}</div>}
            {centerInfo}
          </div>
        )}
        {cfg.header_layout === 'logo-left' && (
          <div className="flex items-center gap-3">
            {logoEl}
            {centerInfo}
          </div>
        )}
        {cfg.header_layout === 'logo-both' && (
          <div className="flex items-center gap-3">
            {logoEl ?? <div className="w-12 flex-shrink-0" />}
            {centerInfo}
            {sealEl ?? <div className="w-12 flex-shrink-0" />}
          </div>
        )}
      </div>

      {/* Office strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1 flex justify-between items-center">
        <p className="italic text-slate-500 text-[9px]">Office of the Registrar</p>
      </div>

      {/* Title */}
      <div className="text-center bg-white py-1.5 border-b border-slate-200">
        <p className="font-bold uppercase tracking-wider text-[10px] text-slate-800">
          {cfg.transcript_title || 'OFFICIAL TRANSCRIPT'}
        </p>
      </div>

      {/* Grade table sample */}
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr style={{ backgroundColor: cfg.table_header_bg }}>
            <th className="border border-slate-300 px-2 py-1 text-left font-bold text-slate-800 w-24">SUBJECTS</th>
            <th className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-800">GRADE 9</th>
            <th className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-800">GRADE 10</th>
          </tr>
        </thead>
        <tbody>
          {['Mathematics', 'English', 'Science'].map((s, i) => (
            <tr key={s} style={{ backgroundColor: i % 2 === 0 ? '#fff' : cfg.row_alt_bg }}>
              <td className="border border-slate-200 px-2 py-0.5 text-slate-700">{s}</td>
              <td className="border border-slate-200 px-2 py-0.5 text-center">85</td>
              <td className="border border-slate-200 px-2 py-0.5 text-center">90</td>
            </tr>
          ))}
          <tr className="font-semibold" style={{ backgroundColor: cfg.table_header_bg }}>
            <td className="border border-slate-300 px-2 py-0.5 text-slate-800">Total Score</td>
            <td className="border border-slate-300 px-2 py-0.5 text-center">255</td>
            <td className="border border-slate-300 px-2 py-0.5 text-center">270</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 px-6 pt-2 pb-2 bg-white border-t border-slate-200">
        <div className="text-center">
          <div className="border-b border-slate-600 mb-1 h-4" />
          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600">
            {cfg.registrar_name || 'Registrar'}
          </p>
        </div>
        <div className="text-center">
          <div className="border-b border-slate-600 mb-1 h-4" />
          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600">
            {cfg.principal_name || 'Principal'}
          </p>
        </div>
      </div>

      {/* Motto footer */}
      {cfg.show_motto_footer && motto && (
        <div className="text-center py-1 bg-slate-50 border-t border-slate-200">
          <p className="text-[8px] italic text-slate-500">MOTTO: {motto}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TranscriptDesigner() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, refetch } = useFetch(
    ['school-info', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const [cfg, setCfg] = useState<TranscriptConfig>(DEFAULTS);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!school) return;
    const saved = school.site_config?.transcript_config;
    setCfg({
      ...DEFAULTS,
      principal_name: school.principal_name ?? '',
      ...saved,
    });
  }, [school]);

  const set = <K extends keyof TranscriptConfig>(key: K, value: TranscriptConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutate(
    () =>
      itAdminSiteService.updateSchool(schoolId, {
        site_config: { ...(school?.site_config ?? {}), transcript_config: cfg },
      }),
    [['school-info', schoolId]],
    { onSuccess: () => { notify.success('Transcript design saved'); refetch(); } },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Transcript Designer' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" /> Transcript Designer
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Design your school's official transcript — every setting is unique to your school.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-4 w-4 mr-1.5" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button onClick={() => saveMutation.mutate(undefined)} loading={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> Save Design
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* ── Editor ── */}
        <div className="space-y-4">

          {/* Header Layout */}
          <Card className="p-5">
            <SectionTitle>Header Layout</SectionTitle>
            <div className="space-y-2">
              <LayoutOption
                value="centered"
                current={cfg.header_layout}
                label="Centered"
                description="School name and info centered. Logo (if on) appears above text."
                onClick={() => set('header_layout', 'centered')}
              />
              <LayoutOption
                value="logo-left"
                current={cfg.header_layout}
                label="Logo Left + Text"
                description="Logo on the left, school name and info in the center."
                onClick={() => set('header_layout', 'logo-left')}
              />
              <LayoutOption
                value="logo-both"
                current={cfg.header_layout}
                label="Logo Left + Text + Seal Right"
                description="Logo on the left, school info centered, seal/emblem on the right."
                onClick={() => set('header_layout', 'logo-both')}
              />
            </div>
          </Card>

          {/* Logo & Seal */}
          <Card className="p-5 space-y-4">
            <SectionTitle>Logo &amp; Seal</SectionTitle>
            <Toggle
              label="Show school logo"
              hint="Uses the logo you uploaded in School Settings."
              checked={cfg.show_logo}
              onChange={(v) => set('show_logo', v)}
            />
            {cfg.header_layout === 'logo-both' && (
              <TextField
                label="Right-side seal / emblem URL"
                placeholder="https://example.com/seal.png"
                value={cfg.seal_url}
                onChange={(v) => set('seal_url', v)}
                hint="Paste a direct image URL for your school seal or emblem."
              />
            )}
          </Card>

          {/* Header Text */}
          <Card className="p-5 space-y-4">
            <SectionTitle>Header Text</SectionTitle>
            <TextField
              label="School system / denomination name"
              placeholder="e.g. SEVENTH-DAY ADVENTIST SCHOOL SYSTEM"
              value={cfg.school_system_name}
              onChange={(v) => set('school_system_name', v)}
              hint="Optional. Appears above your school name in the header."
            />
            <TextField
              label="Transcript title"
              placeholder="e.g. OFFICIAL TRANSCRIPT FOR SENIOR HIGH"
              value={cfg.transcript_title}
              onChange={(v) => set('transcript_title', v)}
              hint="The bold heading that appears below the header bar."
            />
            <Toggle
              label="Show contact info in header"
              hint="Shows address, phone, and email below the school name."
              checked={cfg.show_contact_info}
              onChange={(v) => set('show_contact_info', v)}
            />
          </Card>

          {/* Colours */}
          <Card className="p-5">
            <SectionTitle>Colours</SectionTitle>
            <div className="divide-y divide-slate-50">
              <ColorField label="Header background" value={cfg.header_bg_color} onChange={(v) => set('header_bg_color', v)} />
              <ColorField label="Header text" value={cfg.header_text_color} onChange={(v) => set('header_text_color', v)} />
              <ColorField label="Table header background" value={cfg.table_header_bg} onChange={(v) => set('table_header_bg', v)} />
              <ColorField label="Alternating row background" value={cfg.row_alt_bg} onChange={(v) => set('row_alt_bg', v)} />
            </div>
          </Card>

          {/* Document Options */}
          <Card className="p-5 space-y-4">
            <SectionTitle>Document Options</SectionTitle>
            <Toggle
              label="Outer border around document"
              hint="Adds a solid border frame around the entire transcript."
              checked={cfg.show_outer_border}
              onChange={(v) => set('show_outer_border', v)}
            />
            <Toggle
              label="Show school motto in footer"
              checked={cfg.show_motto_footer}
              onChange={(v) => set('show_motto_footer', v)}
            />
          </Card>

          {/* Signatories */}
          <Card className="p-5 space-y-4">
            <SectionTitle>Signatory Names</SectionTitle>
            <p className="text-xs text-slate-400 -mt-2">Names appear below the signature lines at the bottom.</p>
            <TextField
              label="Principal name"
              placeholder="e.g. Dr. John Smith"
              value={cfg.principal_name}
              onChange={(v) => set('principal_name', v)}
            />
            <TextField
              label="Registrar name"
              placeholder="e.g. Mary Johnson"
              value={cfg.registrar_name}
              onChange={(v) => set('registrar_name', v)}
            />
          </Card>
        </div>

        {/* ── Live Preview ── */}
        {showPreview && (
          <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Preview</p>
            <Preview
              cfg={cfg}
              schoolName={school?.name ?? 'Your School Name'}
              logoUrl={school?.logo_url ?? null}
              motto={school?.motto ?? null}
            />
            <p className="text-xs text-slate-400 text-center">
              Preview is approximate — actual print may vary slightly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
