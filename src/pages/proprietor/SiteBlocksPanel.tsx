import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  resolveBlocks, newBlock, duplicateBlock, canAddBlock, resolveContent,
  BLOCK_LABELS, REQUIRED_BLOCKS, REPEATABLE,
  type SiteBlock, type SitePageBlocks, type BlockType,
} from '@/types/siteBlocks';
import type { SiteTheme, BandStyle } from '@/types/siteTheme';
import type { SiteConfig } from '@/types/school.types';
import { PREVIEW_MESSAGE, PREVIEW_READY } from '@/hooks/usePreviewTheme';
import {
  Loader2, Save, Plus, Copy, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  ChevronDown, Monitor, Smartphone, ExternalLink, Lock,
} from 'lucide-react';

/**
 * The page, as something a school can build.
 *
 * The Design tab styles the site and the Content tab fills in the school's
 * programmes, gallery and staff. Neither could change what the page is made
 * of — eleven sections, one of each, in a fixed set. This is where a school
 * adds a section, uses one twice, and writes its own headings.
 *
 * Content deliberately splits between here and the Content tab. The first
 * block of a type reads the site-wide fields the Content tab writes, so both
 * screens keep working on the same school. Only extra instances — a second
 * gallery, a text and image block — hold their own content here, which is why
 * those are the only ones offering content fields below.
 */

const BANDS: { value: BandStyle; label: string }[] = [
  { value: 'brand',   label: 'School colour' },
  { value: 'deep',    label: 'Deep' },
  { value: 'ink',     label: 'Near black' },
  { value: 'surface', label: 'Plain' },
];

const VARIANTS: Partial<Record<BlockType, { value: string; label: string }[]>> = {
  gallery: [
    { value: 'masonry',  label: 'Masonry' },
    { value: 'grid',     label: 'Grid' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'strip',    label: 'Strip' },
  ],
  programs: [
    { value: 'grid',     label: 'Grid' },
    { value: 'list',     label: 'List' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'feature',  label: 'Feature' },
  ],
  administration: [
    { value: 'cards',   label: 'Cards' },
    { value: 'circles', label: 'Circles' },
    { value: 'rows',    label: 'Rows' },
  ],
  stats: [
    { value: 'bar',    label: 'Bar' },
    { value: 'cards',  label: 'Cards' },
    { value: 'inline', label: 'Inline' },
  ],
};

/** Which types offer a band choice of their own. */
const BANDED: BlockType[] = ['gallery', 'cta', 'textImage'];

const ADDABLE: BlockType[] = [
  'textImage', 'gallery', 'programs', 'announcements',
  'testimonials', 'administration', 'cta',
];

