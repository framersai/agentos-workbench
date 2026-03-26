/**
 * @file PromptWorkspace.tsx
 * @description Prompt engineering workspace with side-by-side comparison,
 * version history, diff view, and template library.
 *
 * Layout:
 *   Split view  — two panes (A and B), each with system prompt + user prompt + run button
 *   Comparison  — run the same user prompt against both system prompts in parallel
 *   History     — saved runs with pin / diff selection
 *   Templates   — pre-built system prompt templates
 *
 * Backend: `POST /api/playground/compare` (for comparison mode)
 *          `POST /api/playground/run` (for single-pane runs via SSE)
 */

import { useCallback, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  Copy,
  GitBranch,
  Loader2,
  Pin,
  Play,
  RotateCcw,
  Star,
} from 'lucide-react';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { EmptyState } from '@/components/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaneConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
}

interface RunResult {
  text: string;
  toolCallCount: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  latencyMs: number;
  error?: string;
}

interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  userPrompt: string;
  configA: PaneConfig;
  configB?: PaneConfig;
  resultA?: RunResult;
  resultB?: RunResult;
  pinned: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'claude-3-haiku',
  'claude-3-5-sonnet',
  'claude-sonnet-4',
];

const PROMPT_TEMPLATES: { name: string; system: string }[] = [
  {
    name: 'Researcher',
    system:
      'You are a meticulous researcher. Always cite sources, use bullet points for findings, and highlight uncertainty. Prefer breadth before depth.',
  },
  {
    name: 'Writer',
    system:
      'You are a professional writer. Write with clarity, brevity, and vivid language. Adapt tone to the audience. Avoid jargon unless requested.',
  },
  {
    name: 'Analyst',
    system:
      'You are a data analyst. Provide structured analysis with key metrics first, then reasoning. Use tables and numbered lists where helpful.',
  },
  {
    name: 'Coder',
    system:
      'You are an expert software engineer. Write clean, idiomatic code with concise inline comments. Prefer readability over cleverness. Always explain your solution briefly.',
  },
  {
    name: 'Customer Service',
    system:
      'You are a friendly customer service agent. Be empathetic, concise, and solution-oriented. Always acknowledge the user\'s feeling before suggesting a fix.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `pw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001';
  return `$${usd.toFixed(4)}`;
}

function formatAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  return `${Math.round(d / 3_600_000)}h ago`;
}

// ---------------------------------------------------------------------------
// Simple inline diff (word-level)
// ---------------------------------------------------------------------------

