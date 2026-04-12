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
  Plus,
  Trash2,
  Star,
  Pencil,
  CreditCard,
  Eye,
  Palette,
  Save,
  Upload,
  Loader2,
  Image,
  RotateCw,
} from 'lucide-react';

// ==================== LIVE CARD PREVIEW ====================

function CardPreview({
  design,
  school,
  size = 'normal',
}: {
  design: IdCardDesignData;
  school: School | undefined;
  size?: 'normal' | 'large';
}) {
  const bgColor = design.background_color || '#1e3a5f';
  const textColor = design.text_color || '#ffffff';
  const accentColor = design.accent_color || '#f59e0b';
  const headerColor = design.header_color || '#0f2744';
  const schoolName = school?.name || 'School Name';
  const schoolMotto = school?.motto || 'Excellence in Education';
  const logoUrl = design.logo || school?.logo_url;
  const isLarge = size === 'large';
  const scale = isLarge ? 1.6 : 1;

  return (
    <div
      className="relative overflow-hidden shadow-lg"
      style={{
        width: `${(design.dimensions?.width ?? 86) * scale * 3.2}px`,
        height: `${(design.dimensions?.height ?? 54) * scale * 3.2}px`,
        borderRadius: design.border_style === 'rounded' ? '12px' : design.border_style === 'none' ? '0' : '6px',
        fontFamily: design.font_family || 'system-ui',
      }}
    >
      {/* Background */}
      {design.card_bg_image ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${design.card_bg_image})` }}>
          <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: 0.85 }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      )}

      {/* Header bar */}
      <div
        className="relative flex items-center gap-2 px-3 py-1.5"
        style={{
          backgroundColor: headerColor,
          paddingTop: `${4 * scale}px`,
          paddingBottom: `${4 * scale}px`,
          paddingLeft: `${8 * scale}px`,
          paddingRight: `${8 * scale}px`,
        }}
      >
        {/* School logo */}
        {design.show_school_logo !== false && (
          <div
            className="shrink-0 rounded-full bg-white/20 flex items-center justify-center overflow-hidden"
            style={{ width: `${24 * scale}px`, height: `${24 * scale}px` }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: `${10 * scale}px`, color: textColor }}>&#x1F3EB;</span>
            )}
          </div>
        )}
        {/* School name + motto */}
        <div className="flex-1 min-w-0">
          {design.show_school_name !== false && (
            <p
              className="font-bold truncate leading-tight"
              style={{ fontSize: `${8 * scale}px`, color: textColor }}
            >
              {schoolName}
            </p>
          )}
          {design.show_school_motto !== false && (
            <p
              className="truncate leading-tight opacity-80"
              style={{ fontSize: `${5 * scale}px`, color: textColor }}
            >
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
          letterSpacing: `${1.5 * scale}px`,
        }}
      >
        Student Identification Card
      </div>

      {/* Body — Photo + Info */}
      <div
        className="relative flex gap-2"
        style={{
          padding: `${6 * scale}px ${8 * scale}px`,
        }}
      >
        {/* Photo placeholder */}
        {(design.fields ?? []).includes('photo') && (
          <div
            className="shrink-0 bg-white/20 rounded flex items-center justify-center"
            style={{
              width: `${28 * scale}px`,
              height: `${32 * scale}px`,
              border: `1px solid ${accentColor}40`,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
              style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {(design.fields ?? []).includes('student_name') && (
            <div>
              <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Name</p>
              <p className="font-bold truncate" style={{ fontSize: `${7 * scale}px`, color: textColor }}>
                John K. Doe
              </p>
            </div>
          )}
          {(design.fields ?? []).includes('student_id') && (
            <div>
              <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Student ID</p>
              <p className="font-mono font-semibold" style={{ fontSize: `${6 * scale}px`, color: accentColor }}>
                SLR-2026-0001
              </p>
            </div>
          )}
          <div className="flex gap-3">
            {(design.fields ?? []).includes('grade_level') && (
              <div>
                <p style={{ fontSize: `${4.5 * scale}px`, color: `${textColor}99` }}>Grade</p>
                <p className="font-semibold" style={{ fontSize: `${6 * scale}px`, color: textColor }}>10A</p>
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

      {/* Footer — barcode strip */}
      {design.show_barcode !== false && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1"
          style={{
            backgroundColor: headerColor,
            padding: `${2 * scale}px 0`,
          }}
        >
          {/* Simulated barcode lines */}
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: `${(Math.random() * 1.5 + 0.5) * scale}px`,
                height: `${8 * scale}px`,
                backgroundColor: i % 3 === 0 ? accentColor : `${textColor}60`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== BACK-OF-CARD PREVIEW ====================

function CardBackPreview({
  design,
  school,
  size = 'normal',
}: {
  design: IdCardDesignData;
  school: School | undefined;
  size?: 'normal' | 'large';
}) {
  const backBg = design.back_bg_color || design.background_color || '#1e3a5f';
  const backText = design.back_text_color || design.text_color || '#ffffff';
  const accentColor = design.accent_color || '#f59e0b';
  const isLarge = size === 'large';
  const scale = isLarge ? 1.6 : 1;

  return (
    <div
      className="relative overflow-hidden shadow-lg flex flex-col"
      style={{
        width: `${(design.dimensions?.width ?? 86) * scale * 3.2}px`,
        height: `${(design.dimensions?.height ?? 54) * scale * 3.2}px`,
        borderRadius: design.border_style === 'rounded' ? '12px' : design.border_style === 'none' ? '0' : '6px',
        fontFamily: design.font_family || 'system-ui',
        backgroundColor: backBg,
      }}
    >
      {/* Title strip */}
      <div
        className="text-center font-bold uppercase tracking-wider shrink-0"
        style={{
          backgroundColor: accentColor,
          fontSize: `${5 * scale}px`,
          color: backBg,
          padding: `${2 * scale}px 0`,
          letterSpacing: `${1 * scale}px`,
        }}
      >
        Important Information
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col justify-between" style={{ padding: `${5 * scale}px ${8 * scale}px` }}>
        {/* Emergency Info */}
        {design.show_back_emergency_info !== false && (
          <div>
            <p className="font-bold" style={{ fontSize: `${5 * scale}px`, color: accentColor }}>Emergency Contact</p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Name: ________________</p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Phone: ________________</p>
          </div>
        )}

        {/* School Address */}
        {design.show_back_school_address !== false && (
          <div>
            <p className="font-bold" style={{ fontSize: `${5 * scale}px`, color: accentColor }}>
              {school?.name || 'School Name'}
            </p>
            <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>
              {school?.address || '123 School Street, City'}
            </p>
            {school?.phone && (
              <p style={{ fontSize: `${4.5 * scale}px`, color: `${backText}bb` }}>Tel: {school.phone}</p>
            )}
          </div>
        )}

        {/* Custom text */}
        {design.back_content && (
          <p className="italic text-center" style={{ fontSize: `${4 * scale}px`, color: `${backText}99` }}>
            {design.back_content}
          </p>
        )}

        {/* Terms */}
        <p className="text-center italic" style={{ fontSize: `${3.5 * scale}px`, color: `${backText}66` }}>
          This card is the property of the school. If found, please return.
        </p>
      </div>

      {/* Bottom barcode */}
      {design.show_back_barcode !== false && (
        <div
          className="shrink-0 flex items-center justify-center gap-1"
          style={{
            backgroundColor: `${backText}10`,
            padding: `${2 * scale}px 0`,
          }}
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: `${(Math.random() * 1.5 + 0.5) * scale}px`,
                height: `${8 * scale}px`,
                backgroundColor: i % 3 === 0 ? accentColor : `${backText}60`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== CONSTANTS ====================

const CARD_FIELDS = [
  'student_name', 'student_id', 'grade_level', 'class', 'photo',
  'school_name', 'school_logo', 'valid_until', 'barcode',
];

const FONT_OPTIONS = [
  { label: 'System Default', value: 'system-ui' },
  { label: 'Serif (Times)', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'Consolas, monospace' },
];

const defaultDesign: IdCardDesignData = {
  dimensions: { width: 86, height: 54 },
  fields: ['student_name', 'student_id', 'grade_level', 'photo', 'valid_until'],
  background_color: '#1e3a5f',
  text_color: '#ffffff',
  accent_color: '#f59e0b',
  header_color: '#0f2744',
  font_family: 'system-ui',
  show_school_name: true,
  show_school_logo: true,
  show_school_motto: true,
  show_barcode: true,
  show_qr_code: false,
  border_style: 'rounded',
  orientation: 'landscape',
  // Back
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

// ==================== MAIN COMPONENT ====================

export default function ITCardDesigner() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  // Fetch designs + school data for preview
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

  // Create / Edit state
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [design, setDesign] = useState<IdCardDesignData>({ ...defaultDesign });
  const [cardLogoUploading, setCardLogoUploading] = useState(false);
  const cardLogoInputRef = useRef<HTMLInputElement>(null);
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewDesign, setPreviewDesign] = useState<DesignRow | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  const createDesign = useMutate(
    () => cardDesignService.create(schoolId, {
      name,
      design_json: design,
      created_by: user?.id ?? '',
    }),
    [['card-designs']],
    {
      onSuccess: () => {
        notify.success('Card design created');
        closeEditor();
      },
    },
  );

  const updateDesign = useMutate(
    () => cardDesignService.update(editId!, { name, design_json: design }),
    [['card-designs']],
    {
      onSuccess: () => {
        notify.success('Card design updated');
        closeEditor();
      },
    },
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
    if (!name.trim()) {
      notify.error('Please enter a design name');
      return;
    }
    if (editId) {
      updateDesign.mutate(undefined);
    } else {
      createDesign.mutate(undefined);
    }
  }

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
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Card Designer' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <CreditCard className="inline-block h-6 w-6 mr-2 text-blue-600" />
            ID Card Designer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and customize professional student ID card designs with your school branding.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Design
        </Button>
      </div>

      {/* Designs Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (designs as unknown as DesignRow[]).length === 0 ? (
        <Card className="p-12 text-center">
          <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">No card designs yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Create your first student ID card design. It will automatically use your school&apos;s logo and colors.
          </p>
          <Button className="mt-4" onClick={openCreate}>
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
              <h3 className="font-semibold text-slate-800 mb-1">{d.name}</h3>
              <p className="text-xs text-slate-400 mb-3">
                {d.design_json.dimensions?.width ?? 86} × {d.design_json.dimensions?.height ?? 54} mm
                &bull; Created {new Date(d.created_at).toLocaleDateString()}
              </p>

              {/* Live Mini Preview */}
              <div className="flex justify-center mb-4">
                <CardPreview design={{ ...defaultDesign, ...d.design_json }} school={school} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {!d.is_active && (
                  <Button size="sm" variant="outline" onClick={() => setActive.mutate(d.id)}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Set Active
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPreviewDesign(d)}>
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => setPreviewSide('front')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  previewSide === 'front'
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                Front
              </button>
              <button
                onClick={() => setPreviewSide('back')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  previewSide === 'back'
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                Back
              </button>
            </div>
            <div className="flex justify-center py-4">
              {previewSide === 'front' ? (
                <CardPreview
                  design={{ ...defaultDesign, ...previewDesign.design_json }}
                  school={school}
                  size="large"
                />
              ) : (
                <CardBackPreview
                  design={{ ...defaultDesign, ...previewDesign.design_json }}
                  school={school}
                  size="large"
                />
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
          </DialogFooter>
        </Dialog>
      )}

      {/* Editor Panel */}
      {showEditor && (
        <Dialog open onClose={closeEditor} className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Card Design' : 'Create Card Design'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                <Input
                  label="Design Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 2025-2026 Student ID"
                />

                {/* Dimensions */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Card Dimensions (mm)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Width"
                      type="number"
                      value={String(design.dimensions?.width ?? 86)}
                      onChange={(e) => setD('dimensions', { ...design.dimensions, width: Number(e.target.value) })}
                    />
                    <Input
                      label="Height"
                      type="number"
                      value={String(design.dimensions?.height ?? 54)}
                      onChange={(e) => setD('dimensions', { ...design.dimensions, height: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Palette className="inline h-4 w-4 mr-1" /> Colors
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Background', key: 'background_color' as const, default: '#1e3a5f' },
                      { label: 'Text', key: 'text_color' as const, default: '#ffffff' },
                      { label: 'Accent', key: 'accent_color' as const, default: '#f59e0b' },
                      { label: 'Header', key: 'header_color' as const, default: '#0f2744' },
                    ].map((c) => (
                      <div key={c.key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(design[c.key] as string) ?? c.default}
                          onChange={(e) => setD(c.key, e.target.value)}
                          className="h-8 w-10 rounded border cursor-pointer"
                        />
                        <span className="text-xs text-slate-600">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Use school colors shortcut */}
                {school && (
                  <button
                    onClick={() => {
                      setDesign((prev) => ({
                        ...prev,
                        background_color: school.primary_color || prev.background_color,
                        accent_color: school.secondary_color || prev.accent_color,
                        header_color: school.primary_color ? `${school.primary_color}cc` : prev.header_color,
                      }));
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Use school colors ({school.primary_color}, {school.secondary_color})
                  </button>
                )}

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Logo</label>
                  <div className="flex items-center gap-3">
                    {(design.logo || school?.logo_url) ? (
                      <img
                        src={design.logo || school?.logo_url || ''}
                        alt="Logo"
                        className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                        <Image className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={cardLogoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
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
                          } finally {
                            setCardLogoUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => cardLogoInputRef.current?.click()}
                        disabled={cardLogoUploading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        {cardLogoUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {cardLogoUploading ? 'Uploading...' : 'Upload Logo'}
                      </button>
                      <p className="mt-0.5 text-[10px] text-slate-400">PNG, JPG, WebP, SVG. Max 2 MB.</p>
                    </div>
                  </div>
                </div>

                {/* Background Image */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Background Image (optional)</label>
                  <div className="flex items-center gap-3">
                    {design.card_bg_image ? (
                      <img
                        src={design.card_bg_image}
                        alt="Card BG"
                        className="h-12 w-20 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                        <Image className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={bgImageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !schoolId) return;
                          setBgImageUploading(true);
                          try {
                            const url = await uploadSchoolLogo(schoolId, file);
                            setD('card_bg_image', url);
                            notify.success('Background image uploaded');
                          } catch (err) {
                            notify.error(err instanceof Error ? err.message : 'Upload failed');
                          } finally {
                            setBgImageUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => bgImageInputRef.current?.click()}
                          disabled={bgImageUploading}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          {bgImageUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {bgImageUploading ? 'Uploading...' : 'Upload'}
                        </button>
                        {design.card_bg_image && (
                          <button
                            type="button"
                            onClick={() => setD('card_bg_image', undefined)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">PNG, JPG, WebP, GIF. Max 2 MB.</p>
                    </div>
                  </div>
                </div>

                {/* Font */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Font Family</label>
                  <select
                    value={design.font_family ?? 'system-ui'}
                    onChange={(e) => setD('font_family', e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Border Style */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Border Style</label>
                  <div className="flex gap-2">
                    {(['none', 'solid', 'rounded'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setD('border_style', s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          design.border_style === s
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle switches */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Front Display Options</label>
                  <div className="space-y-2">
                    {[
                      { key: 'show_school_name' as const, label: 'School Name' },
                      { key: 'show_school_logo' as const, label: 'School Logo' },
                      { key: 'show_school_motto' as const, label: 'School Motto' },
                      { key: 'show_barcode' as const, label: 'Barcode' },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={design[opt.key] !== false}
                          onChange={(e) => setD(opt.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Back-of-card toggles */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Back Display Options</label>
                  <div className="space-y-2">
                    {[
                      { key: 'show_back_emergency_info' as const, label: 'Emergency Contact' },
                      { key: 'show_back_school_address' as const, label: 'School Address' },
                      { key: 'show_back_barcode' as const, label: 'Back Barcode' },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={design[opt.key] !== false}
                          onChange={(e) => setD(opt.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Back colors */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Back Colors</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Background', key: 'back_bg_color' as const, fallback: design.background_color || '#1e3a5f' },
                      { label: 'Text', key: 'back_text_color' as const, fallback: design.text_color || '#ffffff' },
                    ].map((c) => (
                      <div key={c.key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(design[c.key] as string) ?? c.fallback}
                          onChange={(e) => setD(c.key, e.target.value)}
                          className="h-8 w-10 rounded border cursor-pointer"
                        />
                        <span className="text-xs text-slate-600">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom back text */}
                <Input
                  label="Custom Back Text (optional)"
                  value={design.back_content ?? ''}
                  onChange={(e) => setD('back_content', e.target.value || undefined)}
                  placeholder="e.g. If found, call 0888-000-000"
                />

                {/* Card Fields */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Card Fields</label>
                  <div className="flex flex-wrap gap-2">
                    {CARD_FIELDS.map((field) => (
                      <button
                        key={field}
                        onClick={() => toggleField(field)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          (design.fields ?? []).includes(field)
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {field.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="flex flex-col items-center justify-start gap-4 sticky top-0">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-500">Live Preview</p>
                  <button
                    onClick={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <RotateCw className="h-3 w-3" />
                    {previewSide === 'front' ? 'Show Back' : 'Show Front'}
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {previewSide === 'front' ? 'Front' : 'Back'}
                </p>
                {previewSide === 'front' ? (
                  <CardPreview design={design} school={school} size="large" />
                ) : (
                  <CardBackPreview design={design} school={school} size="large" />
                )}
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  {previewSide === 'front'
                    ? 'Front of card with student details. Actual student data will replace sample text.'
                    : 'Back of card with emergency info and school details.'}
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
            <Button
              onClick={handleSave}
              loading={createDesign.isPending || updateDesign.isPending}
              disabled={!name.trim()}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {editId ? 'Save Changes' : 'Create Design'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
