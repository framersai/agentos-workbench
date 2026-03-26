/**
 * @file hitlStore.ts
 * @description Zustand store for the Human-in-the-Loop (HITL) approval queue.
 *
 * State shape:
 * ```
 * {
 *   pending:  PendingApprovalItem[]  -- items awaiting human decision
 *   history:  ApprovalHistoryItem[]  -- local session log (max 50)
 *   loading:  boolean                -- true during a poll
 *   error:    string | null          -- last fetch/submit error
 *   polling:  boolean                -- true when background interval is active
 * }
 * ```
 *
 * Polling lifecycle:
 *   1. `startPolling()` fires `fetchPending()` immediately, then every
 *      {@link POLL_INTERVAL_MS} (5 000 ms).
 *   2. `stopPolling()` clears the interval.
 *   3. `submitDecision(id, decision, modification?)` POSTs to
 *      `/api/agency/approvals/:id/decide`, optimistically removes the item
 *      from `pending`, and prepends it to `history`.
 *
 * History is capped at 50 entries to prevent unbounded memory growth.
 */

import { create } from 'zustand';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity level for a pending approval request. Maps to visual colour coding. */
export type ApprovalSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Possible human decisions for an approval request. */
export type ApprovalDecision = 'approved' | 'rejected';

export interface PendingApprovalItem {
  id: string;
  type: string;
  agentId: string;
  action: string;
  description: string;
  severity: ApprovalSeverity;
  context: Record<string, unknown>;
  reversible: boolean;
  requestedAt: string;
}

export interface ApprovalHistoryItem {
  id: string;
  type: string;
  agentId: string;
  action: string;
  description: string;
  decision: ApprovalDecision;
  modification?: string;
  decidedAt: string;
}

/** Zustand state + actions for the HITL approval queue. */
interface HitlState {
  /** Pending approvals fetched from the backend. */
  pending: PendingApprovalItem[];
  /** Local history of decisions made in this session (max 50). */
  history: ApprovalHistoryItem[];
  /** True while a poll request is in-flight. */
  loading: boolean;
  /** Last fetch or submit error message, or null. */
  error: string | null;
  /** True when the background poll interval is active. */
  polling: boolean;

  /** Fetch the current pending list once from `GET /api/agency/approvals`. */
  fetchPending: () => Promise<void>;
  /** Start background polling (every {@link POLL_INTERVAL_MS} ms). Idempotent. */
  startPolling: () => void;
  /** Stop background polling and clear the interval. Idempotent. */
  stopPolling: () => void;
  /**
   * Submit a decision for a pending approval item.
   * POSTs to `/api/agency/approvals/:id/decide` and optimistically
   * moves the item from pending to history.
   *
   * @param id           - The approval item ID.
   * @param decision     - 'approved' or 'rejected'.
   * @param modification - Optional text for approve-with-modifications.
   */
  submitDecision: (
    id: string,
    decision: ApprovalDecision,
    modification?: string
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
let pollHandle: ReturnType<typeof setInterval> | null = null;

function buildBaseUrl(): string {
  try {
    return resolveWorkbenchApiBaseUrl();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHitlStore = create<HitlState>((set, get) => ({
  pending: [],
  history: [],
  loading: false,
  error: null,
  polling: false,

  fetchPending: async () => {
    set({ loading: true, error: null });
    try {
      const baseUrl = buildBaseUrl();
      const res = await fetch(`${baseUrl}/api/agency/approvals`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { approvals?: PendingApprovalItem[] };
      set({ pending: data.approvals ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch approvals.',
        loading: false,
      });
    }
  },

  startPolling: () => {
    if (pollHandle !== null) return;
    const { fetchPending } = get();
    void fetchPending();
    pollHandle = setInterval(() => {
      void fetchPending();
    }, POLL_INTERVAL_MS);
    set({ polling: true });
  },

  stopPolling: () => {
    if (pollHandle !== null) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
    set({ polling: false });
  },

  submitDecision: async (id, decision, modification) => {
    const baseUrl = buildBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/agency/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, modification }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Optimistically remove from pending and add to history
      set((state) => {
        const item = state.pending.find((p) => p.id === id);
        const historyEntry: ApprovalHistoryItem | null = item
          ? {
              id: item.id,
              type: item.type,
              agentId: item.agentId,
              action: item.action,
              description: item.description,
              decision,
              modification,
              decidedAt: new Date().toISOString(),
            }
          : null;

        return {
          pending: state.pending.filter((p) => p.id !== id),
          history: historyEntry
            ? [historyEntry, ...state.history].slice(0, 50)
            : state.history,
          error: null,
        };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to submit decision.' });
    }
  },
}));
