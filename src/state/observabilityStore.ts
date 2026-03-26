/**
 * observabilityStore — Zustand store for the ObservabilityDashboard panel.
 *
 * Holds aggregated metrics, error logs, OTEL spans, and budget data.
 * Data is fetched from:
 *   GET /api/observability/summary
 *   GET /api/observability/errors
 *   GET /api/observability/spans
 */

import { create } from 'zustand';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Top-level aggregated summary stats for the dashboard overview cards.
 */
export interface ObsSummary {
  totalTokens: number;
  totalCostUsd: number;
  totalRequests: number;
  avgLatencyMs: number;
  errorRate: number;
  /** P50 latency in ms. */
  p50Ms: number;
  /** P95 latency in ms. */
  p95Ms: number;
  /** P99 latency in ms. */
  p99Ms: number;
  /** ISO-8601 string of when this summary was last computed. */
  computedAt: string;
  /** Monthly budget in USD, if configured. */
  monthlyBudgetUsd: number;
  /** Amount spent this calendar month in USD. */
  monthSpentUsd: number;
  /** Daily token usage for the last 7 days, newest last. */
  dailyTokens: number[];
  /** Per-provider cost breakdown. */
  providerCosts: ProviderCost[];
  /** Per-provider health status. */
  providerHealth: ProviderHealth[];
}

export interface ProviderCost {
  /** Provider id, e.g. "openai", "anthropic". */
  provider: string;
  /** Cost in USD this month. */
  costUsd: number;
  /** Number of requests this month. */
  requestCount: number;
}

export interface ProviderHealth {
  provider: string;
  /** "ok" | "degraded" | "down" */
  status: 'ok' | 'degraded' | 'down';
  /** Avg latency ms from last health check. */
  latencyMs: number;
  /** ISO-8601 of last check. */
  checkedAt: string;
}

/**
 * A single backend error event.
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  errorMessage: string;
  requestId: string;
  statusCode?: number;
}

/**
 * A single OpenTelemetry span (simplified for display).
 */
export interface OtelSpan {
  spanId: string;
  spanName: string;
  /** Duration in ms. */
  durationMs: number;
  /** "ok" | "error" | "unset" */
  status: 'ok' | 'error' | 'unset';
  /** ISO-8601 start time. */
  startedAt: string;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface ObservabilityState {
  summary: ObsSummary | null;
  errors: ErrorLogEntry[];
  spans: OtelSpan[];
  loading: boolean;
  error: string | null;

  // --- Actions ---
  fetchAll: () => Promise<void>;
  fetchErrors: () => Promise<void>;
  fetchSpans: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const NOW = Date.now();

const DEMO_SUMMARY: ObsSummary = {
  totalTokens: 1_482_310,
  totalCostUsd: 4.73,
  totalRequests: 2_841,
  avgLatencyMs: 387,
  errorRate: 0.012,
  p50Ms: 310,
  p95Ms: 820,
  p99Ms: 1450,
  computedAt: new Date(NOW).toISOString(),
  monthlyBudgetUsd: 20,
  monthSpentUsd: 4.73,
  dailyTokens: [82_000, 95_000, 110_000, 178_000, 204_000, 312_000, 501_310],
  providerCosts: [
    { provider: 'OpenAI',    costUsd: 2.18, requestCount: 1_420 },
    { provider: 'Anthropic', costUsd: 1.42, requestCount:   830 },
    { provider: 'Deepgram',  costUsd: 0.74, requestCount:   391 },
    { provider: 'ElevenLabs',costUsd: 0.39, requestCount:   200 },
  ],
  providerHealth: [
    { provider: 'OpenAI',    status: 'ok',       latencyMs: 312, checkedAt: new Date(NOW - 30_000).toISOString() },
    { provider: 'Anthropic', status: 'degraded', latencyMs: 890, checkedAt: new Date(NOW - 30_000).toISOString() },
    { provider: 'Deepgram',  status: 'ok',       latencyMs: 145, checkedAt: new Date(NOW - 30_000).toISOString() },
    { provider: 'ElevenLabs',status: 'ok',       latencyMs: 203, checkedAt: new Date(NOW - 30_000).toISOString() },
    { provider: 'Qdrant',    status: 'down',     latencyMs: 0,   checkedAt: new Date(NOW - 30_000).toISOString() },
  ],
};

const DEMO_ERRORS: ErrorLogEntry[] = [
  { id: 'err-1', timestamp: new Date(NOW - 2 * 60_000).toISOString(),  provider: 'Anthropic', errorMessage: 'Rate limit exceeded (429)',           requestId: 'req_a1b2', statusCode: 429 },
  { id: 'err-2', timestamp: new Date(NOW - 8 * 60_000).toISOString(),  provider: 'OpenAI',    errorMessage: 'Context length exceeded (max_tokens)', requestId: 'req_c3d4', statusCode: 400 },
  { id: 'err-3', timestamp: new Date(NOW - 18 * 60_000).toISOString(), provider: 'Qdrant',    errorMessage: 'Connection refused',                   requestId: 'req_e5f6' },
];

const DEMO_SPANS: OtelSpan[] = [
  { spanId: 'sp-001', spanName: 'agentos.chat.stream',       durationMs: 1420, status: 'ok',    startedAt: new Date(NOW - 1 * 60_000).toISOString() },
  { spanId: 'sp-002', spanName: 'guardrail.pii.evaluate',    durationMs:   42, status: 'ok',    startedAt: new Date(NOW - 1 * 60_000 + 100).toISOString() },
  { spanId: 'sp-003', spanName: 'rag.retrieval.search',      durationMs:  188, status: 'ok',    startedAt: new Date(NOW - 2 * 60_000).toISOString() },
  { spanId: 'sp-004', spanName: 'tool.web_search.execute',   durationMs:  910, status: 'error', startedAt: new Date(NOW - 5 * 60_000).toISOString() },
  { spanId: 'sp-005', spanName: 'agentos.agency.workflow',   durationMs: 8320, status: 'ok',    startedAt: new Date(NOW - 10 * 60_000).toISOString() },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useObservabilityStore = create<ObservabilityState>()((set) => ({
  summary: DEMO_SUMMARY,
  errors: DEMO_ERRORS,
  spans: DEMO_SPANS,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/observability/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ObsSummary;
      set({ loading: false, summary: data });
    } catch {
      set({ loading: false, summary: DEMO_SUMMARY });
    }
  },

  fetchErrors: async () => {
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/observability/errors`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { errors: ErrorLogEntry[] };
      set({ errors: data.errors ?? DEMO_ERRORS });
    } catch {
      set({ errors: DEMO_ERRORS });
    }
  },

  fetchSpans: async () => {
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/observability/spans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { spans: OtelSpan[] };
      set({ spans: data.spans ?? DEMO_SPANS });
    } catch {
      set({ spans: DEMO_SPANS });
    }
  },
}));
