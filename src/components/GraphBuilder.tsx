/**
 * @file GraphBuilder.tsx
 * @description Visual workflow / mission builder with compile, run, and checkpoint support.
 *
 * Three-column layout:
 *   **Node Palette** (left)  -- click-to-add node types.
 *   **Canvas** (centre)      -- connected nodes in vertical flow; click to select.
 *   **Node Editor** (right)  -- editable config for the selected node.
 *
 * Supported node types:
 *
 * | Type       | Icon   | Purpose                                        |
 * |------------|--------|------------------------------------------------|
 * | GMI        | Brain  | LLM invocation with system instructions         |
 * | Tool       | Wrench | Calls a registered tool by name                 |
 * | Human      | User   | Pauses for human input                          |
 * | Voice      | Mic    | Speaks and/or listens for a reply                |
 * | Router     | Router | Branches based on a condition                   |
 * | Guardrail  | Shield | Runs a safety check; halts on failure            |
 * | Subgraph   | Layers | Embeds another saved workflow                    |
 *
 * Canvas model:
 *   Nodes store `connectsTo: string[]` directed edges.  The graph is a DAG
 *   (or can contain cycles handled by the fallback traversal in the backend).
 *
 * YAML export:
 *   {@link graphToYaml} serialises the node list into a deterministic YAML
 *   representation.  The backend `compileToIr()` produces a richer IR.
 *
 * Compile / Run flow:
 *   - Compile: `POST /api/agency/workflow/compile` -> IR preview in YAML tab.
 *   - Run: `POST /api/agency/workflow/start` -> streaming text chunks shown
 *     in the run output pane.  The response header `X-AgentOS-Graph-Run-Id`
 *     links to a persisted runtime run record.
 *
 * Persistence:
 *   - **Local snapshots**: browser `sessionStorage` checkpoints with Resume/Delete.
 *   - **Runtime runs**: persisted backend records polled every 5 s, with
 *     restore and fork-to-planning-draft controls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  GitBranch,
  Mic,
  Play,
  RefreshCw,
  Router,
  Shield,
  User,
  Wrench,
  Download,
  Layers,
  ChevronRight,
  X,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import {
  agentosClient,
  resolveWorkbenchApiBaseUrl,
  type GraphRunRecord,
} from '@/lib/agentosClient';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Every supported graph node type.
 * Each maps to a {@link PaletteEntry} with a default config and icon.
 */
export type GraphNodeType =
  | 'gmi'
  | 'tool'
  | 'human'
  | 'voice'
  | 'router'
  | 'guardrail'
  | 'subgraph';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Type-specific config (instructions, tool name, …). */
  config: Record<string, string>;
  /** IDs of nodes this node connects to (directed edges). */
  connectsTo: string[];
}

export interface GraphCheckpoint {
  id: string;
  label: string;
  savedAt: number;
  nodeCount: number;
}

// ---------------------------------------------------------------------------
// Node palette descriptor
// ---------------------------------------------------------------------------

interface PaletteEntry {
  type: GraphNodeType;
  label: string;
  description: string;
  Icon: LucideIcon;
  defaultConfig: Record<string, string>;
}

const PALETTE: PaletteEntry[] = [
  {
    type: 'gmi',
    label: 'GMI',
    description: 'Generative model invocation — runs an LLM with instructions.',
    Icon: Brain,
    defaultConfig: { instructions: '' },
  },
  {
    type: 'tool',
    label: 'Tool',
    description: 'Calls a registered tool by name.',
    Icon: Wrench,
    defaultConfig: { toolName: '', args: '' },
  },
  {
    type: 'human',
    label: 'Human',
    description: 'Pauses execution and waits for human input.',
    Icon: User,
    defaultConfig: { prompt: '' },
  },
  {
    type: 'voice',
    label: 'Voice',
    description: 'Speaks a message and optionally listens for a reply.',
    Icon: Mic,
    defaultConfig: { text: '', listen: 'true' },
  },
  {
    type: 'router',
    label: 'Router',
    description: 'Branches to one of several downstream nodes based on a condition.',
    Icon: Router,
    defaultConfig: { condition: '' },
  },
  {
    type: 'guardrail',
    label: 'Guardrail',
    description: 'Runs a safety check; halts the graph on failure.',
    Icon: Shield,
    defaultConfig: { packId: 'pii-redaction' },
  },
  {
    type: 'subgraph',
    label: 'Subgraph',
    description: 'Embeds another saved workflow as a node.',
    Icon: Layers,
    defaultConfig: { workflowId: '' },
  },
];

