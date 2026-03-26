/**
 * EmergentToolForge — tool forging, judging, and registry browser.
 *
 * Sections (sub-tabs):
 *   Forge    — submit a tool description; shows in-progress queue.
 *   Verdicts — judge scores and reasoning for each forged tool.
 *   Registry — 3-tier browser (Session / Agent / Shared) with usage stats.
 *   Test     — select a forged tool, provide JSON input, see output.
 *
 * Backend routes used:
 *   POST /api/agency/forge           — submit a forge request.
 *   GET  /api/agency/forged-tools    — fetch all forged tools.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Hammer,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import {
  useForgeStore,
  type ForgeTier,
  type ForgeRequest,
  type ForgedTool,
  type JudgeVerdict,
} from '@/state/forgeStore';

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

function generateId(): string {
  return `forge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const TIER_LABELS: Record<ForgeTier, string> = {
  session: 'Session',
  agent: 'Agent',
  shared: 'Shared',
};

const TIER_COLORS: Record<ForgeTier, string> = {
  session: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  agent: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  shared: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

const STATUS_ICON: Record<ForgeRequest['status'], React.ReactNode> = {
  pending: <Loader2 size={11} className="animate-spin text-amber-400" />,
  forging: <Hammer size={11} className="text-violet-400 animate-pulse" />,
  judging: <Search size={11} className="text-sky-400 animate-pulse" />,
  approved: <CheckCircle2 size={11} className="text-emerald-400" />,
  rejected: <XCircle size={11} className="text-rose-400" />,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shows a single forge request row in the queue. */
function ForgeQueueRow({ req }: { req: ForgeRequest }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[req.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs theme-text-primary">{req.description}</p>
        <p className="text-[10px] theme-text-muted">
          {new Date(req.submittedAt).toLocaleTimeString()} · {req.status}
        </p>
      </div>
    </div>
  );
}

/** Renders a single judge verdict card. */
function VerdictCard({ verdict }: { verdict: JudgeVerdict }) {
  const approved = verdict.status === 'approved';
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2.5',
        approved
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-rose-500/30 bg-rose-500/5',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        {approved ? (
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
        ) : (
          <XCircle size={13} className="shrink-0 text-rose-400" />
        )}
        <p className="text-xs font-semibold theme-text-primary">{verdict.toolName}</p>
        <span
          className={[
            'ml-auto rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide',
            approved
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/15 text-rose-400',
          ].join(' ')}
        >
          {verdict.status}
        </span>
      </div>
      <div className="mt-1.5 flex gap-3 text-[10px]">
        <span className="theme-text-muted">
          Correct: <span className="font-semibold theme-text-primary">{verdict.scores.correctness}%</span>
        </span>
        <span className="theme-text-muted">
          Safety: <span className="font-semibold theme-text-primary">{verdict.scores.safety}%</span>
        </span>
        <span className="theme-text-muted">
          Efficiency: <span className="font-semibold theme-text-primary">{verdict.scores.efficiency}%</span>
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed theme-text-secondary">{verdict.reasoning}</p>
    </div>
  );
}

