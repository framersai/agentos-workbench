/**
 * @file AgentPlayground.tsx
 * @description Interactive agent REPL — the fastest way to test an agent
 * configuration end-to-end without setting up a full session.
 *
 * Layout:
 *   Left panel   — agent config (model picker, system instructions, tools,
 *                  agency mode toggle with roster editor)
 *   Right area   — inline quick-settings bar (temperature, maxSteps,
 *                  maxTokens, guardrail tier) above chat REPL with
 *                  streaming indicator, collapsible tool calls / agent
 *                  calls / usage / trace sections, and prompt input
 *
 * Backend: `POST /api/playground/run` (SSE stream).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Loader2,
  Send,
  Settings2,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GuardrailTier = 'dangerous' | 'permissive' | 'balanced' | 'strict' | 'paranoid';
type PlaygroundMode = 'agent' | 'agency';

interface ToolCallEntry {
  name: string;
  args: unknown;
  result: unknown;
}

interface AgentCallEntry {
  agentId: string;
  input: string;
  output: string;
}

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface TraceEvent {
  type: string;
  timestamp: string;
  detail?: string;
}

type MessageRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: MessageRole;
  /** Accumulated text (may grow during streaming). */
  text: string;
  runtimeMode?: 'live' | 'stub';
  toolCalls?: ToolCallEntry[];
  agentCalls?: AgentCallEntry[];
  usage?: UsageInfo;
  trace?: TraceEvent[];
  latencyMs?: number;
  /** True while the message is still streaming. */
  streaming?: boolean;
}

interface AgentConfig {
  systemPrompt: string;
  model: string;
  tools: string[];
  mode: PlaygroundMode;
  /** Agency mode: list of agent roles. */
  agencyRoles: AgencyRole[];
}

interface AgencyRole {
  roleId: string;
  instruction: string;
}

interface QuickSettings {
  temperature: number;
  maxSteps: number;
  maxTokens: number;
  guardrailTier: GuardrailTier;
  traceEvents: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_TOOLS = [
  'web_search',
  'file_reader',
  'code_executor',
  'calculator',
  'image_analyzer',
  'data_fetcher',
];

const GUARDRAIL_TIERS: GuardrailTier[] = [
  'dangerous',
  'permissive',
  'balanced',
  'strict',
  'paranoid',
];

const DEFAULT_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'claude-3-haiku',
  'claude-3-5-sonnet',
  'claude-sonnet-4',
];

/** Rough token price used for cost estimation before a real response. */
const ROUGH_INPUT_RATE = 0.0005;
const ROUGH_OUTPUT_RATE = 0.0015;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function estimateCost(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  _model: string
): number {
  const promptTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
  const outputTokens = maxTokens;
  return (promptTokens / 1000) * ROUGH_INPUT_RATE + (outputTokens / 1000) * ROUGH_OUTPUT_RATE;
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001';
  return `$${usd.toFixed(4)}`;
}

function runtimeModeTone(mode?: 'live' | 'stub'): string {
  if (mode === 'live') {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20';
  }
  if (mode === 'stub') {
    return 'bg-amber-500/15 text-amber-300 border-amber-400/20';
  }
  return 'bg-[color:var(--color-background-secondary)] theme-text-muted theme-border';
}

function runtimeModeLabel(mode?: 'live' | 'stub'): string {
  if (mode === 'live') return 'Live runtime';
  if (mode === 'stub') return 'Demo fallback';
  return 'Unknown mode';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Collapsible section wrapper used inside assistant messages. */
function Collapsible({
  label,
  count,
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1.5 rounded border theme-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] theme-text-muted hover:theme-text-secondary transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 flex-none" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-none" />
        )}
        <span>{label}</span>
        {count !== undefined && (
          <span className="ml-auto rounded-full bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[9px]">
            {count}
          </span>
        )}
      </button>
      {open && <div className="border-t theme-border p-2">{children}</div>}
    </div>
  );
}

