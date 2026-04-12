import { cn } from '@/utils/helpers';

interface SkeletonProps {
  className?: string;
}

/** A pulsing placeholder block */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} />;
}

/** A skeleton row for table-like loading states */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === 0 ? 'w-1/4' : i === columns - 1 ? 'w-16' : 'flex-1')}
        />
      ))}
    </div>
  );
}

/** A skeleton card for grid loading states */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}