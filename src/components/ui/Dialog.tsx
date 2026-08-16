import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/helpers';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Prevent closing on overlay click */
  persistent?: boolean;
}

export default function Dialog({ open, onClose, children, className, persistent }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={persistent ? undefined : onClose}
      />
      {/* Panel
       *
       * The height cap and column layout are what keep the footer reachable.
       * Without them a tall dialog simply grew past the viewport, and because
       * the panel is vertically centred it overflowed equally top and bottom —
       * putting the buttons off-screen with body scroll locked, so there was
       * no way to reach them at all. The body scrolls instead; header and
       * footer stay put.
       *
       * dvh rather than vh so mobile browser chrome is accounted for.
       */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col',
          'rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

export function DialogHeader({ children, onClose, className }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4', className)}>
      <div>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold text-slate-800', className)}>{children}</h2>;
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  // min-h-0 is required, not decorative: a flex child defaults to min-height
  // auto, which refuses to shrink below its content and would push the footer
  // out again even with the cap on the panel.
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // shrink-0 keeps the buttons at full height when the body is long;
        // without it flex would compress the footer before scrolling the body.
        'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}