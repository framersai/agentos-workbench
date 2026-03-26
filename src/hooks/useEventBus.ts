/**
 * @file useEventBus.ts
 * @description React hook for subscribing to {@link eventBus} events.
 *
 * Automatically unsubscribes when the component unmounts or when `event` /
 * `handler` change identity.  Wrap `handler` in `useCallback` to avoid
 * unnecessary re-subscriptions.
 *
 * @example
 * ```tsx
 * useEventBus('hitl:approval-needed', useCallback((data) => {
 *   setApprovals(prev => [...prev, data as PendingApprovalItem]);
 * }, []));
 * ```
 */

import { useEffect } from 'react';
import { eventBus, type WorkbenchEventName } from '@/lib/eventBus';

/**
 * Subscribe to a named workbench event.
 *
 * @param event   - The event name to listen for (e.g. `'hitl:approval-needed'`).
 * @param handler - Callback invoked with the event payload each time the event fires.
 *                  Memoize with `useCallback` to prevent stale closures.
 */
export function useEventBus(
  event: WorkbenchEventName,
  handler: (data: unknown) => void
): void {
  useEffect(() => {
    const unsub = eventBus.on(event, handler);
    return unsub;
  }, [event, handler]);
}
