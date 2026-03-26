/**
 * @file EmptyState.tsx
 * @description Reusable empty-state component with icon, title, description,
 * and an optional action button.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<Inbox className="h-8 w-8" />}
 *   title="No approvals pending"
 *   description="All HITL approval requests will appear here."
 *   actionLabel="Refresh"
 *   onAction={() => void refetch()}
 * />
 * ```
 */

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  /**
   * Icon element to display at the top.
   *
   * Render any Lucide icon or custom SVG here.  The component wraps it in a
   * muted coloured container.
   */
  icon?: ReactNode;
  /** Short heading. */
  title: string;
  /** Longer explanatory text. */
  description?: string;
  /** Label for the primary action button. Omit to hide the button. */
  actionLabel?: string;
  /** Callback fired when the action button is clicked. */
  onAction?: () => void;
  /** Additional CSS classes on the wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Empty-state placeholder.
 *
 * Renders a centred layout with an optional icon, title, description, and
 * action button.  Use inside panels when there is no content to show.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed theme-border p-8 text-center ${className}`}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-background-secondary)] theme-text-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium theme-text-primary">{title}</p>
        {description && (
          <p className="max-w-xs text-xs theme-text-secondary">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-3 py-1.5 text-xs theme-text-secondary transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