/** Renders a single tool card in the registry browser. */
function ToolRegistryCard({
  tool,
  onPromote,
  onSelect,
}: {
  tool: ForgedTool;
  onPromote: (id: string, tier: ForgeTier) => void;
  onSelect: (id: string) => void;
}) {
  const tierClass = TIER_COLORS[tool.tier] ?? '';
  const nextTier: Record<ForgeTier, ForgeTier | null> = {
    session: 'agent',
    agent: 'shared',
    shared: null,
  };
  const next = nextTier[tool.tier];

  return (
    <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Wrench size={12} className="mt-0.5 shrink-0 text-violet-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold theme-text-primary">{tool.name}</span>
            <span
              className={`rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${tierClass}`}
            >
              {TIER_LABELS[tool.tier]}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed theme-text-secondary">
            {tool.description}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-[10px] theme-text-muted">
            <span>Calls: <span className="font-semibold theme-text-primary">{tool.callCount}</span></span>
            <span>
              Success: <span className="font-semibold theme-text-primary">{tool.successRate}%</span>
            </span>
            <span>
              Avg latency: <span className="font-semibold theme-text-primary">{tool.avgLatencyMs}ms</span>
            </span>
            <span className="theme-text-muted">{new Date(tool.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(tool.id)}
          title={`Open ${tool.name} in the test runner`}
          className="rounded-full border theme-border bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-400 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Play size={9} className="inline-block mr-0.5" />
          Test
        </button>
        {next && (
          <button
            type="button"
            onClick={() => onPromote(tool.id, next)}
            title={`Promote ${tool.name} from ${tool.tier} to ${next}`}
            className="rounded-full border theme-border bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-400 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ArrowRight size={9} className="inline-block mr-0.5" />
            Promote to {TIER_LABELS[next]}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

type ForgeSubTab = 'forge' | 'verdicts' | 'registry' | 'test';

const FORGE_SUBTABS: Array<{ key: ForgeSubTab; label: string }> = [
  { key: 'forge', label: 'Forge' },
  { key: 'verdicts', label: 'Verdicts' },
  { key: 'registry', label: 'Registry' },
  { key: 'test', label: 'Test Runner' },
];

const REGISTRY_TIERS: ForgeTier[] = ['session', 'agent', 'shared'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * EmergentToolForge — forge new tools on demand, inspect judge verdicts,
 * browse the three-tier tool registry, and run forged tools interactively.
 *
 * POST /api/agency/forge          — submit a forge request.
 * GET  /api/agency/forged-tools   — list all forged tools.
 */
export function EmergentToolForge() {
  const [subTab, setSubTab] = useState<ForgeSubTab>('forge');
  const [registryTier, setRegistryTier] = useState<ForgeTier>('session');
  const [description, setDescription] = useState('');
  const [parametersSchema, setParametersSchema] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [testInput, setTestInput] = useState('{}');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requests = useForgeStore((s) => s.requests);
  const verdicts = useForgeStore((s) => s.verdicts);
  const tools = useForgeStore((s) => s.tools);
  const selectedToolId = useForgeStore((s) => s.selectedToolId);
  const addRequest = useForgeStore((s) => s.addRequest);
  const updateRequest = useForgeStore((s) => s.updateRequest);
  const addVerdict = useForgeStore((s) => s.addVerdict);
  const addTool = useForgeStore((s) => s.addTool);
  const promoteTool = useForgeStore((s) => s.promoteTool);
  const setSelectedToolId = useForgeStore((s) => s.setSelectedToolId);
  const setTools = useForgeStore((s) => s.setTools);

  const selectedTool = tools.find((t) => t.id === selectedToolId) ?? null;

  // Load forged tools on mount
  const loadTools = useCallback(async (silent = false) => {
    if (!silent) setLoadingTools(true);
    try {
      const base = buildBaseUrl();
      const res = await fetch(`${base}/api/agency/forged-tools`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tools?: ForgedTool[] };
      setTools(data.tools ?? []);
    } catch {
      // Backend may be unavailable in dev; keep existing tools
    } finally {
      setLoadingTools(false);
    }
  }, [setTools]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  // -------------------------------------------------------------------------
  // Forge request submission
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);
    const reqId = generateId();
    const req: ForgeRequest = {
      id: reqId,
      description: description.trim(),
      parametersSchema: parametersSchema.trim(),
      status: 'pending',
      submittedAt: Date.now(),
    };
    addRequest(req);
    setDescription('');
    setParametersSchema('');

    try {
      const base = buildBaseUrl();
      updateRequest(reqId, { status: 'forging' });
      const res = await fetch(`${base}/api/agency/forge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: req.description,
          parametersSchema: req.parametersSchema,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        tool?: ForgedTool;
        verdict?: JudgeVerdict;
        status?: string;
      };

      updateRequest(reqId, { status: data.verdict?.status ?? 'approved' });

      if (data.verdict) {
        addVerdict(data.verdict);
      }
      if (data.tool) {
        addTool(data.tool);
      }
      void loadTools(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Forge request failed.');
      updateRequest(reqId, { status: 'rejected' });
      // Provide a local stub verdict so the UI doesn't appear empty
      const stubVerdict: JudgeVerdict = {
        requestId: reqId,
        toolId: generateId(),
        toolName: req.description.slice(0, 32),
        status: 'rejected',
        scores: { correctness: 0, safety: 100, efficiency: 0 },
        reasoning: 'Backend unavailable — forge request could not be processed.',
        verdictAt: Date.now(),
      };
      addVerdict(stubVerdict);
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Test runner
  // -------------------------------------------------------------------------

  const handleTest = async () => {
    if (!selectedTool) return;
    setTestRunning(true);
    setTestOutput(null);
    setError(null);
    try {
      const base = buildBaseUrl();
      const res = await fetch(`${base}/api/agency/forged-tools/${selectedTool.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testInput,
      });
      const text = await res.text();
      setTestOutput(res.ok ? text : `Error ${res.status}: ${text}`);
    } catch (err) {
      setTestOutput(`[error] ${err instanceof Error ? err.message : 'Test run failed.'}`);
    } finally {
      setTestRunning(false);
    }
  };

  const tierTools = tools.filter((t) => t.tier === registryTier);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Tools</p>
            <h3 className="text-sm font-semibold theme-text-primary">Emergent Tool Forge</h3>
          </div>
          <HelpTooltip label="Explain tool forge" side="bottom">
            Describe a tool you need in natural language. The forge generates an implementation,
            submits it to the judge, and — if approved — registers it in the Session tier.
            Promote tools to Agent or Shared tiers as they prove reliable.
          </HelpTooltip>
        </div>
        <button
          type="button"
          onClick={() => void loadTools()}
          disabled={loadingTools}
          title="Refresh forged tool list from backend."
          className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[10px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RefreshCw size={9} className={loadingTools ? 'animate-spin' : ''} />
          {loadingTools ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-400">
          {error}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {FORGE_SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              subTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Forge tab                                                            */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'forge' && (
        <div className="space-y-4">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              What tool do you need?
            </p>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the tool in plain language, e.g. 'A tool that fetches the current weather for a given city using OpenWeatherMap'"
              title="Natural-language description of the tool to forge"
              className="w-full resize-none rounded-md border theme-border theme-bg-primary px-2.5 py-2 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Parameters Schema <span className="normal-case text-[9px] opacity-60">(optional JSON Schema)</span>
            </p>
            <textarea
              rows={3}
              value={parametersSchema}
              onChange={(e) => setParametersSchema(e.target.value)}
              placeholder={'{\n  "city": { "type": "string" }\n}'}
              title="JSON Schema for the tool's input parameters"
              className="w-full resize-none rounded-md border theme-border theme-bg-primary px-2.5 py-2 font-mono text-[10px] theme-text-primary focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !description.trim()}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-1.5 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {submitting ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Hammer size={10} />
            )}
            {submitting ? 'Forging…' : 'Forge Tool'}
          </button>

          {/* Forge queue */}
          {requests.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                Forge Queue
              </p>
              <div className="space-y-1.5">
                {requests.map((req) => (
                  <ForgeQueueRow key={req.id} req={req} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Verdicts tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'verdicts' && (
        <div className="space-y-2">
          {verdicts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Search size={18} className="theme-text-muted" />
              <p className="text-xs theme-text-secondary">No verdicts yet.</p>
              <p className="text-[10px] theme-text-muted">
                Submit a forge request to see judge verdicts here.
              </p>
            </div>
          ) : (
            verdicts.map((v) => <VerdictCard key={`${v.requestId}-${v.verdictAt}`} verdict={v} />)
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Registry tab                                                         */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'registry' && (
        <div className="space-y-3">
          {/* Tier tabs */}
          <div className="flex gap-0.5 rounded-lg border theme-border theme-bg-primary p-0.5">
            {REGISTRY_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setRegistryTier(tier)}
                className={[
                  'flex-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  registryTier === tier
                    ? 'bg-sky-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
                ].join(' ')}
              >
                {TIER_LABELS[tier]}
              </button>
            ))}
          </div>

          {/* Promotion tracker header */}
          <div className="flex items-center gap-1 text-[10px] theme-text-muted">
            <span className="text-sky-400">Session</span>
            <ArrowRight size={9} />
            <span className="text-violet-400">Agent</span>
            <ArrowRight size={9} />
            <span className="text-emerald-400">Shared</span>
          </div>

          {/* Tool cards */}
          {tierTools.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Wrench size={18} className="theme-text-muted" />
              <p className="text-xs theme-text-secondary">No {TIER_LABELS[registryTier]} tools.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tierTools.map((tool) => (
                <ToolRegistryCard
                  key={tool.id}
                  tool={tool}
                  onPromote={(id, tier) => {
                    promoteTool(id, tier);
                    void loadTools(true);
                  }}
                  onSelect={(id) => {
                    setSelectedToolId(id);
                    setSubTab('test');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Test Runner tab                                                      */}
      {/* ------------------------------------------------------------------ */}
      {subTab === 'test' && (
        <div className="space-y-3">
          {/* Tool selector */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Select Tool
            </p>
            {tools.length === 0 ? (
              <p className="text-[10px] theme-text-muted">No forged tools available.</p>
            ) : (
              <select
                value={selectedToolId ?? ''}
                onChange={(e) => setSelectedToolId(e.target.value || null)}
                title="Select a forged tool to test"
                className="w-full rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
              >
                <option value="">— select a tool —</option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} [{TIER_LABELS[t.tier]}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedTool && (
            <>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                  Test Input (JSON)
                </p>
                <textarea
                  rows={4}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  title="JSON input for the tool test run"
                  className="w-full resize-none rounded-md border theme-border theme-bg-primary px-2.5 py-2 font-mono text-[10px] theme-text-primary focus:border-sky-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testRunning}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-[10px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {testRunning ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Play size={10} />
                )}
                {testRunning ? 'Running…' : 'Run Test'}
              </button>

              {testOutput !== null && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                    Output
                  </p>
                  <pre className="overflow-auto rounded-lg border theme-border theme-bg-primary px-3 py-2 font-mono text-[10px] theme-text-secondary max-h-48">
                    {testOutput}
                  </pre>
                </div>
              )}

              {/* Usage stats for selected tool */}
              <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                  Usage Stats
                </p>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-center">
                    <p className="text-base font-bold theme-text-primary">{selectedTool.callCount}</p>
                    <p className="theme-text-muted">Calls</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold theme-text-primary">{selectedTool.successRate}%</p>
                    <p className="theme-text-muted">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold theme-text-primary">{selectedTool.avgLatencyMs}ms</p>
                    <p className="theme-text-muted">Avg latency</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
