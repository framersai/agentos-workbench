/**
 * @file ErrorBoundary.tsx
 * @description React error boundary that catches render-time errors in child
 * component trees and shows a friendly recovery UI instead of a blank screen.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <SomePanel />
 * </ErrorBoundary>
 * ```
 *
 * An optional `label` prop is used in the heading so users know which panel
 * threw the error.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props / State
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** Content to render when no error has occurred. */
  children: ReactNode;
  /** Human-readable panel name shown in the error heading. */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Error fallback
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  error: Error | null;
  label?: string;
  onRetry: () => void;
}

function ErrorFallback({ error, label, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-rose-400" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-rose-400">
          {label ? `${label} encountered an error` : 'Something went wrong'}
        </p>
        {error && (
          <p className="mt-1 max-w-xs truncate text-xs theme-text-muted" title={error.message}>
            {error.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-3 py-1.5 text-xs theme-text-secondary transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------

/**
 * Class-based error boundary.
 *
 * React requires class components for error boundaries — function components
 * cannot implement `componentDidCatch` or `getDerivedStateFromError`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error in', this.props.label ?? 'unknown panel', error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          label={this.props.label}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
