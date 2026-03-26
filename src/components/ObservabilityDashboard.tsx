/**
 * ObservabilityDashboard — metrics, cost, health, and tracing panel.
 *
 * Sub-tabs:
 *   Overview  — top-level KPI cards (tokens, cost, requests, latency, error rate).
 *   Usage     — daily token usage bar chart + per-provider cost table.
 *   Health    — provider status indicators.
 *   Errors    — recent error log.
 *   Spans     — OTEL trace span list.
 *   Budget    — monthly budget tracker.
 *
 * All state lives in {@link useObservabilityStore}.
 */

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  Zap,
  Clock,
  BarChart2,
  type LucideIcon,
} from 'lucide-react';
import {
  useObservabilityStore,
  type ProviderHealth,
  type ErrorLogEntry,
  type OtelSpan,
} from '@/state/observabilityStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type ObsSubTab = 'overview' | 'usage' | 'health' | 'errors' | 'spans' | 'budget';

const SUB_TABS: Array<{ key: ObsSubTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'usage',    label: 'Usage'    },
  { key: 'health',   label: 'Health'   },
  { key: 'errors',   label: 'Errors'   },
  { key: 'spans',    label: 'Spans'    },
  { key: 'budget',   label: 'Budget'   },
];

// ---------------------------------------------------------------------------
// Overview KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  Icon: LucideIcon;
  accent?: string;
}

