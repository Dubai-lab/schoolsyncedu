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

// ── Defaults ────────────────────────────────────────────────────────────────────

const DEFAULTS: TranscriptConfig = {
  header_bg_color: '#b91c1c',
  header_text_color: '#ffffff',
  table_header_bg: '#f1f5f9',
  principal_name: '',
  registrar_name: '',
  show_motto_footer: true,
};

// ── Mini preview ─────────────────────────────────────────────────────────────────

function Preview({ cfg, schoolName, motto }: { cfg: TranscriptConfig; schoolName: string; motto: string | null }) {
  return (
    <div className="border-2 border-slate-300 rounded-lg overflow-hidden text-xs font-serif shadow">
      {/* Header */}
      <div
        className="text-center py-3 px-4"
        style={{ backgroundColor: cfg.header_bg_color, color: cfg.header_text_color }}
      >
        <p className="text-[10px] uppercase tracking-widest opacity-75">Quality Education is Our Concern</p>
        <h1 className="text-base font-bold uppercase tracking-wide">{schoolName}</h1>
        <p className="text-[10px] mt-0.5 opacity-80">ELWA Junction, Paynesville Liberia</p>
      </div>

      {/* Office strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-1">
        <p className="italic text-slate-500 text-[10px]">Office of the Registrar</p>
      </div>
      <div className="text-center py-1.5 bg-white border-b border-slate-200">
        <p className="font-bold uppercase tracking-wider text-[11px] text-slate-800">Official Transcript</p>
      </div>

      {/* Grade table sample */}
      <table className="w-full border-collapse border-t border-slate-400 text-[10px]">
        <thead>
          <tr style={{ backgroundColor: cfg.table_header_bg }}>
            <th className="border border-slate-300 px-2 py-1 text-left font-bold text-slate-800 w-32">SUBJECTS</th>
            <th className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-800">GRADE 9</th>
            <th className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-800">GRADE 10</th>
          </tr>
        </thead>
        <tbody>
          {['Mathematics', 'English', 'Science'].map((s, i) => (
            <tr key={s} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td className="border border-slate-200 px-2 py-0.5 text-slate-700">{s}</td>
              <td className="border border-slate-200 px-2 py-0.5 text-center text-slate-800">85</td>
              <td className="border border-slate-200 px-2 py-0.5 text-center text-slate-800">90</td>
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
      <div className="grid grid-cols-2 gap-8 px-6 pt-3 pb-2 bg-white border-t border-slate-200">
        <div className="text-center">
          <div className="border-b border-slate-600 mb-1 h-5" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            {cfg.registrar_name || 'Registrar'}
          </p>
        </div>
        <div className="text-center">
          <div className="border-b border-slate-600 mb-1 h-5" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            {cfg.principal_name || 'Principal'}
          </p>
        </div>
      </div>

      {/* Motto footer */}
      {cfg.show_motto_footer && motto && (
        <div className="text-center py-1 bg-slate-50 border-t border-slate-200">
          <p className="text-[9px] italic text-slate-500">MOTTO: {motto}</p>
        </div>
      )}
    </div>
  );
}

// ── Field helpers ────────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-mono">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-slate-200 p-0.5"
        />
      </div>
    </div>
  );
}

function TextField({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
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

// ── Main Page ────────────────────────────────────────────────────────────────────

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

  // Pre-fill from saved config + principal_name
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
        site_config: {
          ...(school?.site_config ?? {}),
          transcript_config: cfg,
        },
      }),
    ['school-info', schoolId],
    {
      onSuccess: () => {
        notify.success('Transcript design saved');
        refetch();
      },
    },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Transcript Designer' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" />
            Transcript Designer
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Customise colours, names, and layout for the official student transcript.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-4 w-4 mr-1.5" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button onClick={() => saveMutation.mutate(undefined)} loading={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" />
            Save Design
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-xl'}`}>
        {/* ── Editor Panel ── */}
        <div className="space-y-4">
          {/* Colours */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Colours</h2>
            <ColorField label="Header background" value={cfg.header_bg_color} onChange={(v) => set('header_bg_color', v)} />
            <ColorField label="Header text" value={cfg.header_text_color} onChange={(v) => set('header_text_color', v)} />
            <ColorField label="Table header background" value={cfg.table_header_bg} onChange={(v) => set('table_header_bg', v)} />
          </Card>

          {/* Signatories */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Signatory Names</h2>
            <p className="text-xs text-slate-400">
              These names appear below the signature lines at the bottom of the transcript.
            </p>
            <TextField
              label="Principal Name"
              placeholder="e.g. Dr. John Smith"
              value={cfg.principal_name}
              onChange={(v) => set('principal_name', v)}
            />
            <TextField
              label="Registrar Name"
              placeholder="e.g. Mary Johnson"
              value={cfg.registrar_name}
              onChange={(v) => set('registrar_name', v)}
            />
          </Card>

          {/* Options */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Options</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.show_motto_footer}
                onChange={(e) => set('show_motto_footer', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-slate-700">Show school motto in footer</span>
            </label>
          </Card>
        </div>

        {/* ── Live Preview ── */}
        {showPreview && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Preview</p>
            <Preview
              cfg={cfg}
              schoolName={school?.name ?? 'School Name'}
              motto={school?.motto ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
