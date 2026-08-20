import { useState } from 'react';
import { notify } from '@/components/shared/Toast';
import { uploadSchoolSiteImage } from '@/utils/storage.upload';
import { Loader2, Upload, Trash2, Plus, ArrowUp, ArrowDown, X } from 'lucide-react';
import type { BlockType } from '@/types/siteBlocks';

/**
 * Content editors for every block.
 *
 * These used to live on a separate Content tab, so a school edited a gallery's
 * photos in one place, its heading in another and its layout in a third. A
 * block owns all three now, which is the only arrangement where "where do I
 * change this?" has one answer.
 *
 * Written as a field schema rather than eight bespoke forms. Each block type
 * declares what it holds and the two editors below render it — so a new block
 * type is a few lines here, not another screen, and every list behaves the
 * same way whichever block it belongs to.
 */

type FieldType = 'text' | 'textarea' | 'image' | 'icon' | 'date' | 'number' | 'rating';

interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  hint?: string;
}

/** Repeating items: a gallery's photos, a page of programmes, the staff list. */
interface ListSpec {
  /** Where the array lives on the block's content. */
  key: string;
  /** What one of them is called, for the Add button and the empty state. */
  noun: string;
  fields: FieldDef[];
  /** Shown in the row header, so a collapsed list is still readable. */
  titleField: string;
}

/** Fields that sit directly on the block rather than repeating. */
export const SINGLE_FIELDS: Partial<Record<BlockType, FieldDef[]>> = {
  hero: [
    { name: 'image_url', label: 'Background photo', type: 'image' },
    { name: 'hours', label: 'School hours', type: 'text', placeholder: '7:30am – 3:00pm' },
    { name: 'apply_label', label: 'Main button', type: 'text', placeholder: 'Apply Now' },
    { name: 'second_label', label: 'Second button', type: 'text', placeholder: 'Discover More' },
  ],
  about: [
    { name: 'body', label: 'About your school', type: 'textarea',
      hint: 'Leave a blank line between paragraphs.' },
    { name: 'mission', label: 'Mission', type: 'textarea' },
    { name: 'vision', label: 'Vision', type: 'textarea' },
    { name: 'building_image', label: 'Photo of the school', type: 'image',
      hint: 'Without one, four general cards are shown instead.' },
    { name: 'principal_message', label: 'A word from the principal', type: 'textarea' },
    { name: 'principal_image', label: 'Principal photo', type: 'image' },
    { name: 'principal_title', label: 'Principal title', type: 'text', placeholder: 'Principal' },
  ],
  textImage: [
    { name: 'body', label: 'Words', type: 'textarea',
      hint: 'Leave a blank line between paragraphs.' },
    { name: 'image_url', label: 'Picture', type: 'image' },
  ],
  cta: [
    { name: 'button_text', label: 'Button text', type: 'text', placeholder: 'Apply Now' },
  ],
  contact: [
    { name: 'hours', label: 'Opening hours', type: 'text', placeholder: '7:30am – 3:00pm' },
  ],
  announcements: [
    { name: 'limit', label: 'How many to show', type: 'number', hint: '0 shows every one.' },
  ],
};

export const LIST_SPECS: Partial<Record<BlockType, ListSpec>> = {
  hero: {
    key: 'slides', noun: 'slide', titleField: 'caption',
    fields: [{ name: 'image_url', label: 'Photo', type: 'image' }],
  },
  stats: {
    key: 'items', noun: 'number', titleField: 'label',
    fields: [
      { name: 'value', label: 'Number', type: 'text', placeholder: '1,200+' },
      { name: 'label', label: 'What it counts', type: 'text', placeholder: 'Students' },
      { name: 'icon', label: 'Icon', type: 'icon' },
    ],
  },
  programs: {
    key: 'items', noun: 'programme', titleField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'text', placeholder: 'Senior High' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'icon', label: 'Icon', type: 'icon' },
    ],
  },
  gallery: {
    key: 'images', noun: 'photo', titleField: 'caption',
    fields: [
      { name: 'url', label: 'Photo', type: 'image' },
      { name: 'caption', label: 'Caption', type: 'text' },
    ],
  },
  administration: {
    key: 'members', noun: 'person', titleField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'role', label: 'Role', type: 'text', placeholder: 'Principal' },
      { name: 'photo_url', label: 'Photo', type: 'image' },
      { name: 'bio', label: 'Short bio', type: 'textarea' },
    ],
  },
  testimonials: {
    key: 'items', noun: 'quote', titleField: 'name',
    fields: [
      { name: 'quote', label: 'What they said', type: 'textarea' },
      { name: 'name', label: 'Who said it', type: 'text' },
      { name: 'role', label: 'Their role', type: 'text', placeholder: 'Parent' },
      { name: 'photo_url', label: 'Photo', type: 'image' },
      { name: 'rating', label: 'Stars', type: 'rating' },
    ],
  },
  announcements: {
    key: 'items', noun: 'announcement', titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'category', label: 'Category', type: 'text', placeholder: 'Announcement' },
      { name: 'excerpt', label: 'Summary', type: 'textarea' },
    ],
  },
};

