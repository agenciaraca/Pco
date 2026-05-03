import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'block';
}

export function Skeleton({ className, variant = 'block' }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gradient-to-r from-surface-gray via-surface-off to-surface-gray bg-[length:200%_100%]',
        variant === 'text' && 'h-3 rounded-md',
        variant === 'card' && 'h-32 rounded-2xl',
        variant === 'avatar' && 'h-9 w-9 rounded-full',
        variant === 'block' && 'rounded-xl',
        className,
      )}
    />
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton variant="text" className="w-48 h-6 mb-2" />
        <Skeleton variant="text" className="w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton variant="card" className="lg:col-span-2 h-72" />
        <Skeleton variant="card" className="h-72" />
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-56" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="pco-card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-gray bg-surface-off">
        <Skeleton variant="text" className="w-32" />
      </div>
      <ul className="divide-y divide-surface-gray">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 p-4">
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-1/3" />
              <Skeleton variant="text" className="w-1/2 h-2" />
            </div>
            <Skeleton variant="text" className="w-16" />
          </li>
        ))}
      </ul>
    </div>
  );
}
