/**
 * @file CapabilityDiscoveryBrowser.tsx
 * @description Browse and search discovered capabilities from the three-tier
 * discovery engine.
 *
 * Discovery tiers (matches {@link packages/agentos/src/discovery/}):
 *   - **Tier 0**: always-visible category summaries (~150 tokens).
 *   - **Tier 1**: top-5 semantic matches from search (~200 tokens).
 *   - **Tier 2**: full input schemas for selected capabilities (~1500 tokens).
 *
 * Search debouncing:
 *   A 350 ms debounce via `setTimeout` ref prevents excessive API calls on
 *   fast typing.  The debounce fires `GET /api/agency/capabilities?query=&kind=`.
 *
 * Assignment logic:
 *   Clicking "Assign to agency" appends the capability's ID to the active
 *   agency's `metadata.capabilities[]` array via {@link useSessionStore.updateAgency}.
 *   Already-assigned items are visually dimmed (opacity-60).
 *
 * Falls back to an empty state when the backend route is unavailable.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wrench,
  BookOpen,
  Puzzle,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { useSessionStore } from '@/state/sessionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapabilityKind = 'tool' | 'skill' | 'extension' | 'channel';

export interface CapabilityItem {
  id: string;
  name: string;
  kind: CapabilityKind;
  category?: string;
  description: string;
  /** Discovery tier: 0 = always visible, 1 = semantic match, 2 = full schema */
  tier: 0 | 1 | 2;
  /** JSON schema string for the capability's input parameters, if available. */
  schema?: string;
  /** A short usage example snippet. */
  usageExample?: string;
  /** IDs of other capabilities this one depends on. */
  dependencies?: string[];
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBaseUrl(): string {
  try {
    return resolveWorkbenchApiBaseUrl();
  } catch {
    return '';
  }
}

const KIND_ICON: Record<CapabilityKind, LucideIcon> = {
  tool: Wrench,
  skill: BookOpen,
  extension: Puzzle,
  channel: Package,
};

const KIND_COLORS: Record<CapabilityKind, string> = {
  tool: 'text-sky-400',
  skill: 'text-emerald-400',
  extension: 'text-violet-400',
  channel: 'text-amber-400',
};

const TIER_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: 'T0', cls: 'border-sky-500/30 bg-sky-500/15 text-sky-300' },
  1: { label: 'T1', cls: 'border-violet-500/30 bg-violet-500/15 text-violet-300' },
  2: { label: 'T2', cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' },
};

