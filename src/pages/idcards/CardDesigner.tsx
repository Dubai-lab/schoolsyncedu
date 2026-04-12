import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { cardDesignService } from '@/services/nfcService';
import type { IdCardDesignData } from '@/types/nfc.types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Plus, Trash2, Star, Pencil, CreditCard, Eye } from 'lucide-react';

const DEFAULT_FIELDS = ['student_name', 'student_id', 'grade_level', 'class', 'photo', 'school_name', 'school_logo', 'valid_until', 'barcode'];

type DesignRow = {
  id: string;
  name: string;
  design_json: IdCardDesignData;
  is_active: boolean;
  created_at: string;
};

export default function CardDesigner() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: designs, isLoading } = useFetch(
    ['card-designs', schoolId],
    () => cardDesignService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    width: '86',
    height: '54',
    logo: '',
    fields: DEFAULT_FIELDS.slice(0, 6),
  });

  const createDesign = useMutate(
    () => cardDesignService.create(schoolId, {
      name: form.name,
      design_json: {
        logo: form.logo || undefined,
        dimensions: { width: Number(form.width), height: Number(form.height) },
        fields: form.fields,
      },
      created_by: user?.id ?? '',
    }),
    [['card-designs']],
    {
      onSuccess: () => {
        notify.success('Design created');
        setShowCreate(false);
        setForm({ name: '', width: '86', height: '54', logo: '', fields: DEFAULT_FIELDS.slice(0, 6) });
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

  // Preview
  const [preview, setPreview] = useState<DesignRow | null>(null);

  const toggleField = (field: string) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.includes(field) ? f.fields.filter((ff) => ff !== field) : [...f.fields, field],
    }));
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'ID Cards', href: '/idcards' }, { label: 'Card Designer' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" /> Card Designs
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Design
        </Button>
      </div>

      {/* Designs Grid */}
      {isLoading ? (
        <div className="text-sm text-slate-400">Loading...</div>
      ) : (designs ?? []).length === 0 ? (
        <Card className="p-8 text-center text-slate-400">
          No card designs yet. Create your first design.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(designs as unknown as DesignRow[]).map((d) => (
            <Card key={d.id} className="p-4 relative group">
              {d.is_active && (
                <Badge variant="success" size="sm" className="absolute top-3 right-3">
                  <Star className="h-3 w-3 mr-0.5" /> Active
                </Badge>
              )}
              <h3 className="font-semibold text-slate-800">{d.name}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {d.design_json.dimensions?.width ?? 86} × {d.design_json.dimensions?.height ?? 54} mm
              </p>

              {/* Fields preview */}
              <div className="flex flex-wrap gap-1 mt-3">
                {(d.design_json.fields ?? []).map((f) => (
                  <Badge key={f} variant="default" size="sm">{f.replace(/_/g, ' ')}</Badge>
                ))}
              </div>

              {/* Card Visual Preview */}
              <div className="mt-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200"
                style={{ aspectRatio: `${d.design_json.dimensions?.width ?? 86} / ${d.design_json.dimensions?.height ?? 54}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-8 h-8 bg-blue-300 rounded-full" />
                    <p className="text-[10px] font-bold text-blue-800 mt-1">Student Name</p>
                    <p className="text-[8px] text-blue-600">ID: 000000</p>
                  </div>
                  <div className="w-8 h-10 bg-blue-200 rounded border border-blue-300" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                {!d.is_active && (
                  <Button size="sm" variant="outline" onClick={() => setActive.mutate(d.id)}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Set Active
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPreview(d)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteDesign.mutate(d.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Panel */}
      {preview && (
        <Dialog open={!!preview} onClose={() => setPreview(null)}>
          <DialogHeader><DialogTitle>Design Preview: {preview.name}</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <div><span className="text-slate-500">Dimensions:</span> {preview.design_json.dimensions?.width ?? 86} × {preview.design_json.dimensions?.height ?? 54} mm</div>
                <div><span className="text-slate-500">Status:</span> {preview.is_active ? <Badge variant="success" size="sm">Active</Badge> : <Badge variant="default" size="sm">Inactive</Badge>}</div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">Card Fields</p>
                <div className="flex flex-wrap gap-1">
                  {(preview.design_json.fields ?? []).map((f) => (
                    <Badge key={f} variant="info" size="sm">{f.replace(/_/g, ' ')}</Badge>
                  ))}
                </div>
              </div>
              {preview.design_json.logo && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Logo URL</p>
                  <p className="text-sm text-slate-600 break-all">{preview.design_json.logo}</p>
                </div>
              )}
              {/* Large card preview */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 max-w-sm mx-auto"
                style={{ aspectRatio: `${preview.design_json.dimensions?.width ?? 86} / ${preview.design_json.dimensions?.height ?? 54}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-12 h-12 bg-blue-300 rounded-full" />
                    <p className="text-xs font-bold text-blue-800 mt-2">Student Full Name</p>
                    <p className="text-[10px] text-blue-600">ID: SLR-2026-0001</p>
                    <p className="text-[10px] text-blue-600">Grade: 10A</p>
                  </div>
                  <div className="text-right">
                    <div className="w-12 h-14 bg-blue-200 rounded border border-blue-300 mb-1" />
                    <p className="text-[8px] text-blue-500">School Logo</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Create Design Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader><DialogTitle>Create Card Design</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Design Name *" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 2025-2026 Student ID" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Width (mm)" type="number" value={form.width}
                onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} />
              <Input label="Height (mm)" type="number" value={form.height}
                onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
            </div>
            <Input label="Logo URL" value={form.logo}
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))} placeholder="https://..." />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Card Fields</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_FIELDS.map((field) => (
                  <button key={field} onClick={() => toggleField(field)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${form.fields.includes(field) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {field.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => createDesign.mutate(undefined)} loading={createDesign.isPending}
            disabled={!form.name.trim()}>
            <Pencil className="h-4 w-4 mr-1" /> Create Design
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}