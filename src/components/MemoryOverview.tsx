import { useEffect } from 'react';
import { Brain, Database, Cog, Gauge } from 'lucide-react';
import { useMemoryStore } from '@/state/memoryStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a CSS class string for a coloured dot based on working memory
 * token saturation level.
 *
 * @param pct - Token usage as a fraction in [0, 1].
 */
function healthDotClass(pct: number): string {
  if (pct > 0.95) return 'bg-red-500';
  if (pct > 0.80) return 'bg-yellow-400';
  return 'bg-green-500';
}

/**
 * Human-readable health label for the current token saturation level.
 *
 * @param pct - Token usage as a fraction in [0, 1].
 */
function healthLabel(pct: number): string {
  if (pct > 0.95) return 'At capacity';
  if (pct > 0.80) return 'Near capacity';
  return 'Healthy';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Props for a single memory tier summary card.
 */
interface TierCardProps {
  /** Lucide icon component to render in the card header. */
  icon: React.ReactNode;
  /** Display label for the memory tier. */
  label: string;
  /** Entry count to display (use undefined while loading). */
  count: number | undefined;
  /** Optional accent colour class applied to the icon wrapper. */
  accentClass?: string;
  /** Optional child content rendered below the count (e.g. token bar). */
  children?: React.ReactNode;
}

/**
 * A single memory tier summary card rendered inside the 2×2 grid.
 */
function TierCard({ icon, label, count, accentClass = 'text-accent', children }: TierCardProps) {
  return (
    <div className="rounded-lg border theme-border theme-bg-secondary p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={accentClass}>{icon}</span>
        <span className="text-xs font-semibold theme-text-primary uppercase tracking-wide">{label}</span>
      </div>
      {count !== undefined ? (
        <span className="text-2xl font-bold theme-text-primary">{count}</span>
      ) : (
        <span className="text-2xl font-bold theme-text-secondary">—</span>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Memory Overview sub-panel.
 *
 * Renders a 2×2 grid of summary cards for each cognitive memory tier
 * (episodic, semantic, procedural, working) plus a health indicator strip.
 *
 * Data is fetched from the backend on mount via {@link useMemoryStore}.
 */
export function MemoryOverview() {
  const { stats, working, fetchStats, fetchWorking, loading } = useMemoryStore();

  /** Fetch stats and working memory snapshot when the panel is first displayed. */
  useEffect(() => {
    fetchStats();
    fetchWorking();
  }, [fetchStats, fetchWorking]);

  const episodicCount  = (stats?.episodic  as { count?: number } | undefined)?.count;
  const semanticCount  = (stats?.semantic  as { count?: number } | undefined)?.count;
  const proceduralCount = (stats?.procedural as { count?: number } | undefined)?.count;
  const tokens    = (working?.tokens    as number | undefined) ?? 0;
  const maxTokens = (working?.maxTokens as number | undefined) ?? 1;
  const tokenPct  = Math.min(tokens / maxTokens, 1);
  const summary   = (working?.rollingSummary as string | undefined) ?? '';

  /**
   * Whether the backend is serving live data from the AgentOS runtime
   * or falling back to mock demonstration data.
   */
  const isConnected = Boolean(stats?.connected) || Boolean(working?.connected);

  return (
    <div className="flex flex-col gap-4">
      {/* Data source badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
        />
        <span className="text-xs font-medium theme-text-secondary">
          {isConnected ? 'Live Data' : 'Mock Data'}
        </span>
      </div>

      {/* 2x2 summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <TierCard
          icon={<Brain size={16} />}
          label="Episodic"
          count={episodicCount}
          accentClass="text-purple-400"
        />
        <TierCard
          icon={<Database size={16} />}
          label="Semantic"
          count={semanticCount}
          accentClass="text-blue-400"
        />
        <TierCard
          icon={<Cog size={16} />}
          label="Procedural"
          count={proceduralCount}
          accentClass="text-emerald-400"
        />
        <TierCard
          icon={<Gauge size={16} />}
          label="Working"
          count={undefined}
          accentClass="text-amber-400"
        >
          {/* Token usage bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-xs theme-text-secondary">
                {tokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              </span>
              <span className="text-xs theme-text-secondary">
                {Math.round(tokenPct * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full theme-bg-primary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tokenPct > 0.95
                    ? 'bg-red-500'
                    : tokenPct > 0.80
                    ? 'bg-yellow-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${tokenPct * 100}%` }}
              />
            </div>
            {/* Rolling summary preview */}
            {summary && (
              <p className="text-xs theme-text-secondary line-clamp-2 mt-1 leading-relaxed">
                {summary.length > 100 ? `${summary.slice(0, 100)}…` : summary}
              </p>
            )}
          </div>
        </TierCard>
      </div>

      {/* Health indicator strip */}
      <div className="flex items-center gap-2 rounded-lg border theme-border theme-bg-secondary px-3 py-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${healthDotClass(tokenPct)}`} />
        <span className="text-xs theme-text-primary font-medium">{healthLabel(tokenPct)}</span>
        <span className="text-xs theme-text-secondary ml-auto">
          {loading ? 'Refreshing…' : 'Context window health'}
        </span>
      </div>
    </div>
  );
}