/** Single chat message bubble. */
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[color:var(--color-accent-primary)] text-white">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? 'bg-[color:var(--color-accent-primary)] text-white'
            : 'card-panel--strong theme-text-primary'
        }`}
      >
        {/* Main text */}
        {!isUser && msg.runtimeMode && (
          <div className="mb-1.5">
            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] ${runtimeModeTone(msg.runtimeMode)}`}>
              {runtimeModeLabel(msg.runtimeMode)}
            </span>
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">
          {msg.text}
          {msg.streaming && (
            <span className="ml-1 inline-flex gap-0.5">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </span>
          )}
        </p>

        {/* Expandable sections — only for assistant messages */}
        {!isUser && (
          <>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <Collapsible label="Tool Calls" count={msg.toolCalls.length}>
                <div className="space-y-2">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="rounded border theme-border p-1.5 text-[11px]">
                      <p className="font-mono font-semibold theme-text-primary">{tc.name}</p>
                      {tc.args !== undefined && (
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap theme-text-secondary text-[10px]">
                          {JSON.stringify(tc.args, null, 2)}
                        </pre>
                      )}
                      {tc.result !== undefined && (
                        <>
                          <p className="mt-1 text-[9px] uppercase tracking-widest theme-text-muted">Result</p>
                          <pre className="max-h-24 overflow-auto whitespace-pre-wrap theme-text-secondary text-[10px]">
                            {JSON.stringify(tc.result, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {msg.agentCalls && msg.agentCalls.length > 0 && (
              <Collapsible label="Agent Calls" count={msg.agentCalls.length}>
                <div className="space-y-2">
                  {msg.agentCalls.map((ac, i) => (
                    <div key={i} className="rounded border theme-border p-1.5 text-[11px]">
                      <p className="font-semibold theme-text-primary">{ac.agentId}</p>
                      <p className="theme-text-secondary">{ac.input}</p>
                      {ac.output && (
                        <>
                          <p className="mt-1 text-[9px] uppercase tracking-widest theme-text-muted">Output</p>
                          <p className="theme-text-secondary">{ac.output}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {msg.usage && (
              <Collapsible label="Usage">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] theme-text-secondary">
                  <div><dt className="theme-text-muted">Prompt</dt><dd>{msg.usage.promptTokens} tok</dd></div>
                  <div><dt className="theme-text-muted">Completion</dt><dd>{msg.usage.completionTokens} tok</dd></div>
                  <div><dt className="theme-text-muted">Total</dt><dd>{msg.usage.totalTokens} tok</dd></div>
                  <div><dt className="theme-text-muted">Cost</dt><dd>{formatCost(msg.usage.estimatedCostUsd)}</dd></div>
                  {msg.latencyMs !== undefined && (
                    <div><dt className="theme-text-muted">Latency</dt><dd>{msg.latencyMs}ms</dd></div>
                  )}
                </dl>
              </Collapsible>
            )}

            {msg.trace && msg.trace.length > 0 && (
              <Collapsible label="Trace" count={msg.trace.length}>
                <ol className="space-y-1">
                  {msg.trace.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px]">
                      <span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-[color:var(--color-accent-primary)] opacity-70" />
                      <span className="theme-text-secondary">{ev.timestamp}</span>
                      <span className="font-medium theme-text-primary">{ev.type}</span>
                      {ev.detail && <span className="theme-text-muted truncate">{ev.detail}</span>}
                    </li>
                  ))}
                </ol>
              </Collapsible>
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[color:var(--color-background-secondary)] theme-text-secondary">
          <span className="text-[10px] font-bold">U</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * AgentPlayground — interactive REPL for testing agent configs.
 *
 * Two-column layout (left config sidebar, right chat area with inline
 * quick-settings bar). Eliminates the right sidebar for better density
 * at higher browser zoom levels.
 */
export function AgentPlayground() {
  // ----- Config state -----
  const [config, setConfig] = useState<AgentConfig>({
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'gpt-4o-mini',
    tools: [],
    mode: 'agent',
    agencyRoles: [
      { roleId: 'lead', instruction: 'Lead the task and delegate sub-tasks.' },
      { roleId: 'researcher', instruction: 'Research facts and gather information.' },
    ],
  });

  const [settings, setSettings] = useState<QuickSettings>({
    temperature: 0.7,
    maxSteps: 5,
    maxTokens: 1024,
    guardrailTier: 'balanced',
    traceEvents: false,
  });

  // ----- Chat state -----
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMsgIdRef = useRef<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ----- Cost estimator -----
  const estimatedCost = estimateCost(
    config.systemPrompt,
    input,
    settings.maxTokens,
    config.model
  );

  // ----- Send handler -----
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add user message
    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Start assistant streaming message
    const assistantId = generateId();
    streamingMsgIdRef.current = assistantId;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      toolCalls: [],
      agentCalls: [],
      trace: settings.traceEvents ? [] : undefined,
      streaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    const baseUrl = (() => {
      try { return resolveWorkbenchApiBaseUrl(); } catch { return ''; }
    })();

    let aborted = false;

    try {
      const response = await fetch(`${baseUrl}/api/playground/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          sessionId: assistantId,
          config: {
            systemPrompt: config.systemPrompt,
            model: config.model,
            tools: config.tools,
            temperature: settings.temperature,
            maxSteps: settings.maxSteps,
            maxTokens: settings.maxTokens,
            guardrailTier: settings.guardrailTier,
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const responseModeHeader = response.headers.get('X-AgentOS-Playground-Mode');
      const responseRuntimeMode = responseModeHeader === 'live' || responseModeHeader === 'stub'
        ? responseModeHeader
        : undefined;
      if (responseRuntimeMode) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, runtimeMode: responseRuntimeMode } : m
          )
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      abortRef.current = () => {
        aborted = true;
        reader.cancel().catch(() => undefined);
      };

      const toolCalls: ToolCallEntry[] = [];
      const traceEvents: TraceEvent[] = [];

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const chunkType = String(chunk.type ?? '');

            if (chunkType === 'text_delta') {
              const delta = String(chunk.text ?? '');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + delta } : m
                )
              );
              if (settings.traceEvents) {
                traceEvents.push({
                  type: 'text_delta',
                  timestamp: new Date().toLocaleTimeString(),
                  detail: delta.slice(0, 40),
                });
              }
            } else if (chunkType === 'tool_call') {
              const entry: ToolCallEntry = {
                name: String(chunk.name ?? ''),
                args: chunk.args,
                result: chunk.result,
              };
              toolCalls.push(entry);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls ?? []), entry] } : m
                )
              );
              if (settings.traceEvents) {
                traceEvents.push({
                  type: 'tool_call',
                  timestamp: new Date().toLocaleTimeString(),
                  detail: entry.name,
                });
              }
            } else if (chunkType === 'done') {
              const usage = chunk.usage as UsageInfo | undefined;
              const latencyMs = typeof chunk.latencyMs === 'number' ? chunk.latencyMs : undefined;
              const runtimeMode =
                chunk.runtimeMode === 'live' || chunk.runtimeMode === 'stub'
                  ? chunk.runtimeMode
                  : responseRuntimeMode;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        usage,
                        latencyMs,
                        runtimeMode,
                        trace: settings.traceEvents ? traceEvents : undefined,
                        streaming: false,
                      }
                    : m
                )
              );
            } else if (chunkType === 'error') {
              const errMsg = String(chunk.message ?? 'Unknown error');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: m.text || `Error: ${errMsg}`, streaming: false }
                    : m
                )
              );
            }
          } catch {
            // malformed JSON line — skip
          }
        }
      }
    } catch (err: unknown) {
      if (!aborted) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: m.text || `Error: ${errMsg}`, streaming: false }
              : m
          )
        );
      }
    } finally {
      abortRef.current = null;
      streamingMsgIdRef.current = null;
      if (!aborted) {
        setIsStreaming(false);
      }
    }
  }, [input, isStreaming, config, settings]);

  const handleStop = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
    if (streamingMsgIdRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgIdRef.current ? { ...m, streaming: false } : m
        )
      );
    }
  }, []);

  const handleClear = useCallback(() => {
    if (isStreaming) handleStop();
    setMessages([]);
  }, [isStreaming, handleStop]);

  // Ctrl+Enter to send
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  // ----- Render -----
  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* Mode toggle top bar */}
      <div className="flex-none flex items-center gap-2 border-b theme-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">
          Playground
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-full border theme-border p-0.5">
          {(['agent', 'agency'] as PlaygroundMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setConfig((c) => ({ ...c, mode: m }))}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition ${
                config.mode === m
                  ? 'theme-bg-accent theme-text-on-accent'
                  : 'theme-text-secondary hover:opacity-90'
              }`}
            >
              {m === 'agent' ? (
                <Bot className="h-3 w-3" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleClear}
          title="Clear conversation"
          className="ml-2 rounded-md border theme-border p-1 theme-text-muted transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Two-column body: left config sidebar + right chat area */}
      <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
        {/* ——— Left: agent config ——— */}
        <aside className="w-[180px] flex-none flex flex-col gap-4 overflow-y-auto border-r theme-border p-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted mb-2">
              Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
              className="w-full rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-3 py-1.5 text-xs theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {DEFAULT_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted mb-2">
              System Instructions
            </label>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig((c) => ({ ...c, systemPrompt: e.target.value }))}
              rows={5}
              className="w-full resize-none rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-3 py-2 text-xs theme-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="You are a helpful assistant…"
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted mb-2.5">
              Tools
            </p>
            <div className="space-y-2.5">
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={tool} className="flex items-center gap-2 text-xs theme-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.tools.includes(tool)}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        tools: e.target.checked
                          ? [...c.tools, tool]
                          : c.tools.filter((t) => t !== tool),
                      }))
                    }
                    className="rounded accent-[color:var(--color-accent-primary)]"
                  />
                  {tool}
                </label>
              ))}
            </div>
          </div>

          {/* Agency mode roster editor */}
          {config.mode === 'agency' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted mb-1.5">
                Agent Roster
              </p>
              <div className="space-y-2">
                {config.agencyRoles.map((role, i) => (
                  <div key={i} className="rounded border theme-border p-2 text-[11px] space-y-1">
                    <input
                      value={role.roleId}
                      onChange={(e) =>
                        setConfig((c) => {
                          const roles = [...c.agencyRoles];
                          roles[i] = { ...roles[i], roleId: e.target.value };
                          return { ...c, agencyRoles: roles };
                        })
                      }
                      placeholder="Role ID"
                      className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    />
                    <textarea
                      value={role.instruction}
                      onChange={(e) =>
                        setConfig((c) => {
                          const roles = [...c.agencyRoles];
                          roles[i] = { ...roles[i], instruction: e.target.value };
                          return { ...c, agencyRoles: roles };
                        })
                      }
                      rows={2}
                      placeholder="Instruction…"
                      className="w-full resize-none rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          agencyRoles: c.agencyRoles.filter((_, j) => j !== i),
                        }))
                      }
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      agencyRoles: [...c.agencyRoles, { roleId: 'new-agent', instruction: '' }],
                    }))
                  }
                  className="w-full rounded border border-dashed theme-border py-1 text-[10px] theme-text-muted hover:theme-text-secondary transition-colors"
                >
                  + Add Agent
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ——— Right: chat area with inline quick settings ——— */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Quick settings bar — flex-wrap blocks with guaranteed min-widths */}
          <div className="flex-none border-b theme-border px-3 py-2">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-[10px]">
              {/* Temperature */}
              <div className="min-w-[110px] flex-1">
                <label className="block uppercase tracking-[0.1em] theme-text-muted mb-1">Temp</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))
                    }
                    className="flex-1 min-w-0 accent-[color:var(--color-accent-primary)]"
                  />
                  <span className="font-mono theme-text-secondary flex-none">
                    {settings.temperature.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Max Steps */}
              <div className="min-w-[60px] w-[70px]">
                <label className="block uppercase tracking-[0.1em] theme-text-muted mb-1">Steps</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxSteps}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maxSteps: Number(e.target.value) }))
                  }
                  className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>

              {/* Max Tokens */}
              <div className="min-w-[70px] w-[80px]">
                <label className="block uppercase tracking-[0.1em] theme-text-muted mb-1">Tokens</label>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  step={64}
                  value={settings.maxTokens}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maxTokens: Number(e.target.value) }))
                  }
                  className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>

              {/* Guardrail tier */}
              <div className="min-w-[90px]">
                <div className="flex items-center gap-1 mb-1">
                  <label className="uppercase tracking-[0.1em] theme-text-muted">Guard</label>
                  <HelpTooltip label="Guardrail security tier">
                    Controls which safety filters are applied.
                  </HelpTooltip>
                </div>
                <select
                  value={settings.guardrailTier}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      guardrailTier: e.target.value as GuardrailTier,
                    }))
                  }
                  className="w-full rounded border theme-border bg-[color:var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] theme-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  {GUARDRAIL_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trace events */}
              <label className="flex items-center gap-1.5 cursor-pointer theme-text-secondary whitespace-nowrap pb-0.5">
                <input
                  type="checkbox"
                  checked={settings.traceEvents}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, traceEvents: e.target.checked }))
                  }
                  className="h-3 w-3 rounded accent-[color:var(--color-accent-primary)]"
                />
                Trace
              </label>
            </div>
          </div>

          {/* Message area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="hidden lg:flex h-full items-center justify-center">
                <div className="text-center space-y-2">
                  <Zap className="mx-auto h-8 w-8 theme-text-muted" />
                  <p className="text-sm font-medium theme-text-secondary">
                    Type a prompt to start
                  </p>
                  <p className="text-xs theme-text-muted">
                    Ctrl+Enter to send
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs theme-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Generating…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="flex-none border-t theme-border p-3">
            {/* Cost estimator badge */}
            {input.trim() && (
              <p className="mb-1.5 text-right text-[10px] theme-text-muted">
                <Cpu className="inline h-3 w-3 mr-0.5" />
                Est. cost: {formatCost(estimatedCost)} · ~{Math.ceil((config.systemPrompt.length + input.length) / 4)} prompt tok
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Type your prompt… (Ctrl+Enter to send)"
                disabled={isStreaming}
                className="flex-1 resize-none rounded-lg border theme-border bg-[color:var(--color-background-secondary)] px-3 py-2 text-sm theme-text-primary placeholder:theme-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex-none rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  className="flex-none rounded-lg bg-[color:var(--color-accent-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