function TierBadge({ tier }: { tier: 0 | 1 | 2 }) {
  const { label, cls } = TIER_BADGE[tier] ?? TIER_BADGE[1]!;
  return (
    <span className={`rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Capability card
// ---------------------------------------------------------------------------

interface CapabilityCardProps {
  item: CapabilityItem;
  onAssign: (item: CapabilityItem) => void;
  agencyId: string | null;
}

function CapabilityCard({ item, onAssign, agencyId }: CapabilityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const KindIcon = KIND_ICON[item.kind] ?? Wrench;
  const kindColor = KIND_COLORS[item.kind] ?? 'theme-text-secondary';

  return (
    <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5 transition-colors hover:bg-white/[0.02]">
      {/* Summary row */}
      <div className="flex items-start gap-2">
        <KindIcon size={13} className={`mt-0.5 shrink-0 ${kindColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold theme-text-primary">{item.name}</span>
            <TierBadge tier={item.tier} />
            <span
              className={`rounded-full border border-current/30 bg-current/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${kindColor}`}
            >
              {item.kind}
            </span>
            {item.category && (
              <span className="rounded-full border theme-border px-1.5 py-px text-[9px] theme-text-muted uppercase tracking-wide">
                {item.category}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed theme-text-secondary">
            {item.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse capability details.' : 'Expand to see schema, example, and dependencies.'}
          className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t theme-border pt-2">
          {item.schema && (
            <div>
              <p className="mb-0.5 text-[9px] uppercase tracking-[0.35em] theme-text-muted">Schema</p>
              <pre className="overflow-auto rounded border theme-border theme-bg-primary px-2 py-1.5 font-mono text-[9px] theme-text-secondary max-h-32">
                {item.schema}
              </pre>
            </div>
          )}
          {item.usageExample && (
            <div>
              <p className="mb-0.5 text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                Usage Example
              </p>
              <pre className="overflow-auto rounded border theme-border theme-bg-primary px-2 py-1.5 font-mono text-[9px] theme-text-secondary max-h-24">
                {item.usageExample}
              </pre>
            </div>
          )}
          {item.dependencies && item.dependencies.length > 0 && (
            <div>
              <p className="mb-0.5 text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                Dependencies
              </p>
              <ul className="flex flex-wrap gap-1">
                {item.dependencies.map((dep) => (
                  <li
                    key={dep}
                    className="rounded-full border theme-border px-1.5 py-px font-mono text-[9px] theme-text-muted"
                  >
                    {dep}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {agencyId && (
            <button
              type="button"
              onClick={() => onAssign(item)}
              title={`Assign ${item.name} to the active agency's tool list.`}
              className="mt-1 inline-flex items-center gap-1 rounded-full border theme-border bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-400 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              + Assign to agency
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const KIND_FILTERS: Array<{ value: CapabilityKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tool', label: 'Tools' },
  { value: 'skill', label: 'Skills' },
  { value: 'extension', label: 'Extensions' },
  { value: 'channel', label: 'Channels' },
];

/**
 * CapabilityDiscoveryBrowser — search and browse the capability catalogue.
 *
 * Queries `GET /api/agency/capabilities?query=…&kind=…` on the backend.
 * Falls back to an empty list if the route is unavailable.
 */
export function CapabilityDiscoveryBrowser() {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<CapabilityKind | 'all'>('all');
  const [results, setResults] = useState<CapabilityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAgencyId = useSessionStore((s) => s.activeAgencyId);
  const updateAgency = useSessionStore((s) => s.updateAgency);
  const agencies = useSessionStore((s) => s.agencies);
  const activeAgency = agencies.find((a) => a.id === activeAgencyId) ?? null;

  const doSearch = useCallback(
    async (q: string, kind: CapabilityKind | 'all') => {
      setLoading(true);
      setError(null);
      try {
        const base = buildBaseUrl();
        const params = new URLSearchParams();
        if (q.trim()) params.set('query', q.trim());
        if (kind !== 'all') params.set('kind', kind);
        const url = `${base}/api/agency/capabilities?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { capabilities?: CapabilityItem[] };
        setResults(data.capabilities ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    void doSearch('', 'all');
  }, [doSearch]);

  // Debounced search on query/kind change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(query, kindFilter);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kindFilter, doSearch]);

  const handleAssign = (item: CapabilityItem) => {
    if (!activeAgencyId) return;
    // Record assignment in agency metadata
    const agency = agencies.find((a) => a.id === activeAgencyId);
    if (!agency) return;
    const existingCapabilities = Array.isArray(agency.metadata?.capabilities)
      ? (agency.metadata!.capabilities as string[])
      : [];
    if (existingCapabilities.includes(item.id)) return;
    updateAgency(activeAgencyId, {
      metadata: {
        ...agency.metadata,
        capabilities: [...existingCapabilities, item.id],
      },
    });
    setAssignedIds((prev) => new Set(prev).add(item.id));
  };

  const filteredResults = results.filter((r) =>
    kindFilter === 'all' ? true : r.kind === kindFilter
  );

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Agency</p>
            <h3 className="text-sm font-semibold theme-text-primary">Capability Browser</h3>
          </div>
          <HelpTooltip label="Explain capability discovery browser" side="bottom">
            Search and browse all discovered tools, skills, extensions, and channels. Click any entry
            to see its full schema and usage example. Use "Assign to agency" to add it to the active
            agency's capability set.
          </HelpTooltip>
        </div>
        <button
          type="button"
          onClick={() => void doSearch(query, kindFilter)}
          disabled={loading}
          title="Refresh the capability list from the backend."
          className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Search input */}
      <div className="relative mb-3">
        <Search
          size={12}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 theme-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search capabilities…"
          title="Search capabilities by name, description, or tags."
          className="w-full rounded-md border theme-border theme-bg-primary py-1.5 pl-7 pr-2 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* Kind filter chips */}
      <div className="mb-3 flex flex-wrap gap-1">
        {KIND_FILTERS.map(({ value, label }) => {
          const active = kindFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setKindFilter(value)}
              title={`Filter by ${label}.`}
              className={[
                'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-sky-500 text-white border-transparent'
                  : 'theme-border theme-text-secondary hover:bg-white/5',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active agency badge */}
      {activeAgency && (
        <p className="mb-2 text-[10px] theme-text-muted">
          Assigning to: <span className="font-semibold theme-text-secondary">{activeAgency.name}</span>
        </p>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-400">
          {error} — showing cached results.
        </div>
      )}

      {/* Results */}
      <div className="space-y-1.5">
        {filteredResults.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
            <Search size={20} className="theme-text-muted" aria-hidden="true" />
            <p className="text-xs theme-text-secondary">
              {query ? `No capabilities matching "${query}"` : 'No capabilities found.'}
            </p>
            <p className="text-[10px] theme-text-muted">
              The CapabilityDiscoveryEngine scans ~/.wunderland/capabilities/ for CAPABILITY.yaml
              files on startup.
            </p>
          </div>
        ) : (
          filteredResults.map((item) => (
            <div
              key={item.id}
              className={assignedIds.has(item.id) ? 'opacity-60' : undefined}
            >
              <CapabilityCard
                item={item}
                onAssign={handleAssign}
                agencyId={activeAgencyId}
              />
              {assignedIds.has(item.id) && (
                <p className="mt-0.5 pl-2 text-[9px] text-emerald-400">Assigned to agency</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Count footer */}
      {filteredResults.length > 0 && (
        <p className="mt-2 text-right text-[9px] theme-text-muted">
          {filteredResults.length} capability{filteredResults.length !== 1 ? 's' : ''}
        </p>
      )}
    </section>
  );
}