export default function SiteBlocksPanel() {
  const { user } = useAuth();
  const schoolId = user?.school_id;

  const [blocks, setBlocks] = useState<SitePageBlocks>([]);
  // Kept so a duplicate can be given real content: the first block of a type
  // holds none of its own and reads these fields instead.
  const [cfg, setCfg] = useState<SiteConfig>({});
  const [slug, setSlug] = useState('');
  const [theme, setTheme] = useState<SiteTheme>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewWide, setPreviewWide] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('schools').select('site_config, slug').eq('id', schoolId).maybeSingle();

      const loaded = (data?.site_config ?? {}) as SiteConfig;
      setCfg(loaded);
      const cfg = loaded;
      const t = ((cfg as Record<string, unknown>).theme as SiteTheme) ?? {};
      setTheme(t);
      // resolveBlocks returns the stored list, or derives one from the old
      // fields — so a school opening this for the first time sees the page it
      // already has rather than an empty builder.
      setBlocks(resolveBlocks(cfg, t.sectionOrder));
      setSlug((data?.slug as string) ?? '');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const pushPreview = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_MESSAGE, theme, blocks },
      window.location.origin,
    );
  }, [theme, blocks]);

  useEffect(() => { pushPreview(); }, [pushPreview]);

  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if ((e.data as { type?: string })?.type === PREVIEW_READY) pushPreview();
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [pushPreview]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  function edit(id: string, patch: Partial<SiteBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setDirty(true);
  }

  function editContent(id: string, key: string, value: unknown) {
    setBlocks((bs) => bs.map((b) =>
      b.id === id ? { ...b, content: { ...b.content, [key]: value } } : b));
    setDirty(true);
  }

  function editDesign(id: string, key: 'band' | 'variant', value: string | undefined) {
    setBlocks((bs) => bs.map((b) =>
      b.id === id ? { ...b, design: { ...(b.design ?? {}), [key]: value } } : b));
    setDirty(true);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    // The hero is the page's header. Nothing moves above it, and it does not
    // move down — a page whose first block is a photo gallery has no header.
    if (REQUIRED_BLOCKS.includes(blocks[index].type)) return;
    if (REQUIRED_BLOCKS.includes(blocks[target].type)) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    setDirty(true);
  }

  function add(type: BlockType) {
    setBlocks((bs) => [...bs, newBlock(type)]);
    setAddOpen(false);
    setDirty(true);
    notify.success(`${BLOCK_LABELS[type]} added at the bottom.`);
  }

  function duplicate(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i === -1) return;

    // The first block of a type carries no content of its own, so a plain copy
    // would be an empty section with no way to fill it. Materialise what it is
    // actually showing, and the duplicate starts as a real copy the school can
    // then edit apart from the original.
    const isFirst = blocks.findIndex((b) => b.type === blocks[i].type) === i;
    const source = isFirst
      ? { ...blocks[i], content: resolveContent(blocks[i], cfg, true) }
      : blocks[i];
    const copy = duplicateBlock(source);
    setBlocks([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
    setOpenId(copy.id);
    setDirty(true);
  }

  function remove(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (openId === id) setOpenId(null);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      // Read-modify-write: site_config holds the theme and all the page content
      // too, and replacing the object would erase them.
      const { data: current } = await supabase
        .from('schools').select('site_config').eq('id', schoolId).maybeSingle();

      const merged = { ...((current?.site_config ?? {}) as object), blocks };

      const { error } = await supabase
        .from('schools').update({ site_config: merged }).eq('id', schoolId);
      if (error) throw error;

      notify.success('Layout saved.');
      setDirty(false);
    } catch {
      notify.error('Could not save the layout.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const previewUrl = slug ? `/school/${slug}` : '';
  const counts: Record<string, number> = {};

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
      {/* ── The list ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Page blocks</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Your page from top to bottom. Add a block, use one twice, or drag
                the order around.
              </p>
            </div>
            <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {blocks.map((block, i) => {
            const n = counts[block.type] ?? 0;
            counts[block.type] = n + 1;

            const pinned = REQUIRED_BLOCKS.includes(block.type);
            const isOpen = openId === block.id;
            const isExtra = n > 0;

            return (
              <div
                key={block.id}
                className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                  isOpen ? 'border-primary-300 shadow-sm' : 'border-slate-200'
                } ${block.hidden ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : block.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {block.heading || BLOCK_LABELS[block.type]}
                    </span>
                    {isExtra && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {BLOCK_LABELS[block.type]} {n + 1}
                      </span>
                    )}
                    {pinned && <Lock className="h-3 w-3 shrink-0 text-slate-300" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => edit(block.id, { hidden: !block.hidden })}
                    title={block.hidden ? 'Show on the page' : 'Hide from the page'}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {block.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>

                  {!pinned && (
                    <>
                      <button
                        type="button" onClick={() => move(i, -1)} title="Move up"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button" onClick={() => move(i, 1)} title="Move down"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <BlockEditor
                    block={block}
                    isExtra={isExtra}
                    pinned={pinned}
                    onEdit={(patch) => edit(block.id, patch)}
                    onContent={(k, v) => editContent(block.id, k, v)}
                    onDesign={(k, v) => editDesign(block.id, k, v)}
                    onDuplicate={() => duplicate(block.id)}
                    onRemove={() => remove(block.id)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Add */}
        <div className="relative">
          <Button variant="outline" className="w-full" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add a block
          </Button>

          {addOpen && (
            <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {ADDABLE.map((type) => {
                const allowed = canAddBlock(type, blocks);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!allowed}
                    onClick={() => add(type)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="text-sm font-medium text-slate-800">{BLOCK_LABELS[type]}</span>
                    <span className="text-[11px] text-slate-400">
                      {!allowed ? 'already on the page' : REPEATABLE.includes(type) ? 'can repeat' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Live preview ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button" onClick={() => setPreviewWide(true)}
              className={`rounded-lg p-1.5 ${previewWide ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button" onClick={() => setPreviewWide(false)}
              className={`rounded-lg p-1.5 ${!previewWide ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Phone"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          {previewUrl && (
            <a
              href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Open the real site <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <iframe
            ref={frameRef}
            src={previewUrl}
            title="Preview"
            className={`block h-[70vh] border-0 bg-white transition-all ${previewWide ? 'w-full' : 'mx-auto w-[390px]'}`}
          />
        </div>
        <p className="text-[11px] text-slate-400">
          The real page, showing your unsaved changes. Nothing here is live until you save.
        </p>
      </div>
    </div>
  );
}

// ── One block's settings ─────────────────────────────────────────────────────

function BlockEditor({
  block, isExtra, pinned, onEdit, onContent, onDesign, onDuplicate, onRemove,
}: {
  block: SiteBlock;
  isExtra: boolean;
  pinned: boolean;
  onEdit: (patch: Partial<SiteBlock>) => void;
  onContent: (key: string, value: unknown) => void;
  onDesign: (key: 'band' | 'variant', value: string | undefined) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const variants = VARIANTS[block.type];
  const banded = BANDED.includes(block.type);
  const repeatable = REPEATABLE.includes(block.type);

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
  const legend = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
      {/* Wording. These used to be hardcoded into the page, which is the single
          biggest reason two school sites read the same. */}
      {block.type !== 'app' && (
        <div className="space-y-2.5">
          <div>
            <label className={legend}>Heading</label>
            <input
              className={field}
              value={block.heading ?? ''}
              placeholder={BLOCK_LABELS[block.type]}
              onChange={(e) => onEdit({ heading: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className={legend}>Small line above it</label>
            <input
              className={field}
              value={block.label ?? ''}
              placeholder="Leave empty to use ours"
              onChange={(e) => onEdit({ label: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className={legend}>Sentence underneath</label>
            <input
              className={field}
              value={block.intro ?? ''}
              placeholder="Optional"
              onChange={(e) => onEdit({ intro: e.target.value || undefined })}
            />
          </div>
        </div>
      )}

      {/* Content — only for blocks that carry their own. The first of each type
          reads what the Content tab writes, so editing it here would put the
          same school's data in two places. */}
      {block.type === 'textImage' && (
        <div className="space-y-2.5">
          <div>
            <label className={legend}>Words</label>
            <textarea
              className={`${field} min-h-[120px]`}
              value={(block.content.body as string) ?? ''}
              onChange={(e) => onContent('body', e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">Leave a blank line between paragraphs.</p>
          </div>
          <div>
            <label className={legend}>Picture URL</label>
            <input
              className={field}
              value={(block.content.image_url as string) ?? ''}
              placeholder="https://…  (optional)"
              onChange={(e) => onContent('image_url', e.target.value || null)}
            />
          </div>
          <div>
            <label className={legend}>Picture side</label>
            <div className="flex gap-2">
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onContent('image_side', side)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
                    ((block.content.image_side as string) ?? 'right') === side
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-300 text-slate-600 hover:bg-white'
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {block.type === 'gallery' && isExtra && (
        <GalleryImages
          images={(block.content.images as GalleryImage[]) ?? []}
          onChange={(next) => onContent('images', next)}
        />
      )}

      {block.type === 'cta' && (
        <div>
          <label className={legend}>Button text</label>
          <input
            className={field}
            value={(block.content.button_text as string) ?? ''}
            placeholder="Apply Now"
            onChange={(e) => onContent('button_text', e.target.value || undefined)}
          />
        </div>
      )}

      {block.type === 'announcements' && (
        <div>
          <label className={legend}>How many to show</label>
          <input
            type="number" min={0} className={field}
            value={String(block.content.limit ?? 6)}
            onChange={(e) => onContent('limit', Number(e.target.value))}
          />
          <p className="mt-1 text-[11px] text-slate-400">0 shows every announcement.</p>
        </div>
      )}

      {isExtra && !['textImage', 'cta', 'gallery'].includes(block.type) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          This is a second {BLOCK_LABELS[block.type].toLowerCase()}, so it starts empty —
          it does not share the one on the Content tab. Its own items can be added there
          in a later update; for now it will not appear on the page until it has content.
        </p>
      )}

      {/* Per-block design */}
      {(banded || variants) && (
        <div className="space-y-2.5">
          {banded && (
            <div>
              <label className={legend}>Background band</label>
              <div className="flex flex-wrap gap-1.5">
                <ChoiceChip
                  active={!block.design?.band}
                  onClick={() => onDesign('band', undefined)}
                  label="Follow the design"
                />
                {BANDS.map((b) => (
                  <ChoiceChip
                    key={b.value}
                    active={block.design?.band === b.value}
                    onClick={() => onDesign('band', b.value)}
                    label={b.label}
                  />
                ))}
              </div>
            </div>
          )}

          {variants && (
            <div>
              <label className={legend}>Layout</label>
              <div className="flex flex-wrap gap-1.5">
                <ChoiceChip
                  active={!block.design?.variant}
                  onClick={() => onDesign('variant', undefined)}
                  label="Follow the design"
                />
                {variants.map((v) => (
                  <ChoiceChip
                    key={v.value}
                    active={block.design?.variant === v.value}
                    onClick={() => onDesign('variant', v.value)}
                    label={v.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-slate-300"
          checked={block.inNav ?? ['hero', 'about', 'programs', 'gallery', 'administration', 'contact'].includes(block.type)}
          onChange={(e) => onEdit({ inNav: e.target.checked })}
        />
        Show a link to this in the menu
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        {repeatable && (
          <button
            type="button" onClick={onDuplicate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
        )}
        {!pinned && (
          <button
            type="button" onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function ChoiceChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-slate-300 text-slate-600 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
}

// ── Photos for a duplicated gallery ──────────────────────────────────────────

interface GalleryImage { url: string; caption?: string }

/**
 * Only shown on a second gallery. The first one's photos belong to the school
 * rather than to the block, and are managed on the Content tab — editing them
 * here as well would put the same list in two places.
 */
function GalleryImages({
  images, onChange,
}: {
  images: GalleryImage[];
  onChange: (next: GalleryImage[]) => void;
}) {
  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  function set(i: number, patch: Partial<GalleryImage>) {
    onChange(images.map((img, n) => (n === i ? { ...img, ...patch } : img)));
  }

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Photos in this gallery
      </label>

      {images.length === 0 && (
        <p className="text-[11px] text-slate-400">
          No photos yet. This gallery stays off the page until it has one.
        </p>
      )}

      {images.map((img, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
          {img.url && (
            <img src={img.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              className={field}
              value={img.url}
              placeholder="https://…"
              onChange={(e) => set(i, { url: e.target.value })}
            />
            <input
              className={field}
              value={img.caption ?? ''}
              placeholder="Caption (optional)"
              onChange={(e) => set(i, { caption: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(images.filter((_, n) => n !== i))}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Remove this photo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...images, { url: '' }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
      >
        <Plus className="h-3.5 w-3.5" /> Add a photo
      </button>
    </div>
  );
}
