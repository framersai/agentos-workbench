/**
 * @file HomeDashboard.tsx
 * @description Unified overview / landing page for the AgentOS Workbench.
 *
 * Sections:
 *   - KPI Cards    — active agencies, tokens today, open HITL approvals,
 *                    active voice calls
 *   - Recent Activity — event feed (runs, verdicts, channel messages, errors)
 *   - Quick Actions   — 6 navigation shortcuts
 *   - System Health   — provider status dots
 *   - Cost Trend      — 7-day bar chart of daily token spend
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bot,
  CheckCircle2,
  FileUp,
  Hammer,
  MessageSquare,
  Mic,
  Network,
  Package,
  Phone,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useSessionStore } from '@/state/sessionStore';
import { useHitlStore } from '@/state/hitlStore';
import { useVoiceCallStore } from '@/state/voiceCallStore';
import { useTelemetryStore } from '@/state/telemetryStore';
import { useEventBus } from '@/hooks/useEventBus';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  type: 'run' | 'verdict' | 'channel' | 'error' | 'hitl' | 'voice';
  label: string;
  detail?: string;
  timestamp: number;
  /** Navigation target when the item is clicked. */
  navKey?: string;
}

interface ProviderStatus {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline' | 'unconfigured';
}

interface CostDay {
  label: string; // e.g. 'Mon'
  tokens: number;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

const ACTIVITY_ICON: Record<ActivityItem['type'], typeof Activity> = {
  run: Bot,
  verdict: Hammer,
  channel: MessageSquare,
  error: XCircle,
  hitl: AlertTriangle,
  voice: Mic,
};

const ACTIVITY_COLOR: Record<ActivityItem['type'], string> = {
  run: 'text-sky-400',
  verdict: 'text-violet-400',
  channel: 'text-emerald-400',
  error: 'text-rose-400',
  hitl: 'text-amber-400',
  voice: 'text-teal-400',
};

/** Generate stable demo cost trend data for the last 7 days. */
function buildDemoCostTrend(): CostDay[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const dayIdx = (today - 6 + i + 7) % 7;
    const tokens = 2000 + Math.round(Math.sin(i * 0.9) * 1500 + Math.random() * 500);
    return { label: days[dayIdx], tokens, costUsd: (tokens / 1000) * 0.0005 };
  });
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, sub, alert, onClick }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-panel--strong flex flex-col gap-2 p-4 text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        alert ? 'border-rose-500/40' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            alert ? 'bg-rose-500/15 text-rose-400' : 'bg-[color:var(--color-background-secondary)] theme-text-muted'
          }`}
        >
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] theme-text-muted">{label}</span>
      </div>
      <div>
        <p
          className={`text-2xl font-bold leading-none ${
            alert ? 'text-rose-400' : 'theme-text-primary'
          }`}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[10px] theme-text-muted">{sub}</p>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cost trend bar chart (no external dep)
// ---------------------------------------------------------------------------

function CostTrendChart({ days }: { days: CostDay[] }) {
  const maxTokens = Math.max(...days.map((d) => d.tokens), 1);
  return (
    <div className="flex h-24 items-end gap-1.5">
      {days.map((day, i) => {
        const pct = day.tokens / maxTokens;
        const isToday = i === days.length - 1;
        return (
          <div key={day.label} className="flex flex-1 flex-col items-center gap-1" title={`${day.tokens.toLocaleString()} tok — $${day.costUsd.toFixed(4)}`}>
            <div
              className={`w-full rounded-t-sm transition-all duration-300 ${
                isToday
                  ? 'bg-[color:var(--color-accent-primary)]'
                  : 'bg-[color:var(--color-background-tertiary,theme(colors.slate.300))] dark:bg-white/20'
              }`}
              style={{ height: `${Math.max(pct * 80, 4)}px` }}
            />
            <span className={`text-[9px] ${isToday ? 'theme-text-primary font-semibold' : 'theme-text-muted'}`}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface HomeDashboardProps {
  /** Called when the user clicks a quick-action nav item. */
  onNavigate: (tabKey: string) => void;
}

/**
 * HomeDashboard — landing page shown when the workbench first opens.
 *
 * Wires into existing Zustand stores for live KPI data and subscribes to
 * the event bus for the activity feed.
 */
export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const agencies = useSessionStore((s) => s.agencies);
  const hitlPending = useHitlStore((s) => s.pending);
  const hitlLoading = useHitlStore((s) => s.loading);
  const fetchHitlPending = useHitlStore((s) => s.fetchPending);
  const activeCalls = useVoiceCallStore((s) => s.calls.filter((c) => !c.durationSeconds));
  const perSession = useTelemetryStore((s) => s.perSession);

  // Activity feed
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Provider statuses (fetched once)
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  // Cost trend (demo data until real API is wired)
  const [costDays] = useState<CostDay[]>(buildDemoCostTrend);

  // Aggregate tokens today across all sessions
  const tokensToday = Object.values(perSession).reduce(
    (sum, m) => sum + (m?.finalTokensTotal ?? 0),
    0
  );
  const costToday = Object.values(perSession).reduce((sum, m) => {
    const p = m?.finalTokensPrompt ?? 0;
    const c = m?.finalTokensCompletion ?? 0;
    return sum + (p / 1000) * 0.0005 + (c / 1000) * 0.0015;
  }, 0);

  // Push an activity item (capped at 50 items)
  const pushActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivity((prev) => [
      { ...item, id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() },
      ...prev,
    ].slice(0, 50));
  }, []);

  // Subscribe to real-time events
  useEventBus(
    'hitl:approval-needed',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'hitl', label: 'HITL approval needed', detail: String(d?.action ?? ''), navKey: 'hitl' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'forge:verdict',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'verdict', label: 'Tool forge verdict', detail: String(d?.toolName ?? ''), navKey: 'tool-forge' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'channel:message',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'channel', label: `${String(d?.channel ?? 'Channel')} message`, detail: String(d?.text ?? '').slice(0, 60), navKey: 'channels' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'agency:agent-start',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'run', label: `Agent started: ${String(d?.agentId ?? '')}`, navKey: 'agency' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'agency:agent-end',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'run', label: `Agent finished: ${String(d?.agentId ?? '')}`, navKey: 'agency' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'voice:transcript',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'voice', label: 'Voice transcript', detail: String(d?.text ?? '').slice(0, 60), navKey: 'call-monitor' });
      },
      [pushActivity]
    )
  );
  useEventBus(
    'error',
    useCallback(
      (data: unknown) => {
        const d = data as Record<string, unknown>;
        pushActivity({ type: 'error', label: 'Error', detail: String(d?.message ?? '') });
      },
      [pushActivity]
    )
  );

  // Fetch HITL pending count on mount
  useEffect(() => {
    void fetchHitlPending();
  }, [fetchHitlPending]);

  // Fetch provider statuses
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const baseUrl = (() => {
          try { return resolveWorkbenchApiBaseUrl(); } catch { return ''; }
        })();
        const res = await fetch(`${baseUrl}/api/system/status`);
        if (!res.ok) throw new Error('Non-OK');
        const json = await res.json() as {
          providers?: { configured?: string[]; defaultProvider?: string | null };
        };
        const configured = json?.providers?.configured ?? [];
        const KNOWN_PROVIDERS = [
          { id: 'openai', name: 'OpenAI' },
          { id: 'anthropic', name: 'Anthropic' },
          { id: 'google', name: 'Google' },
          { id: 'openrouter', name: 'OpenRouter' },
          { id: 'ollama', name: 'Ollama' },
        ];
        if (!mounted) return;
        setProviders(
          KNOWN_PROVIDERS.map((p) => ({
            ...p,
            status: configured.includes(p.id) ? 'online' : 'unconfigured',
          }))
        );
      } catch {
        if (mounted) {
          setProviders([
            { id: 'openai', name: 'OpenAI', status: 'unconfigured' },
            { id: 'anthropic', name: 'Anthropic', status: 'unconfigured' },
            { id: 'google', name: 'Google', status: 'unconfigured' },
            { id: 'openrouter', name: 'OpenRouter', status: 'unconfigured' },
            { id: 'ollama', name: 'Ollama', status: 'unconfigured' },
          ]);
        }
      } finally {
        if (mounted) setProvidersLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const STATUS_DOT: Record<ProviderStatus['status'], string> = {
    online: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    offline: 'bg-rose-400',
    unconfigured: 'bg-gray-400',
  };

  const QUICK_ACTIONS = [
    { key: 'agency', label: 'New Agency', icon: <Plus className="h-4 w-4" /> },
    { key: 'graph-builder', label: 'New Workflow', icon: <Network className="h-4 w-4" /> },
    { key: 'playground', label: 'Test Agent', icon: <Bot className="h-4 w-4" /> },
    { key: 'capabilities', label: 'Browse Extensions', icon: <Package className="h-4 w-4" /> },
    { key: 'tool-forge', label: 'Forge a Tool', icon: <Hammer className="h-4 w-4" /> },
    { key: 'rag-docs', label: 'Upload Documents', icon: <FileUp className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 overflow-y-auto h-full p-1">
      {/* KPI Cards */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Active Agencies"
            value={agencies.length}
            onClick={() => onNavigate('agency')}
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Tokens Today"
            value={tokensToday.toLocaleString()}
            sub={tokensToday > 0 ? `$${costToday.toFixed(4)}` : undefined}
            onClick={() => onNavigate('observability')}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="HITL Approvals"
            value={hitlLoading ? '…' : hitlPending.length}
            alert={hitlPending.length > 0}
            onClick={() => onNavigate('hitl')}
          />
          <KpiCard
            icon={<Phone className="h-4 w-4" />}
            label="Active Calls"
            value={activeCalls.length}
            onClick={() => onNavigate('call-monitor')}
          />
        </div>
      </section>

      {/* Middle row: activity + quick actions */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        {/* Recent Activity */}
        <section className="card-panel--strong flex flex-col gap-0 overflow-hidden" aria-label="Recent activity">
          <header className="flex items-center gap-2 border-b theme-border px-3 py-2">
            <Activity className="h-3.5 w-3.5 theme-text-muted" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => setActivity([])}
              className="ml-auto rounded p-0.5 theme-text-muted hover:theme-text-secondary transition-colors"
              title="Clear feed"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </header>
          <div className="max-h-56 overflow-y-auto divide-y theme-border">
            {activity.length === 0 && (
              <p className="px-3 py-4 text-center text-xs theme-text-muted">
                No events yet — events appear here in real time.
              </p>
            )}
            {activity.map((item) => {
              const Icon = ACTIVITY_ICON[item.type];
              const color = ACTIVITY_COLOR[item.type];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.navKey && onNavigate(item.navKey)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[color:var(--color-background-secondary)] transition-colors"
                >
                  <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs theme-text-primary">{item.label}</p>
                    {item.detail && (
                      <p className="truncate text-[10px] theme-text-muted">{item.detail}</p>
                    )}
                  </div>
                  <span className="flex-none text-[10px] theme-text-muted whitespace-nowrap">
                    {formatAgo(item.timestamp)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="card-panel--strong p-3" aria-label="Quick actions">
          <header className="mb-2 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 theme-text-muted" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
              Quick Actions
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-2 w-48">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => onNavigate(action.key)}
                className="flex flex-col items-center gap-1.5 rounded-lg border theme-border bg-[color:var(--color-background-secondary)] p-3 text-center text-[10px] theme-text-secondary transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="theme-text-primary">{action.icon}</span>
                <span className="leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom row: system health + cost trend */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* System Health */}
        <section className="card-panel--strong p-3" aria-label="System health">
          <header className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 theme-text-muted" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
              Provider Health
            </h2>
          </header>
          {providersLoading ? (
            <LoadingSkeleton lines={3} />
          ) : (
            <div className="flex flex-wrap gap-3">
              {providers.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[p.status]}`}
                    title={p.status}
                  />
                  <span className="theme-text-secondary">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cost Trend */}
        <section className="card-panel--strong p-3" aria-label="Cost trend">
          <header className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 theme-text-muted" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
              7-Day Token Spend
            </h2>
            <span className="ml-auto text-[10px] theme-text-muted">
              <BarChart2 className="inline h-3 w-3 mr-0.5" />
              demo data
            </span>
          </header>
          <CostTrendChart days={costDays} />
        </section>
      </div>
    </div>
  );
}
