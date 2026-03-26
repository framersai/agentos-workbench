/**
 * forgeStore — Zustand store for the EmergentToolForge panel.
 *
 * Tracks the forge request queue, judge verdicts, promoted tool registry,
 * and the selected tool for the test runner.
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

interface ForgeState {
  requests: ForgeRequest[];
  verdicts: JudgeVerdict[];
  tools: ForgedTool[];
  selectedToolId: string | null;

  addRequest: (req: ForgeRequest) => void;
  updateRequest: (id: string, patch: Partial<ForgeRequest>) => void;
  addVerdict: (verdict: JudgeVerdict) => void;
  addTool: (tool: ForgedTool) => void;
  promoteTool: (id: string, tier: ForgeTier) => void;
  setSelectedToolId: (id: string | null) => void;
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