const NODE_COLORS: Record<GraphNodeType, string> = {
  gmi: 'border-sky-500/50 bg-sky-500/10',
  tool: 'border-violet-500/50 bg-violet-500/10',
  human: 'border-amber-500/50 bg-amber-500/10',
  voice: 'border-emerald-500/50 bg-emerald-500/10',
  router: 'border-orange-500/50 bg-orange-500/10',
  guardrail: 'border-rose-500/50 bg-rose-500/10',
  subgraph: 'border-teal-500/50 bg-teal-500/10',
};

const NODE_BADGE_COLORS: Record<GraphNodeType, string> = {
  gmi: 'text-sky-400',
  tool: 'text-violet-400',
  human: 'text-amber-400',
  voice: 'text-emerald-400',
  router: 'text-orange-400',
  guardrail: 'text-rose-400',
  subgraph: 'text-teal-400',
};

const GRAPH_RUN_STATUS_STYLES: Record<GraphRunRecord['status'], string> = {
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  running: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

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
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Serialises the graph node list into a deterministic YAML representation.
 * Used as a local fallback when the backend compile endpoint is unavailable.
 *
 * @param nodes - The current graph nodes to serialise.
 * @returns A YAML string representing the workflow definition.
 */
function graphToYaml(nodes: GraphNode[]): string {
  if (nodes.length === 0) return '# Empty graph';
  const lines: string[] = ['workflow:', '  nodes:'];
  for (const node of nodes) {
    lines.push(`    - id: ${node.id}`);
    lines.push(`      type: ${node.type}`);
    lines.push(`      label: "${node.label}"`);
    if (Object.keys(node.config).length > 0) {
      lines.push('      config:');
      for (const [k, v] of Object.entries(node.config)) {
        lines.push(`        ${k}: "${v}"`);
      }
    }
    if (node.connectsTo.length > 0) {
      lines.push(`      connectsTo: [${node.connectsTo.join(', ')}]`);
    }
  }
  return lines.join('\n');
}

function formatGraphRunSource(source: GraphRunRecord['source']): string {
  if (source === 'compose') return 'Compose';
  if (source === 'agency') return 'Agency';
  return 'Workflow';
}

// ---------------------------------------------------------------------------
// Config field editor
// ---------------------------------------------------------------------------

interface ConfigEditorProps {
  node: GraphNode;
  allNodes: GraphNode[];
  onChange: (updated: Partial<GraphNode>) => void;
}

/**
 * Renders editable fields for the selected node's config and connectsTo list.
 */
function ConfigEditor({ node, allNodes, onChange }: ConfigEditorProps) {
  const configKeys = Object.keys(node.config);
  const otherNodes = allNodes.filter((n) => n.id !== node.id);

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Label</p>
        <input
          value={node.label}
          onChange={(e) => onChange({ label: e.target.value })}
          title="Node display label"
          className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
        />
      </div>

      {/* Config fields */}
      {configKeys.map((key) => (
        <div key={key}>
          <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">{key}</p>
          <textarea
            rows={key === 'instructions' ? 4 : 2}
            value={node.config[key]}
            onChange={(e) =>
              onChange({ config: { ...node.config, [key]: e.target.value } })
            }
            title={`Configure ${key} for this node`}
            className="w-full resize-none rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
          />
        </div>
      ))}

      {/* Connects to */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
          Connects To
        </p>
        {otherNodes.length === 0 ? (
          <p className="text-[10px] theme-text-muted">No other nodes in graph.</p>
        ) : (
          <div className="space-y-1">
            {otherNodes.map((target) => {
              const checked = node.connectsTo.includes(target.id);
              return (
                <label
                  key={target.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border theme-border theme-bg-primary px-2.5 py-1.5 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? node.connectsTo.filter((id) => id !== target.id)
                        : [...node.connectsTo, target.id];
                      onChange({ connectsTo: next });
                    }}
                    className="shrink-0 accent-sky-500"
                  />
                  <span className="text-[10px] theme-text-primary">{target.label}</span>
                  <span className={`text-[9px] font-mono ${NODE_BADGE_COLORS[target.type]}`}>
                    {target.type}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas node card
// ---------------------------------------------------------------------------

interface CanvasNodeCardProps {
  node: GraphNode;
  selected: boolean;
  allNodes: GraphNode[];
  onSelect: () => void;
  onRemove: () => void;
}

function CanvasNodeCard({ node, selected, allNodes, onSelect, onRemove }: CanvasNodeCardProps) {
  const entry = PALETTE.find((p) => p.type === node.type);
  const Icon = entry?.Icon ?? Brain;
  const colorClass = NODE_COLORS[node.type] ?? 'theme-border theme-bg-primary';
  const badgeColor = NODE_BADGE_COLORS[node.type] ?? 'theme-text-secondary';
  const connectedLabels = node.connectsTo
    .map((id) => allNodes.find((n) => n.id === id)?.label ?? id)
    .join(', ');

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={[
        'group relative cursor-pointer rounded-lg border px-3 py-2.5 transition-all',
        colorClass,
        selected ? 'ring-2 ring-sky-500/60' : 'hover:ring-1 hover:ring-white/20',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <Icon size={13} className={`mt-0.5 shrink-0 ${badgeColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold theme-text-primary">{node.label}</span>
            <span
              className={`rounded-full border border-current/30 bg-current/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${badgeColor}`}
            >
              {node.type}
            </span>
          </div>
          {connectedLabels && (
            <p className="mt-0.5 text-[10px] theme-text-muted">
              <ChevronRight size={9} className="inline-block" /> {connectedLabels}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove node from graph"
          className="shrink-0 rounded-full p-0.5 text-rose-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

type GraphSubTab = 'canvas' | 'yaml' | 'checkpoints' | 'runtime';

const GRAPH_SUBTABS: Array<{ key: GraphSubTab; label: string }> = [
  { key: 'canvas', label: 'Canvas' },
  { key: 'yaml', label: 'YAML' },
  { key: 'checkpoints', label: 'Local Snapshots' },
  { key: 'runtime', label: 'Runtime Runs' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * GraphBuilder — interactive, drag-free workflow / mission composition UI.
 *
 * Left column: node type palette.
 * Center: canvas + sub-tabs (Canvas / YAML / Checkpoints).
 * Right: config editor for the selected node.
 *
 * Compile → POST /api/agency/workflow/compile
 * Run     → POST /api/agency/workflow/start (streaming)
 */
export function GraphBuilder() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<GraphSubTab>('canvas');
  const [compiledIr, setCompiledIr] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<GraphCheckpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runtimeRuns, setRuntimeRuns] = useState<GraphRunRecord[]>([]);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [runtimeActionRunId, setRuntimeActionRunId] = useState<string | null>(null);
  const [selectedRuntimeRunId, setSelectedRuntimeRunId] = useState<string | null>(null);
  const [lastStartedRuntimeRunId, setLastStartedRuntimeRunId] = useState<string | null>(null);
  const runOutputRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const selectedRuntimeRun = useMemo(() => {
    if (selectedRuntimeRunId) {
      return runtimeRuns.find((run) => run.runId === selectedRuntimeRunId) ?? null;
    }
    return runtimeRuns[0] ?? null;
  }, [runtimeRuns, selectedRuntimeRunId]);

  // Scroll run output to bottom on new output lines
  useEffect(() => {
    if (runOutputRef.current) {
      runOutputRef.current.scrollTop = runOutputRef.current.scrollHeight;
    }
  }, [runOutput]);

  // Load saved checkpoints on mount
  useEffect(() => {
    // Checkpoints are stored in local state only for this session (no persistent backend)
    const saved = sessionStorage.getItem('agentos-workbench-graph-checkpoints');
    if (saved) {
      try {
        setCheckpoints(JSON.parse(saved) as GraphCheckpoint[]);
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  const fetchRuntimeRuns = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setRuntimeLoading(true);
    }
    try {
      const data = await agentosClient.listGraphRuns();
      setRuntimeRuns(Array.isArray(data) ? data : []);
      setRuntimeError(null);
    } catch (fetchError) {
      if (!options?.silent) {
        setRuntimeRuns([]);
      }
      setRuntimeError(
        fetchError instanceof Error ? fetchError.message : 'Failed to load runtime runs.'
      );
    } finally {
      if (!options?.silent) {
        setRuntimeLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchRuntimeRuns();
    const intervalId = window.setInterval(() => {
      void fetchRuntimeRuns({ silent: true });
    }, 5000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchRuntimeRuns]);

  useEffect(() => {
    if (runtimeRuns.length === 0) {
      if (selectedRuntimeRunId !== null) {
        setSelectedRuntimeRunId(null);
      }
      return;
    }
    if (selectedRuntimeRunId && runtimeRuns.some((run) => run.runId === selectedRuntimeRunId)) {
      return;
    }
    setSelectedRuntimeRunId(runtimeRuns[0]?.runId ?? null);
  }, [runtimeRuns, selectedRuntimeRunId]);

  const saveCheckpoints = (updated: GraphCheckpoint[]) => {
    setCheckpoints(updated);
    try {
      sessionStorage.setItem('agentos-workbench-graph-checkpoints', JSON.stringify(updated));
    } catch {
      // sessionStorage unavailable
    }
  };

  // -------------------------------------------------------------------------
  // Node operations
  // -------------------------------------------------------------------------

  const addNode = (entry: PaletteEntry) => {
    const newNode: GraphNode = {
      id: generateId(),
      type: entry.type,
      label: `${entry.label} ${nodes.filter((n) => n.type === entry.type).length + 1}`,
      config: { ...entry.defaultConfig },
      connectsTo: [],
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedId(newNode.id);
  };

  const removeNode = (id: string) => {
    setNodes((prev) =>
      prev
        .filter((n) => n.id !== id)
        .map((n) => ({ ...n, connectsTo: n.connectsTo.filter((cid) => cid !== id) }))
    );
    if (selectedId === id) setSelectedId(null);
  };

  const updateNode = (id: string, patch: Partial<GraphNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  // -------------------------------------------------------------------------
  // Compile
  // -------------------------------------------------------------------------

  const handleCompile = async () => {
    setCompiling(true);
    setError(null);
    setCompiledIr(null);
    try {
      const base = buildBaseUrl();
      const res = await fetch(`${base}/api/agency/workflow/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ir?: string; yaml?: string };
      setCompiledIr(data.ir ?? data.yaml ?? JSON.stringify(data, null, 2));
      setSubTab('yaml');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compile failed.');
      // Fall back to local YAML on backend unavailability
      setCompiledIr(graphToYaml(nodes));
      setSubTab('yaml');
    } finally {
      setCompiling(false);
    }
  };

  // -------------------------------------------------------------------------
  // Run
  // -------------------------------------------------------------------------

  const handleRun = async () => {
    setRunning(true);
    setRunOutput(['[run started]']);
    setError(null);
    setRuntimeMessage(null);
    try {
      const base = buildBaseUrl();
      const res = await fetch(`${base}/api/agency/workflow/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const runtimeRunId = res.headers.get('x-agentos-graph-run-id');
      if (runtimeRunId) {
        setLastStartedRuntimeRunId(runtimeRunId);
        setSelectedRuntimeRunId(runtimeRunId);
        setRuntimeError(null);
        setRuntimeMessage(`Run ${runtimeRunId} is being mirrored to persisted runtime records.`);
        void fetchRuntimeRuns({ silent: true });
      } else {
        setLastStartedRuntimeRunId(null);
      }
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        setRunOutput((prev) => [...prev, text, '[done]']);
        if (runtimeRunId) {
          void fetchRuntimeRuns({ silent: true });
        }
        return;
      }
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          setRunOutput((prev) => [...prev, decoder.decode(chunk.value)]);
        }
      }
      setRunOutput((prev) => [...prev, '[done]']);
      if (runtimeRunId) {
        setRuntimeMessage(`Run ${runtimeRunId} completed and is available in Runtime Runs.`);
        void fetchRuntimeRuns({ silent: true });
      }
    } catch (err) {
      setRunOutput((prev) => [
        ...prev,
        `[error] ${err instanceof Error ? err.message : 'Run failed'}`,
      ]);
      setError(err instanceof Error ? err.message : 'Run failed.');
    } finally {
      setRunning(false);
    }
  };

  // -------------------------------------------------------------------------
  // Checkpoint
  // -------------------------------------------------------------------------

  const handleSaveCheckpoint = () => {
    const cp: GraphCheckpoint = {
      id: generateId(),
      label: `Checkpoint ${checkpoints.length + 1}`,
      savedAt: Date.now(),
      nodeCount: nodes.length,
    };
    // Persist nodes snapshot alongside checkpoint id in sessionStorage
    try {
      sessionStorage.setItem(`agentos-graph-cp-${cp.id}`, JSON.stringify(nodes));
    } catch {
      // ignore
    }
    saveCheckpoints([...checkpoints, cp]);
  };

  const handleResumeCheckpoint = (cp: GraphCheckpoint) => {
    const raw = sessionStorage.getItem(`agentos-graph-cp-${cp.id}`);
    if (!raw) {
      setError(`Checkpoint data for "${cp.label}" not found in this session.`);
      return;
    }
    try {
      setNodes(JSON.parse(raw) as GraphNode[]);
      setSelectedId(null);
      setCompiledIr(null);
      setRunOutput([]);
    } catch {
      setError('Failed to restore checkpoint (corrupted data).');
    }
  };

  const handleDeleteCheckpoint = (id: string) => {
    sessionStorage.removeItem(`agentos-graph-cp-${id}`);
    saveCheckpoints(checkpoints.filter((cp) => cp.id !== id));
  };

  const upsertRuntimeRun = useCallback((nextRun: GraphRunRecord) => {
    setRuntimeRuns((previous) => {
      const index = previous.findIndex((run) => run.runId === nextRun.runId);
      if (index < 0) {
        return [nextRun, ...previous];
      }
      const copy = [...previous];
      copy[index] = nextRun;
      return copy;
    });
  }, []);

  const handleRestoreRuntimeCheckpoint = async (runId: string, checkpointId: string) => {
    setRuntimeActionRunId(runId);
    setRuntimeMessage(null);
    try {
      const restoredRun = await agentosClient.restoreGraphRunCheckpoint(runId, checkpointId);
      upsertRuntimeRun(restoredRun);
      setSelectedRuntimeRunId(restoredRun.runId);
      setRuntimeError(null);
      setRuntimeMessage('Runtime run restored to the selected checkpoint.');
      setSubTab('runtime');
    } catch (restoreError) {
      setRuntimeError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Failed to restore the runtime checkpoint.'
      );
    } finally {
      setRuntimeActionRunId(null);
    }
  };

  const handleForkRuntimeCheckpoint = async (runId: string, checkpointId: string) => {
    setRuntimeActionRunId(runId);
    setRuntimeMessage(null);
    try {
      const forkedPlan = await agentosClient.forkGraphRunCheckpoint(runId, checkpointId);
      const forkedPlanId =
        typeof forkedPlan.planId === 'string'
          ? forkedPlan.planId
          : typeof forkedPlan.id === 'string'
            ? forkedPlan.id
            : null;
      setRuntimeError(null);
      setRuntimeMessage(
        forkedPlanId
          ? `Checkpoint forked into planning draft ${forkedPlanId}.`
          : 'Checkpoint forked into a planning draft.'
      );
      setSubTab('runtime');
    } catch (forkError) {
      setRuntimeError(
        forkError instanceof Error ? forkError.message : 'Failed to fork the runtime checkpoint.'
      );
    } finally {
      setRuntimeActionRunId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Workflow</p>
              <h3 className="text-sm font-semibold theme-text-primary">Graph Builder</h3>
            </div>
            <HelpTooltip label="Explain graph builder" side="bottom">
              Compose agent workflows by adding node types from the palette, wiring them together
              via the node editor, then compiling and running. Local snapshots preserve browser
              state, while the Runtime Runs tab inspects persisted backend graph runs and
              checkpoints.
            </HelpTooltip>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <DataSourceBadge tone="mixed" label="Local + Runtime" />
            <DataSourceBadge tone="local" label="Canvas + Snapshots" />
            <DataSourceBadge tone="runtime" label="Persisted Runs" />
          </div>
          <p className="max-w-3xl text-[11px] theme-text-secondary">
            Draft locally with the workflow bridge, then inspect real graph-run records and
            runtime checkpoints without leaving this screen.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {nodes.length > 0 && (
            <button
              type="button"
              onClick={handleSaveCheckpoint}
              title="Save a checkpoint of the current graph."
              className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[10px] theme-text-secondary transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Download size={9} aria-hidden="true" />
              Checkpoint
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleCompile()}
            disabled={compiling || nodes.length === 0}
            title="Compile the graph to IR."
            className="inline-flex items-center gap-1 rounded-full border theme-border bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <RefreshCw size={9} className={compiling ? 'animate-spin' : ''} aria-hidden="true" />
            {compiling ? 'Compiling…' : 'Compile'}
          </button>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running || nodes.length === 0}
            title="Run the workflow."
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Play size={9} aria-hidden="true" />
            {running ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('runtime');
              if (!runtimeLoading && runtimeRuns.length === 0) {
                void fetchRuntimeRuns();
              }
            }}
            title="Inspect persisted runtime graph runs."
            className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[10px] theme-text-secondary transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <GitBranch size={9} aria-hidden="true" />
            Runtime Runs
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-400">
          {error}
        </div>
      )}

      {(runtimeError || runtimeMessage) && (
        <div
          className={[
            'mb-3 rounded-lg border px-3 py-2 text-[10px]',
            runtimeError
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-sky-500/30 bg-sky-500/10 text-sky-300',
          ].join(' ')}
        >
          {runtimeError ?? runtimeMessage}
        </div>
      )}

      {/* Three-column layout */}
      <div className="grid grid-cols-[140px_1fr_180px] gap-2 min-h-[400px]">
        {/* ---------------------------------------------------------------- */}
        {/* Left: Node palette                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-1">
          <p className="mb-1 text-[9px] uppercase tracking-[0.35em] theme-text-muted">Palette</p>
          {PALETTE.map((entry) => {
            const Icon = entry.Icon;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => addNode(entry)}
                title={entry.description}
                className="flex items-center gap-2 rounded-lg border theme-border theme-bg-primary px-2 py-1.5 text-left text-[10px] theme-text-secondary transition hover:bg-white/5 hover:theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon size={11} className={NODE_BADGE_COLORS[entry.type]} />
                <span className="text-xs">{entry.label}</span>
                <Plus size={9} className="ml-auto shrink-0 opacity-40" />
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Center: Canvas + sub-tabs                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Sub-tab strip */}
          <div className="flex gap-0.5 rounded-lg border theme-border theme-bg-primary p-0.5">
            {GRAPH_SUBTABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSubTab(key)}
                className={[
                  'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  subTab === key
                    ? 'bg-sky-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Canvas tab */}
          {subTab === 'canvas' && (
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {nodes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-10 text-center">
                  <GitBranch size={20} className="theme-text-muted" />
                  <p className="text-xs theme-text-secondary">No nodes yet.</p>
                  <p className="text-[10px] theme-text-muted">
                    Click a node type in the palette to add it.
                  </p>
                </div>
              ) : (
                nodes.map((node) => (
                  <CanvasNodeCard
                    key={node.id}
                    node={node}
                    selected={selectedId === node.id}
                    allNodes={nodes}
                    onSelect={() => setSelectedId(selectedId === node.id ? null : node.id)}
                    onRemove={() => removeNode(node.id)}
                  />
                ))
              )}

              {/* Run output (shown below canvas when non-empty) */}
              {runOutput.length > 0 && (
                <div
                  ref={runOutputRef}
                  className="mt-2 max-h-32 overflow-y-auto rounded-lg border theme-border theme-bg-primary px-2 py-1.5"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                      Run Output
                    </p>
                    {lastStartedRuntimeRunId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRuntimeRunId(lastStartedRuntimeRunId);
                          setSubTab('runtime');
                        }}
                        className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-300 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Inspect runtime run
                      </button>
                    )}
                  </div>
                  {runOutput.map((line, idx) => (
                    // Output lines are append-only — index key is acceptable.
                    // eslint-disable-next-line react/no-array-index-key
                    <p key={idx} className="font-mono text-[9px] theme-text-secondary">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* YAML / IR tab */}
          {subTab === 'yaml' && (
            <div className="flex-1">
              <p className="mb-1 text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                {compiledIr ? 'Compiled IR' : 'YAML Export'}
              </p>
              <pre className="h-full min-h-[300px] overflow-auto rounded-lg border theme-border theme-bg-primary px-3 py-2 font-mono text-[10px] leading-relaxed theme-text-secondary">
                {compiledIr ?? graphToYaml(nodes)}
              </pre>
            </div>
          )}

          {/* Checkpoints tab */}
          {subTab === 'checkpoints' && (
            <div className="flex-1 space-y-2">
              <div className="rounded-lg border theme-border theme-bg-primary px-3 py-2 text-[10px] theme-text-secondary">
                Local snapshots are stored in this browser session only. Persisted backend
                checkpoints appear under <span className="font-semibold theme-text-primary">Runtime Runs</span>.
              </div>
              {checkpoints.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
                  <Download size={18} className="theme-text-muted" />
                  <p className="text-xs theme-text-secondary">No local snapshots saved.</p>
                  <p className="text-[10px] theme-text-muted">
                    Click &quot;Checkpoint&quot; to snapshot the current graph.
                  </p>
                </div>
              ) : (
                checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center justify-between gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium theme-text-primary">{cp.label}</p>
                      <p className="text-[10px] theme-text-muted">
                        {new Date(cp.savedAt).toLocaleString()} · {cp.nodeCount} node
                        {cp.nodeCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => handleResumeCheckpoint(cp)}
                        title={`Restore graph from ${cp.label}`}
                        className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckpoint(cp.id)}
                        title={`Delete ${cp.label}`}
                        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Runtime tab */}
          {subTab === 'runtime' && (
            <div className="grid flex-1 gap-2 xl:grid-cols-[230px_minmax(0,1fr)] min-h-[320px]">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                    Persisted Runs
                  </p>
                  <button
                    type="button"
                    onClick={() => void fetchRuntimeRuns()}
                    disabled={runtimeLoading}
                    className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <RefreshCw
                      size={9}
                      className={runtimeLoading ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    Refresh
                  </button>
                </div>

                <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
                  {runtimeLoading && runtimeRuns.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
                      <RefreshCw size={18} className="animate-spin theme-text-muted" />
                      <p className="text-xs theme-text-secondary">Loading runtime runs…</p>
                    </div>
                  ) : runtimeRuns.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
                      <GitBranch size={18} className="theme-text-muted" />
                      <p className="text-xs theme-text-secondary">No persisted runtime runs yet.</p>
                      <p className="px-4 text-[10px] theme-text-muted">
                        Workflow and agency executions that hit the runtime will appear here with
                        checkpoints and event history.
                      </p>
                    </div>
                  ) : (
                    runtimeRuns.map((run) => {
                      const active = selectedRuntimeRun?.runId === run.runId;
                      return (
                        <button
                          key={run.runId}
                          type="button"
                          onClick={() => setSelectedRuntimeRunId(run.runId)}
                          className={[
                            'w-full rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            active
                              ? 'border-sky-500/50 bg-sky-500/10'
                              : 'theme-border theme-bg-primary hover:bg-white/5',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold theme-text-primary">
                              {formatGraphRunSource(run.source)}
                            </span>
                            <span
                              className={[
                                'rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wide',
                                GRAPH_RUN_STATUS_STYLES[run.status],
                              ].join(' ')}
                            >
                              {run.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] theme-text-secondary">
                            {run.goal}
                          </p>
                          <p className="mt-1 text-[9px] theme-text-muted">
                            {run.checkpoints.length} checkpoints · {run.tasks.length} tasks
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="min-h-0 rounded-lg border theme-border theme-bg-primary px-3 py-3">
                {!selectedRuntimeRun ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <GitBranch size={20} className="theme-text-muted" />
                    <p className="text-xs theme-text-secondary">Select a runtime run to inspect it.</p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                          {formatGraphRunSource(selectedRuntimeRun.source)} Run
                        </p>
                        <h4 className="mt-1 text-sm font-semibold theme-text-primary">
                          {selectedRuntimeRun.goal}
                        </h4>
                        <p className="mt-1 text-[10px] theme-text-muted">
                          {selectedRuntimeRun.runId} · Updated{' '}
                          {new Date(selectedRuntimeRun.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={[
                          'rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.25em]',
                          GRAPH_RUN_STATUS_STYLES[selectedRuntimeRun.status],
                        ].join(' ')}
                      >
                        {selectedRuntimeRun.status}
                      </span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-lg border theme-border bg-white/5 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                          Tasks
                        </p>
                        <p className="mt-1 text-sm font-semibold theme-text-primary">
                          {selectedRuntimeRun.tasks.length}
                        </p>
                      </div>
                      <div className="rounded-lg border theme-border bg-white/5 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                          Checkpoints
                        </p>
                        <p className="mt-1 text-sm font-semibold theme-text-primary">
                          {selectedRuntimeRun.checkpoints.length}
                        </p>
                      </div>
                      <div className="rounded-lg border theme-border bg-white/5 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                          Events
                        </p>
                        <p className="mt-1 text-sm font-semibold theme-text-primary">
                          {selectedRuntimeRun.events.length}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="min-h-0 space-y-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                            Tasks
                          </p>
                          {selectedRuntimeRun.tasks.length === 0 ? (
                            <p className="mt-2 text-[10px] theme-text-muted">
                              No task records captured for this run yet.
                            </p>
                          ) : (
                            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                              {selectedRuntimeRun.tasks.map((task) => (
                                <div
                                  key={task.taskId}
                                  className="rounded-lg border theme-border bg-white/5 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-medium theme-text-primary">
                                      {task.description}
                                    </p>
                                    <span className="text-[9px] uppercase tracking-wide theme-text-muted">
                                      {task.status}
                                    </span>
                                  </div>
                                  {(task.assignedRoleId || task.assignedExecutorId) && (
                                    <p className="mt-1 text-[10px] theme-text-secondary">
                                      {[task.assignedRoleId, task.assignedExecutorId]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                  {task.error && (
                                    <p className="mt-1 text-[10px] text-rose-300">{task.error}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                            Recent Events
                          </p>
                          {selectedRuntimeRun.events.length === 0 ? (
                            <p className="mt-2 text-[10px] theme-text-muted">
                              No runtime events recorded yet.
                            </p>
                          ) : (
                            <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                              {selectedRuntimeRun.events
                                .slice(-4)
                                .reverse()
                                .map((event) => (
                                  <div
                                    key={event.eventId}
                                    className="rounded-lg border theme-border bg-white/5 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-medium theme-text-primary">
                                        {event.summary}
                                      </span>
                                      <span className="text-[9px] uppercase tracking-wide theme-text-muted">
                                        {event.type}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[9px] theme-text-muted">
                                      {new Date(event.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-h-0">
                        <p className="text-[9px] uppercase tracking-[0.35em] theme-text-muted">
                          Runtime Checkpoints
                        </p>
                        {selectedRuntimeRun.checkpoints.length === 0 ? (
                          <p className="mt-2 text-[10px] theme-text-muted">
                            No persisted runtime checkpoints recorded yet.
                          </p>
                        ) : (
                          <div className="mt-2 max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                            {selectedRuntimeRun.checkpoints
                              .slice()
                              .reverse()
                              .map((checkpoint) => (
                                <div
                                  key={checkpoint.checkpointId}
                                  className="rounded-lg border theme-border bg-white/5 px-3 py-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium theme-text-primary">
                                        {checkpoint.checkpointId}
                                      </p>
                                      <p className="mt-1 text-[10px] theme-text-secondary">
                                        {checkpoint.completedTaskCount}/{checkpoint.totalTaskCount}{' '}
                                        tasks complete
                                      </p>
                                      <p className="mt-1 text-[9px] theme-text-muted">
                                        {new Date(checkpoint.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                    <span
                                      className={[
                                        'rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wide',
                                        GRAPH_RUN_STATUS_STYLES[checkpoint.status],
                                      ].join(' ')}
                                    >
                                      {checkpoint.status}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleRestoreRuntimeCheckpoint(
                                          selectedRuntimeRun.runId,
                                          checkpoint.checkpointId
                                        )
                                      }
                                      disabled={runtimeActionRunId === selectedRuntimeRun.runId}
                                      className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                                    >
                                      Restore
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleForkRuntimeCheckpoint(
                                          selectedRuntimeRun.runId,
                                          checkpoint.checkpointId
                                        )
                                      }
                                      disabled={runtimeActionRunId === selectedRuntimeRun.runId}
                                      className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                    >
                                      Fork to Planning
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right: Node editor                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-1 border-l theme-border pl-2">
          <p className="mb-1 text-[9px] uppercase tracking-[0.35em] theme-text-muted">
            Node Editor
          </p>
          {selectedNode ? (
            <ConfigEditor
              node={selectedNode}
              allNodes={nodes}
              onChange={(patch) => updateNode(selectedNode.id, patch)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <GitBranch size={16} className="theme-text-muted" />
              <p className="text-[10px] theme-text-muted px-2">
                Select a node on the canvas to edit its config.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
