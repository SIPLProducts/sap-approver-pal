import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonRowsProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Table-shaped skeleton loader. Drop into a `<div className="table-scroll">` wrapper if needed. */
export function SkeletonRows({ rows = 6, columns = 4, className }: SkeletonRowsProps) {
  return (
    <div className={cn("w-full space-y-2", className)} aria-busy="true" aria-live="polite">
      <div className="flex gap-3 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 py-2">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  className?: string;
}

/** KPI-tile-shaped skeleton grid. */
export function SkeletonCards({ count = 4, className }: SkeletonCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-32" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonRows;