function KpiCard({ label, value, sub, Icon, accent = 'text-sky-400' }: KpiCardProps) {
  return (
    <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon size={11} className={`shrink-0 ${accent}`} aria-hidden="true" />
        <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">{label}</p>
      </div>
      <p className="text-lg font-semibold leading-none theme-text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] theme-text-muted">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily token bar chart (pure div bars — no external chart lib)
// ---------------------------------------------------------------------------

interface BarChartProps {
  values: number[];
  label: string;
}

function MiniBarChart({ values, label }: BarChartProps) {
  const max = Math.max(...values, 1);
  const days = ['6d', '5d', '4d', '3d', '2d', '1d', 'Today'];

  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.35em] theme-text-muted">{label}</p>
      <div className="flex items-end gap-1 h-16">
        {values.map((v, i) => (
          <div key={days[i]} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t-sm bg-sky-500/60 transition-all"
              style={{ height: `${(v / max) * 56}px`, minHeight: '2px' }}
              title={`${days[i]}: ${v.toLocaleString()} tokens`}
            />
            <span className="text-[8px] theme-text-muted">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider cost table
// ---------------------------------------------------------------------------

function ProviderCostTable() {
  const summary = useObservabilityStore((s) => s.summary);
  if (!summary) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Provider Cost Breakdown</p>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b theme-border">
            <th className="pb-1 text-left font-semibold theme-text-muted">Provider</th>
            <th className="pb-1 text-right font-semibold theme-text-muted">Cost</th>
            <th className="pb-1 text-right font-semibold theme-text-muted">Requests</th>
          </tr>
        </thead>
        <tbody>
          {summary.providerCosts.map((row) => (
            <tr key={row.provider} className="border-b theme-border last:border-0">
              <td className="py-1.5 theme-text-primary">{row.provider}</td>
              <td className="py-1.5 text-right font-mono theme-text-primary">${row.costUsd.toFixed(2)}</td>
              <td className="py-1.5 text-right font-mono theme-text-secondary">{row.requestCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-1.5 font-semibold theme-text-secondary">Total</td>
            <td className="pt-1.5 text-right font-mono font-semibold theme-text-primary">
              ${summary.totalCostUsd.toFixed(2)}
            </td>
            <td className="pt-1.5 text-right font-mono theme-text-secondary">
              {summary.totalRequests.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider health row
// ---------------------------------------------------------------------------

const HEALTH_STYLES: Record<ProviderHealth['status'], { dot: string; label: string; text: string }> = {
  ok:       { dot: 'bg-emerald-400',  label: 'OK',       text: 'text-emerald-400'  },
  degraded: { dot: 'bg-amber-400',    label: 'Degraded', text: 'text-amber-400'    },
  down:     { dot: 'bg-rose-500 animate-pulse', label: 'Down', text: 'text-rose-400' },
};

function HealthRow({ ph }: { ph: ProviderHealth }) {
  const s = HEALTH_STYLES[ph.status];
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-1.5 text-[10px]">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
        <span className="font-medium theme-text-primary">{ph.provider}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-semibold ${s.text}`}>{s.label}</span>
        {ph.latencyMs > 0 && (
          <span className="font-mono theme-text-muted">{ph.latencyMs} ms</span>
        )}
        <time className="font-mono theme-text-muted" dateTime={ph.checkedAt}>
          {new Date(ph.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Error log row
// ---------------------------------------------------------------------------

function ErrorRow({ entry }: { entry: ErrorLogEntry }) {
  return (
    <li className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[10px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium theme-text-primary truncate">{entry.errorMessage}</p>
          <p className="mt-0.5 theme-text-muted">
            <span className="font-mono">{entry.provider}</span>
            {entry.statusCode && <span className="ml-2 text-rose-400">HTTP {entry.statusCode}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <time className="font-mono theme-text-muted block" dateTime={entry.timestamp}>
            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </time>
          <p className="font-mono text-[9px] theme-text-muted">{entry.requestId}</p>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// OTEL span row
// ---------------------------------------------------------------------------

const SPAN_STATUS_STYLES: Record<OtelSpan['status'], string> = {
  ok:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  unset: 'theme-border theme-bg-primary theme-text-muted',
};

function SpanRow({ span }: { span: OtelSpan }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-1.5 text-[10px]">
      <span className={`rounded-sm border px-1.5 py-px text-[9px] font-medium uppercase ${SPAN_STATUS_STYLES[span.status]}`}>
        {span.status}
      </span>
      <span className="flex-1 min-w-0 truncate font-mono theme-text-primary">{span.spanName}</span>
      <span className="shrink-0 font-mono theme-text-secondary">{span.durationMs} ms</span>
      <time className="shrink-0 font-mono text-[9px] theme-text-muted" dateTime={span.startedAt}>
        {new Date(span.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </time>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Budget tracker
// ---------------------------------------------------------------------------

function BudgetTracker() {
  const summary = useObservabilityStore((s) => s.summary);
  if (!summary) return null;

  const pct = Math.min(summary.monthSpentUsd / summary.monthlyBudgetUsd, 1);
  const daysInMonth = 30;
  const dayOfMonth = new Date().getDate();
  // Linear projection: spend / days_elapsed * total_days
  const projected = (summary.monthSpentUsd / dayOfMonth) * daysInMonth;
  const willOverrun = projected > summary.monthlyBudgetUsd;
  const barColor = pct >= 0.9 ? 'bg-rose-500' : pct >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Monthly Budget</p>
        <div className="flex items-center justify-between text-xs theme-text-secondary mb-1.5">
          <span>${summary.monthSpentUsd.toFixed(2)} spent</span>
          <span>${summary.monthlyBudgetUsd.toFixed(2)} budget</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full border theme-border theme-bg-primary">
          <div
            className={`h-full transition-all rounded-full ${barColor}`}
            style={{ width: `${pct * 100}%` }}
            role="progressbar"
            aria-valuenow={Math.round(pct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1 text-[10px] theme-text-muted">{Math.round(pct * 100)}% of budget used</p>
      </div>

      <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5 text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="theme-text-muted">Day of month</span>
          <span className="theme-text-primary">{dayOfMonth} / {daysInMonth}</span>
        </div>
        <div className="flex justify-between">
          <span className="theme-text-muted">Projected spend</span>
          <span className={`font-semibold ${willOverrun ? 'text-rose-400' : 'text-emerald-400'}`}>
            ${projected.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="theme-text-muted">Budget remaining</span>
          <span className="theme-text-primary">${Math.max(summary.monthlyBudgetUsd - summary.monthSpentUsd, 0).toFixed(2)}</span>
        </div>
      </div>

      {willOverrun && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-400">
          <AlertTriangle size={11} aria-hidden="true" />
          Projected spend (${projected.toFixed(2)}) exceeds monthly budget. Consider rate limiting.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ObservabilityDashboard — live metrics, cost, health, and tracing for AgentOS.
 *
 * Shows aggregated token / cost / request stats, per-provider cost breakdown,
 * provider health indicators, a recent error log, OTEL span list, and a
 * monthly budget tracker.
 */
export function ObservabilityDashboard() {
  const summary = useObservabilityStore((s) => s.summary);
  const errors  = useObservabilityStore((s) => s.errors);
  const spans   = useObservabilityStore((s) => s.spans);
  const loading = useObservabilityStore((s) => s.loading);
  const fetchAll    = useObservabilityStore((s) => s.fetchAll);
  const fetchErrors = useObservabilityStore((s) => s.fetchErrors);
  const fetchSpans  = useObservabilityStore((s) => s.fetchSpans);

  const [activeSubTab, setActiveSubTab] = useState<ObsSubTab>('overview');

  useEffect(() => {
    void fetchAll();
    void fetchErrors();
    void fetchSpans();
  }, [fetchAll, fetchErrors, fetchSpans]);

  const downCount = summary?.providerHealth.filter((p) => p.status === 'down').length ?? 0;
  const degradedCount = summary?.providerHealth.filter((p) => p.status === 'degraded').length ?? 0;

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Observability</p>
            <h3 className="text-sm font-semibold theme-text-primary">Dashboard</h3>
          </div>
          <HelpTooltip label="Explain observability dashboard" side="bottom">
            Aggregated metrics for all LLM provider calls, voice pipeline, and RAG requests.
            Demo data is shown when the backend observability endpoint is unavailable.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-2">
          {(downCount > 0 || degradedCount > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-400">
              <AlertTriangle size={9} aria-hidden="true" />
              {downCount > 0 ? `${downCount} down` : `${degradedCount} degraded`}
            </span>
          )}
          <button
            type="button"
            onClick={() => { void fetchAll(); void fetchErrors(); void fetchSpans(); }}
            disabled={loading}
            title="Refresh observability data"
            className="inline-flex items-center gap-1.5 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Sub-tab strip */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            title={`Open ${label} section`}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeSubTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Overview tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'overview' && summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KpiCard
              label="Total Tokens"
              value={summary.totalTokens >= 1_000_000
                ? `${(summary.totalTokens / 1_000_000).toFixed(2)}M`
                : `${(summary.totalTokens / 1000).toFixed(1)}K`}
              Icon={Zap}
              accent="text-sky-400"
            />
            <KpiCard
              label="Total Cost"
              value={`$${summary.totalCostUsd.toFixed(2)}`}
              sub="this month"
              Icon={DollarSign}
              accent="text-emerald-400"
            />
            <KpiCard
              label="Requests"
              value={summary.totalRequests.toLocaleString()}
              Icon={BarChart2}
              accent="text-violet-400"
            />
            <KpiCard
              label="Avg Latency"
              value={`${summary.avgLatencyMs} ms`}
              Icon={Clock}
              accent="text-amber-400"
            />
            <KpiCard
              label="Error Rate"
              value={`${(summary.errorRate * 100).toFixed(1)}%`}
              Icon={AlertTriangle}
              accent={summary.errorRate > 0.05 ? 'text-rose-400' : 'text-emerald-400'}
            />
            <KpiCard
              label="P99 Latency"
              value={`${summary.p99Ms} ms`}
              Icon={Activity}
              accent="text-orange-400"
            />
          </div>

          {/* Latency percentiles */}
          <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Latency Percentiles</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'P50', value: summary.p50Ms },
                { label: 'P95', value: summary.p95Ms },
                { label: 'P99', value: summary.p99Ms },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] theme-text-muted">{label}</p>
                  <p className="text-sm font-semibold theme-text-primary">{value} ms</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Usage tab                                                            */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'usage' && summary && (
        <div className="space-y-4">
          <MiniBarChart values={summary.dailyTokens} label="Daily Token Usage (last 7 days)" />
          <ProviderCostTable />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Health tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'health' && summary && (
        <div className="space-y-2">
          <p className="text-[10px] theme-text-muted mb-2">
            Provider health is checked periodically. Latency shown is from the last health probe.
          </p>
          <ul className="space-y-1.5" aria-label="Provider health">
            {summary.providerHealth.map((ph) => (
              <HealthRow key={ph.provider} ph={ph} />
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Errors tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'errors' && (
        <div className="space-y-2">
          {errors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <CheckCircle2 size={20} className="text-emerald-400" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No recent errors.</p>
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="Error log">
              {errors.map((e) => (
                <ErrorRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Spans tab                                                            */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'spans' && (
        <div className="space-y-2">
          <p className="text-[10px] theme-text-muted mb-1">
            Recent OpenTelemetry spans.  Enable OTEL in your AgentOS config to populate this list.
          </p>
          {spans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Activity size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-[10px] theme-text-muted">No spans recorded yet.</p>
            </div>
          ) : (
            <ul className="space-y-1" aria-label="OTEL spans">
              {spans.map((span) => (
                <SpanRow key={span.spanId} span={span} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Budget tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'budget' && <BudgetTracker />}
    </section>
  );
}
