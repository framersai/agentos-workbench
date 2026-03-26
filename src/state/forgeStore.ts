/**
 * @file forgeStore.ts
 * @description Zustand store for the {@link EmergentToolForge} panel.
 *
 * State shape:
 * ```
 * {
 *   requests:       ForgeRequest[]   -- forge queue with status lifecycle
 *   verdicts:       JudgeVerdict[]   -- judge scores and reasoning
 *   tools:          ForgedTool[]     -- registered tools across all tiers
 *   selectedToolId: string | null    -- tool selected in the test runner
 * }
 * ```
 *
 * Forge request lifecycle: `pending -> forging -> judging -> approved | rejected`
 *
 * Tool registry tiers:
 *   - **Session** -- ephemeral, available only in the current session.
 *   - **Agent**   -- persists across sessions for one agent.
 *   - **Shared**  -- globally available to all agents.
 *
 * Promotion path: Session -> Agent -> Shared (via `promoteTool()`).
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tier at which a forged tool lives after promotion. */
export type ForgeTier = 'session' | 'agent' | 'shared';

/** Lifecycle phase of a forge request. */
export type ForgeStatus = 'pending' | 'forging' | 'judging' | 'approved' | 'rejected';

export interface ForgeRequest {
  id: string;
  description: string;
  parametersSchema: string;
  status: ForgeStatus;
  submittedAt: number;
}

export interface JudgeVerdict {
  requestId: string;
  toolId: string;
  toolName: string;
  status: 'approved' | 'rejected';
  scores: {
    correctness: number;
    safety: number;
    efficiency: number;
  };
  reasoning: string;
  verdictAt: number;
}

export interface ForgedTool {
  id: string;
  name: string;
  description: string;
  tier: ForgeTier;
  callCount: number;
  successRate: number;
  avgLatencyMs: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Zustand state + actions for the EmergentToolForge. */
interface ForgeState {
  /** Forge request queue, newest first. */
  requests: ForgeRequest[];
  /** Judge verdicts for forge attempts, newest first. */
  verdicts: JudgeVerdict[];
  /** All registered forged tools across all tiers. */
  tools: ForgedTool[];
  /** Currently selected tool ID in the test runner (null if none). */
  selectedToolId: string | null;

  /** Prepend a new forge request to the queue. */
  addRequest: (req: ForgeRequest) => void;
  /** Update a request's status or other fields by ID. */
  updateRequest: (id: string, patch: Partial<ForgeRequest>) => void;
  /** Prepend a new judge verdict. */
  addVerdict: (verdict: JudgeVerdict) => void;
  /** Register a newly forged tool (prepended to the list). */
  addTool: (tool: ForgedTool) => void;
  /** Promote a tool to a higher tier (session -> agent -> shared). */
  promoteTool: (id: string, tier: ForgeTier) => void;
  /** Set the selected tool for the test runner tab. */
  setSelectedToolId: (id: string | null) => void;
  /** Replace the entire tools list (used after backend refresh). */
  setTools: (tools: ForgedTool[]) => void;
}

export const useForgeStore = create<ForgeState>((set) => ({
  requests: [],
  verdicts: [],
  tools: [],
  selectedToolId: null,

  addRequest: (req) =>
    set((s) => ({ requests: [req, ...s.requests] })),

  updateRequest: (id, patch) =>
    set((s) => ({
      requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  addVerdict: (verdict) =>
    set((s) => ({ verdicts: [verdict, ...s.verdicts] })),

  addTool: (tool) =>
    set((s) => ({ tools: [tool, ...s.tools] })),

  promoteTool: (id, tier) =>
    set((s) => ({
      tools: s.tools.map((t) => (t.id === id ? { ...t, tier } : t)),
    })),

  setSelectedToolId: (id) => set({ selectedToolId: id }),

  setTools: (tools) => set({ tools }),
}));
