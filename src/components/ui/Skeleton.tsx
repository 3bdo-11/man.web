import { cn } from '../../lib/cn.ts';

export function Skeleton({ className }: { className?: string; key?: string | number }) {
  return <div className={cn('skeleton', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-grid space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-2xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="w-16 h-10 rounded-xl" />
      </div>
    </div>
  );
}

export function ScoreCardSkeleton() {
  return (
    <div className="card p-grid flex items-center gap-4 bg-[var(--brand-card)] border-[var(--brand-border)]">
      <Skeleton className="w-10 h-10 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="w-16 h-16 rounded-full" />
    </div>
  );
}

export function RelapseCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--brand-card)] p-6 space-y-5 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="w-[88px] h-[88px] rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-20" />
      <div className="card p-grid space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-grid flex flex-col gap-grid mx-auto w-full max-w-app">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="text-center space-y-1">
          <Skeleton className="h-3 w-16 mx-auto" />
          <Skeleton className="h-4 w-28 mx-auto" />
        </div>
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
      {/* Day bar */}
      <CardSkeleton />
      {/* Score */}
      <ScoreCardSkeleton />
      {/* Relapse */}
      <RelapseCardSkeleton />
      {/* Prayer */}
      <SectionSkeleton />
      {/* Training */}
      <SectionSkeleton />
    </div>
  );
}
