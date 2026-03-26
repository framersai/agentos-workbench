/**
 * Observability routes — aggregated metrics, error log, and OTEL span list.
 *
 * Exposes:
 *   GET /api/observability/summary  — KPI summary (tokens, cost, latency, etc.)
 *   GET /api/observability/errors   — recent backend error events
 *   GET /api/observability/spans    — recent OTEL trace spans
 *
 * In the workbench context, all data is synthetic/demo.  A production integration
 * would read from a telemetry store (e.g. ClickHouse, Prometheus, Jaeger).
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderCost {
  provider: string;
  costUsd: number;
  requestCount: number;
}

interface ProviderHealth {
  provider: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  checkedAt: string;
}

interface ObsSummary {
  totalTokens: number;
  totalCostUsd: number;
  totalRequests: number;
  avgLatencyMs: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  computedAt: string;
  monthlyBudgetUsd: number;
  monthSpentUsd: number;
  dailyTokens: number[];
  providerCosts: ProviderCost[];
  providerHealth: ProviderHealth[];
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  errorMessage: string;
  requestId: string;
  statusCode?: number;
}

interface OtelSpan {
  spanId: string;
  spanName: string;
  durationMs: number;
  status: 'ok' | 'error' | 'unset';
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Demo data helpers
// ---------------------------------------------------------------------------

function buildSummary(): ObsSummary {
  const now = Date.now();
  // Vary numbers slightly per call to simulate live refresh.
  const jitter = () => Math.floor(Math.random() * 50);
  return {
    totalTokens:    1_482_310 + jitter() * 100,
    totalCostUsd:   4.73 + (Math.random() * 0.02),
    totalRequests:  2_841 + jitter(),
    avgLatencyMs:   380 + jitter(),
    errorRate:      0.012,
    p50Ms:          310 + jitter(),
    p95Ms:          820 + jitter(),
    p99Ms:          1450 + jitter(),
    computedAt:     new Date(now).toISOString(),
    monthlyBudgetUsd: 20,
    monthSpentUsd:  4.73 + (Math.random() * 0.02),
    dailyTokens:    [82_000, 95_000, 110_000, 178_000, 204_000, 312_000, 501_310 + jitter() * 1000],
    providerCosts: [
      { provider: 'OpenAI',     costUsd: 2.18, requestCount: 1_420 },
      { provider: 'Anthropic',  costUsd: 1.42, requestCount:   830 },
      { provider: 'Deepgram',   costUsd: 0.74, requestCount:   391 },
      { provider: 'ElevenLabs', costUsd: 0.39, requestCount:   200 },
    ],
    providerHealth: [
      { provider: 'OpenAI',     status: 'ok',       latencyMs: 312 + jitter(), checkedAt: new Date(now - 30_000).toISOString() },
      { provider: 'Anthropic',  status: 'degraded', latencyMs: 890 + jitter(), checkedAt: new Date(now - 30_000).toISOString() },
      { provider: 'Deepgram',   status: 'ok',       latencyMs: 145 + jitter(), checkedAt: new Date(now - 30_000).toISOString() },
      { provider: 'ElevenLabs', status: 'ok',       latencyMs: 203 + jitter(), checkedAt: new Date(now - 30_000).toISOString() },
      { provider: 'Qdrant',     status: 'down',     latencyMs: 0,              checkedAt: new Date(now - 30_000).toISOString() },
    ],
  };
}

function buildErrors(): ErrorLogEntry[] {
  const now = Date.now();
  return [
    { id: 'err-1', timestamp: new Date(now - 2 * 60_000).toISOString(),  provider: 'Anthropic', errorMessage: 'Rate limit exceeded (429)',           requestId: 'req_a1b2', statusCode: 429 },
    { id: 'err-2', timestamp: new Date(now - 8 * 60_000).toISOString(),  provider: 'OpenAI',    errorMessage: 'Context length exceeded (max_tokens)', requestId: 'req_c3d4', statusCode: 400 },
    { id: 'err-3', timestamp: new Date(now - 18 * 60_000).toISOString(), provider: 'Qdrant',    errorMessage: 'Connection refused',                   requestId: 'req_e5f6' },
  ];
}

function buildSpans(): OtelSpan[] {
  const now = Date.now();
  return [
    { spanId: 'sp-001', spanName: 'agentos.chat.stream',       durationMs: 1420, status: 'ok',    startedAt: new Date(now - 1 * 60_000).toISOString() },
    { spanId: 'sp-002', spanName: 'guardrail.pii.evaluate',    durationMs:   42, status: 'ok',    startedAt: new Date(now - 1 * 60_000 + 100).toISOString() },
    { spanId: 'sp-003', spanName: 'rag.retrieval.search',      durationMs:  188, status: 'ok',    startedAt: new Date(now - 2 * 60_000).toISOString() },
    { spanId: 'sp-004', spanName: 'tool.web_search.execute',   durationMs:  910, status: 'error', startedAt: new Date(now - 5 * 60_000).toISOString() },
    { spanId: 'sp-005', spanName: 'agentos.agency.workflow',   durationMs: 8320, status: 'ok',    startedAt: new Date(now - 10 * 60_000).toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Registers observability routes on the provided Fastify instance.
 * Intended to be mounted at `/api/observability` in the main server.
 *
 * @param fastify - Fastify server instance.
 */
export default async function observabilityRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/observability/summary */
  fastify.get('/summary', {
    schema: {
      description: 'Return aggregated observability metrics summary',
      tags: ['Observability'],
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async () => {
    return buildSummary();
  });

  /** GET /api/observability/errors */
  fastify.get('/errors', {
    schema: {
      description: 'Return recent backend error events',
      tags: ['Observability'],
      response: {
        200: {
          type: 'object',
          properties: {
            errors: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async () => {
    return { errors: buildErrors() };
  });

  /** GET /api/observability/spans */
  fastify.get('/spans', {
    schema: {
      description: 'Return recent OpenTelemetry trace spans',
      tags: ['Observability'],
      response: {
        200: {
          type: 'object',
          properties: {
            spans: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async () => {
    return { spans: buildSpans() };
  });
}
