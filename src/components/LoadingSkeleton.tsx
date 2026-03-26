/**
 * @file LoadingSkeleton.tsx
 * @description Pulsing skeleton loader for panels while data is being fetched.
 *
 * @example
 * ```tsx
 * if (isLoading) return <LoadingSkeleton lines={5} />;
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadingSkeletonProps {
  /**
   * Number of skeleton lines to render.
   *
   * @default 3
   */
  lines?: number;
  /**
   * When true, include a wider "header" line at the top.
   *
   * @default false
   */
  withHeader?: boolean;
  /** Additional CSS classes on the wrapper element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Generic pulsing skeleton placeholder.
 *
 * Lines vary in width to mimic real text content.
 */
export function LoadingSkeleton({
  lines = 3,
  withHeader = false,
  className = '',
}: LoadingSkeletonProps) {
  /** Cycle through a few widths so the skeleton looks natural. */
  const widths = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3', 'w-1/2'];

  return (
    <div
      className={`space-y-2 animate-pulse ${className}`}
      role="status"
      aria-label="Loading…"
    >
      {withHeader && (
        <div className="h-4 w-1/3 rounded-md bg-[color:var(--color-background-tertiary,theme(colors.slate.200))] dark:bg-white/10" />
      )}
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`h-3 rounded-md bg-[color:var(--color-background-tertiary,theme(colors.slate.200))] dark:bg-white/10 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card skeleton — for grid / card layouts
// ---------------------------------------------------------------------------

interface CardSkeletonProps {
  /** Number of cards to render. */
  count?: number;
  className?: string;
}

/**
 * Grid of card-shaped skeletons for list/card views.
 */
export function CardSkeleton({ count = 3, className = '' }: CardSkeletonProps) {
  return (
    <div className={`grid gap-3 ${className}`} role="status" aria-label="Loading…">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="card-panel--strong animate-pulse space-y-2 p-4 transition-theme"
        >
          <div className="h-4 w-1/2 rounded bg-[color:var(--color-background-tertiary,theme(colors.slate.200))] dark:bg-white/10" />
          <div className="h-3 w-full rounded bg-[color:var(--color-background-tertiary,theme(colors.slate.200))] dark:bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-[color:var(--color-background-tertiary,theme(colors.slate.200))] dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}