/** Icons the page can draw. Same set the site resolves at render. */
const ICONS = [
  'users', 'graduation-cap', 'book-open', 'star', 'award', 'trophy', 'flask',
  'calculator', 'music', 'palette', 'globe', 'laptop', 'heart', 'shield',
  'target', 'zap', 'brain', 'lightbulb', 'building', 'library', 'pen-tool',
];

const FIELD =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const LEGEND = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

// ── One field ────────────────────────────────────────────────────────────────

export function Field({
  def, value, schoolId, onChange,
}: {
  def: FieldDef;
  value: unknown;
  schoolId: string;
  onChange: (v: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : '';

  return (
    <div>
      <label className={LEGEND}>{def.label}</label>

      {def.type === 'textarea' && (
        <textarea
          className={`${FIELD} min-h-[100px]`}
          value={str}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {def.type === 'image' && (
        <ImageField url={str} schoolId={schoolId} onChange={onChange} />
      )}

      {def.type === 'icon' && (
        <div className="flex flex-wrap gap-1">
          {ICONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={name.replace(/-/g, ' ')}
              className={`rounded border px-1.5 py-1 text-[10px] capitalize ${
                str === name
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-slate-200 text-slate-500 hover:bg-white'
              }`}
            >
              {name.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {def.type === 'rating' && (
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-7 w-7 rounded border text-xs font-semibold ${
                Number(value ?? 0) === n
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-slate-200 text-slate-500 hover:bg-white'
              }`}
            >
              {n === 0 ? '–' : n}
            </button>
          ))}
        </div>
      )}

      {(def.type === 'number') && (
        <input
          type="number" className={FIELD}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}

      {def.type === 'date' && (
        <input
          type="date" className={FIELD}
          value={str ? str.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {(!def.type || def.type === 'text') && (
        <input
          className={FIELD}
          value={str}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {def.hint && <p className="mt-1 text-[11px] text-slate-400">{def.hint}</p>}
    </div>
  );
}

/** Upload rather than a URL box: a school has a photo, not a link to one. */
function ImageField({
  url, schoolId, onChange,
}: {
  url: string;
  schoolId: string;
  onChange: (v: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file || !schoolId) return;
    setBusy(true);
    try {
      onChange(await uploadSchoolSiteImage(schoolId, file, 'gallery'));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not upload that image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {url && (
        <div className="relative">
          <img src={url} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remove"
            className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-400 shadow ring-1 ring-slate-200 hover:text-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        <input
          type="file" accept="image/*" className="hidden" disabled={busy}
          onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }}
        />
      </label>
    </div>
  );
}

// ── Repeating items ──────────────────────────────────────────────────────────

export function ListEditor({
  spec, items, schoolId, onChange,
}: {
  spec: ListSpec;
  items: Record<string, unknown>[];
  schoolId: string;
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function set(i: number, name: string, value: unknown) {
    onChange(items.map((it, n) => (n === i ? { ...it, [name]: value } : it)));
  }

  function move(i: number, delta: number) {
    const t = i + delta;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
    setOpenIndex(t);
  }

  return (
    <div className="space-y-2">
      <label className={LEGEND}>{spec.noun === 'photo' ? 'Photos' : `${spec.noun}s`}</label>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[11px] text-slate-400">
          No {spec.noun}s yet — this block stays off the page until it has one.
        </p>
      )}

      {items.map((item, i) => {
        const open = openIndex === i;
        const title = (item[spec.titleField] as string) || `Untitled ${spec.noun}`;
        const thumb = (item.url ?? item.photo_url ?? item.image_url) as string | undefined;

        return (
          <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 px-2.5 py-2">
              {thumb
                ? <img src={thumb} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                : <span className="h-8 w-8 shrink-0 rounded bg-slate-100" />}
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                className="min-w-0 flex-1 truncate text-left text-xs font-medium text-slate-700"
              >
                {title}
              </button>
              <button type="button" onClick={() => move(i, -1)} title="Move up"
                className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} title="Move down"
                className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { onChange(items.filter((_, n) => n !== i)); setOpenIndex(null); }}
                title="Remove"
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {open && (
              <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/60 p-3">
                {spec.fields.map((def) => (
                  <Field
                    key={def.name}
                    def={def}
                    value={item[def.name]}
                    schoolId={schoolId}
                    onChange={(v) => set(i, def.name, v)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => { onChange([...items, {}]); setOpenIndex(items.length); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
      >
        <Plus className="h-3.5 w-3.5" /> Add a {spec.noun}
      </button>
    </div>
  );
}

/** Everything a block holds: its single fields, then its repeating ones. */
export function BlockContent({
  type, content, schoolId, onContent,
}: {
  type: BlockType;
  content: Record<string, unknown>;
  schoolId: string;
  onContent: (key: string, value: unknown) => void;
}) {
  const singles = SINGLE_FIELDS[type];
  const list = LIST_SPECS[type];

  if (!singles && !list) return null;

  return (
    <div className="space-y-3">
      {singles?.map((def) => (
        <Field
          key={def.name}
          def={def}
          value={content[def.name]}
          schoolId={schoolId}
          onChange={(v) => onContent(def.name, v)}
        />
      ))}

      {list && (
        <ListEditor
          spec={list}
          items={(content[list.key] as Record<string, unknown>[]) ?? []}
          schoolId={schoolId}
          onChange={(next) => onContent(list.key, next)}
        />
      )}
    </div>
  );
}