function computeWordDiff(a: string, b: string): Array<{ text: string; status: 'same' | 'add' | 'remove' }> {
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  // Very naive LCS-based diff — good enough for prompt comparison
  const result: Array<{ text: string; status: 'same' | 'add' | 'remove' }> = [];
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  for (const w of wordsA) {
    if (setB.has(w)) result.push({ text: w, status: 'same' });
    else result.push({ text: w, status: 'remove' });
  }
  for (const w of wordsB) {
    if (!setA.has(w)) result.push({ text: w, status: 'add' });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Metrics row for a run result. */
function ResultMetrics({ result }: { result: RunResult }) {
  return (
    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] theme-text-muted border-t theme-border pt-1">
      <div><dt className="inline">Prompt</dt> <dd className="inline theme-text-secondary">{result.usage.promptTokens} tok</dd></div>
      <div><dt className="inline">Completion</dt> <dd className="inline theme-text-secondary">{result.usage.completionTokens} tok</dd></div>
      <div><dt className="inline">Cost</dt> <dd className="inline theme-text-secondary">{formatCost(result.usage.estimatedCostUsd)}</dd></div>
      <div><dt className="inline">Latency</dt> <dd className="inline theme-text-secondary">{result.latencyMs}ms</dd></div>
    </dl>
  );
}

/** Single prompt pane. */
function PromptPane({
  paneLabel,
  config,
  onChange,
  userPrompt,
  onUserPromptChange,
  result,
  isRunning,
  onRun,
  onApplyTemplate,
}: {
  paneLabel: string;
  config: PaneConfig;
  onChange: (c: PaneConfig) => void;
  userPrompt: string;
  onUserPromptChange: (v: string) => void;
  result?: RunResult;
  isRunning: boolean;
  onRun: () => void;
  onApplyTemplate: (sys: string) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="flex flex-1 min-w-0 flex-col gap-2">
      {/* Pane header */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-[color:var(--color-accent-primary)] px-2 py-0.5 text-[10px] font-bold text-white">
          {paneLabel}
        </span>
        <select
          value={config.model}
          onChange={(e) => onChange({ ...config, model: e.target.value })}
          className="rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[10px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-[10px] theme-text-muted">temp</span>
        <input
          type="number"
          min={0} max={2} step={0.1}
          value={config.temperature}
          onChange={(e) => onChange({ ...config, temperature: Number(e.target.value) })}
          className="w-12 rounded border theme-border bg-[color:var(--color-background-secondary)] px-1 py-0.5 text-[10px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[10px] theme-text-muted hover:theme-text-secondary transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Templates
        </button>
      </div>

      {/* Template picker */}
      {showTemplates && (
        <div className="rounded border theme-border bg-[color:var(--color-background-secondary)] p-2 flex flex-wrap gap-1.5">
          {PROMPT_TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => { onApplyTemplate(t.system); setShowTemplates(false); }}
              className="rounded-full border theme-border px-2 py-0.5 text-[10px] theme-text-secondary hover:theme-text-primary transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* System prompt */}
      <textarea
        value={config.systemPrompt}
        onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
        rows={5}
        placeholder="System prompt…"
        className="resize-none rounded-lg border theme-border bg-[color:var(--color-background-secondary)] p-2 font-mono text-[11px] theme-text-primary placeholder:theme-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      {/* User prompt */}
      <textarea
        value={userPrompt}
        onChange={(e) => onUserPromptChange(e.target.value)}
        rows={3}
        placeholder="User prompt…"
        className="resize-none rounded-lg border theme-border bg-[color:var(--color-background-secondary)] p-2 text-xs theme-text-primary placeholder:theme-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      {/* Run button */}
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning || !userPrompt.trim()}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-accent-primary)] py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {isRunning ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>
        ) : (
          <><Play className="h-3.5 w-3.5" /> Run</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-lg border theme-border p-2 text-xs">
          {result.error ? (
            <p className="text-rose-400">Error: {result.error}</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap leading-relaxed theme-text-primary">{result.text}</p>
              <ResultMetrics result={result} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type WorkspaceTab = 'compare' | 'history' | 'diff';

/**
 * PromptWorkspace — prompt engineering panel with A/B comparison,
 * version history, and diff view.
 */
export function PromptWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('compare');

  // Pane configs
  const [configA, setConfigA] = useState<PaneConfig>({
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'gpt-4o-mini',
    temperature: 0.7,
  });
  const [configB, setConfigB] = useState<PaneConfig>({
    systemPrompt: 'You are a concise AI assistant. Keep answers to 3 sentences maximum.',
    model: 'gpt-4o-mini',
    temperature: 0.3,
  });

  // Shared user prompt
  const [userPrompt, setUserPrompt] = useState('');

  // Results
  const [resultA, setResultA] = useState<RunResult | undefined>();
  const [resultB, setResultB] = useState<RunResult | undefined>();
  const [runningA, setRunningA] = useState(false);
  const [runningB, setRunningB] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Diff selection
  const [diffIdA, setDiffIdA] = useState<string | null>(null);
  const [diffIdB, setDiffIdB] = useState<string | null>(null);

  const baseUrl = (() => {
    try { return resolveWorkbenchApiBaseUrl(); } catch { return ''; }
  })();

  // Run a single pane via the compare endpoint (reuses both results at once)
  const runCompare = useCallback(async () => {
    if (!userPrompt.trim()) return;
    setRunningA(true);
    setRunningB(true);
    setResultA(undefined);
    setResultB(undefined);
    try {
      const res = await fetch(`${baseUrl}/api/playground/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, configA, configB }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { resultA: RunResult; resultB: RunResult };
      setResultA(json.resultA);
      setResultB(json.resultB);

      // Save to history
      const entry: HistoryEntry = {
        id: generateId(),
        label: userPrompt.slice(0, 40) + (userPrompt.length > 40 ? '…' : ''),
        timestamp: Date.now(),
        userPrompt,
        configA,
        configB,
        resultA: json.resultA,
        resultB: json.resultB,
        pinned: false,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 100));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResultA({ text: '', toolCallCount: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }, latencyMs: 0, error: msg });
      setResultB({ text: '', toolCallCount: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }, latencyMs: 0, error: msg });
    } finally {
      setRunningA(false);
      setRunningB(false);
    }
  }, [userPrompt, configA, configB, baseUrl]);

  /** Run only pane A individually (SSE). */
  const runSingle = useCallback(async (
    pane: 'A' | 'B',
    config: PaneConfig,
    setRunning: (v: boolean) => void,
    setResult: (r: RunResult) => void
  ) => {
    if (!userPrompt.trim()) return;
    setRunning(true);
    let text = '';
    try {
      const res = await fetch(`${baseUrl}/api/playground/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, config }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
      let latencyMs = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (chunk.type === 'text_delta') text += String(chunk.text ?? '');
            if (chunk.type === 'done') {
              usage = (chunk.usage as typeof usage) ?? usage;
              latencyMs = Number(chunk.latencyMs ?? 0);
            }
          } catch { /* skip */ }
        }
      }
      const result: RunResult = { text, toolCallCount: 0, usage, latencyMs };
      setResult(result);
      setHistory((prev) => [{
        id: generateId(),
        label: `${pane}: ${userPrompt.slice(0, 35)}…`,
        timestamp: Date.now(),
        userPrompt,
        configA: pane === 'A' ? config : configA,
        resultA: pane === 'A' ? result : undefined,
        pinned: false,
      }, ...prev].slice(0, 100));
    } catch (err: unknown) {
      setResult({ text: '', toolCallCount: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }, latencyMs: 0, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }, [userPrompt, configA, baseUrl]);

  // Diff view helpers
  const diffEntryA = history.find((h) => h.id === diffIdA);
  const diffEntryB = history.find((h) => h.id === diffIdB);
  const diffTokens = diffEntryA && diffEntryB
    ? computeWordDiff(diffEntryA.resultA?.text ?? '', diffEntryB.resultA?.text ?? '')
    : [];

  const TAB_LABELS: Record<WorkspaceTab, string> = {
    compare: 'Compare',
    history: 'History',
    diff: 'Diff View',
  };

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* Tab bar */}
      <div
        role="tablist"
        className="flex-none flex items-center gap-1 border-b theme-border px-3 py-2"
      >
        {(Object.keys(TAB_LABELS) as WorkspaceTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-2.5 py-1 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              activeTab === tab
                ? 'theme-bg-accent theme-text-on-accent'
                : 'theme-text-secondary theme-bg-secondary theme-border hover:opacity-90'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
        {activeTab === 'compare' && (
          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={runningA || runningB || !userPrompt.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[color:var(--color-accent-primary)] px-3 py-1 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {(runningA || runningB) ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Running…</>
            ) : (
              <><Columns className="h-3 w-3" /> Run Both</>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {/* ——— Compare tab ——— */}
        {activeTab === 'compare' && (
          <div className="flex gap-3 min-h-0">
            <PromptPane
              paneLabel="A"
              config={configA}
              onChange={setConfigA}
              userPrompt={userPrompt}
              onUserPromptChange={setUserPrompt}
              result={resultA}
              isRunning={runningA}
              onRun={() => void runSingle('A', configA, setRunningA, setResultA)}
              onApplyTemplate={(sys) => setConfigA((c) => ({ ...c, systemPrompt: sys }))}
            />
            <div className="w-px bg-[color:var(--color-border)] flex-none" />
            <PromptPane
              paneLabel="B"
              config={configB}
              onChange={setConfigB}
              userPrompt={userPrompt}
              onUserPromptChange={setUserPrompt}
              result={resultB}
              isRunning={runningB}
              onRun={() => void runSingle('B', configB, setRunningB, setResultB)}
              onApplyTemplate={(sys) => setConfigB((c) => ({ ...c, systemPrompt: sys }))}
            />
          </div>
        )}

        {/* ——— History tab ——— */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="No history yet"
                description="Run a prompt to save it here. Pinned runs become baselines for diff."
              />
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="card-panel--strong p-3 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium theme-text-primary">{entry.label}</p>
                        <p className="text-[10px] theme-text-muted">
                          {formatAgo(entry.timestamp)}
                          {entry.resultA?.usage && (
                            <span className="ml-2">
                              {entry.resultA.usage.totalTokens} tok • {formatCost(entry.resultA.usage.estimatedCostUsd)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title={entry.pinned ? 'Unpin' : 'Pin as baseline'}
                          onClick={() =>
                            setHistory((prev) =>
                              prev.map((h) => h.id === entry.id ? { ...h, pinned: !h.pinned } : h)
                            )
                          }
                          className={`rounded p-1 transition ${entry.pinned ? 'text-amber-400' : 'theme-text-muted hover:theme-text-secondary'}`}
                        >
                          {entry.pinned ? <Star className="h-3.5 w-3.5 fill-current" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          title="Select for diff A"
                          onClick={() => { setDiffIdA(entry.id); setActiveTab('diff'); }}
                          className="rounded p-1 theme-text-muted hover:theme-text-secondary transition"
                        >
                          <GitBranch className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Restore to pane A"
                          onClick={() => {
                            setConfigA(entry.configA);
                            if (entry.userPrompt) setUserPrompt(entry.userPrompt);
                            setActiveTab('compare');
                          }}
                          className="rounded p-1 theme-text-muted hover:theme-text-secondary transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Copy result"
                          onClick={() => void navigator.clipboard.writeText(entry.resultA?.text ?? '')}
                          className="rounded p-1 theme-text-muted hover:theme-text-secondary transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Expandable response preview */}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] theme-text-muted select-none flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                        Response preview
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap theme-text-secondary">
                        {entry.resultA?.text ?? '(none)'}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ——— Diff tab ——— */}
        {activeTab === 'diff' && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-[0.2em] theme-text-muted mb-1">
                  Version A
                </label>
                <select
                  value={diffIdA ?? ''}
                  onChange={(e) => setDiffIdA(e.target.value || null)}
                  className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1 text-xs theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">— Select —</option>
                  {history.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label} ({formatAgo(h.timestamp)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-[0.2em] theme-text-muted mb-1">
                  Version B
                </label>
                <select
                  value={diffIdB ?? ''}
                  onChange={(e) => setDiffIdB(e.target.value || null)}
                  className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1 text-xs theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">— Select —</option>
                  {history.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label} ({formatAgo(h.timestamp)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {diffIdA && diffIdB && diffTokens.length > 0 ? (
              <div className="rounded-lg border theme-border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {diffTokens.map((token, i) => (
                  <span
                    key={i}
                    className={
                      token.status === 'add'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : token.status === 'remove'
                        ? 'bg-rose-500/20 text-rose-300 line-through opacity-70'
                        : 'theme-text-primary'
                    }
                  >
                    {token.text}{' '}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<GitBranch className="h-6 w-6" />}
                title="Select two versions to diff"
                description="Pick an A and B version from the dropdowns above to see highlighted output differences."
              />
            )}

            {/* System prompt diff */}
            {diffEntryA && diffEntryB && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] theme-text-muted mb-1">
                  System Prompt Diff
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded border border-rose-500/30 p-2 text-[10px] font-mono whitespace-pre-wrap theme-text-secondary bg-rose-500/5">
                    <span className="text-[9px] uppercase theme-text-muted block mb-1">A</span>
                    {diffEntryA.configA.systemPrompt}
                  </div>
                  <div className="flex-1 rounded border border-emerald-500/30 p-2 text-[10px] font-mono whitespace-pre-wrap theme-text-secondary bg-emerald-500/5">
                    <span className="text-[9px] uppercase theme-text-muted block mb-1">B</span>
                    {diffEntryB.configA.systemPrompt}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
