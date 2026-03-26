/**
 * @file CommandPalette.tsx
 * @description Ctrl+K command palette for quick navigation across all panels.
 *
 * Opens on Ctrl+K / Cmd+K, closes on Escape or backdrop click.
 * Supports fuzzy-search filtering across all available tabs and actions.
 *
 * @example
 * ```tsx
 * <CommandPalette
 *   open={showPalette}
 *   onClose={() => setShowPalette(false)}
 *   onNavigate={(key) => setLeftTab(key)}
 * />
 * ```
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Columns,
  Cpu,
  FileUp,
  Hammer,
  Home,
  Layers,
  MessageSquare,
  Mic,
  Network,
  Package,
  Search,
  Shield,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  /** Navigation key passed to onNavigate. */
  key: string;
  /** Displayed label. */
  label: string;
  /** Short description shown below the label. */
  description?: string;
  icon: React.ReactNode;
  /** Keywords that improve search matching. */
  keywords?: string[];
}

// ---------------------------------------------------------------------------
// Command catalogue
// ---------------------------------------------------------------------------

const COMMANDS: CommandItem[] = [
  { key: 'home', label: 'Home Dashboard', description: 'Overview, KPI cards, activity feed', icon: <Home className="h-4 w-4" />, keywords: ['overview', 'kpi', 'dashboard'] },
  { key: 'playground', label: 'Agent Playground', description: 'Interactive REPL for testing agents', icon: <Bot className="h-4 w-4" />, keywords: ['repl', 'chat', 'test', 'run'] },
  { key: 'prompt-workspace', label: 'Prompt Workspace', description: 'Prompt engineering with A/B compare', icon: <Columns className="h-4 w-4" />, keywords: ['prompt', 'compare', 'diff', 'engineering'] },
  { key: 'compose', label: 'Compose', description: 'Write a new request', icon: <Zap className="h-4 w-4" /> },
  { key: 'personas', label: 'Personas', description: 'Browse and manage personas', icon: <Users className="h-4 w-4" />, keywords: ['agent', 'character'] },
  { key: 'agency', label: 'Agency', description: 'Multi-agent collectives', icon: <Users className="h-4 w-4" />, keywords: ['multi', 'collective'] },
  { key: 'workflows', label: 'Workflows', description: 'Workflow definitions', icon: <Layers className="h-4 w-4" /> },
  { key: 'graph-builder', label: 'Graph Builder', description: 'Visual workflow graph editor', icon: <Network className="h-4 w-4" />, keywords: ['graph', 'visual', 'editor'] },
  { key: 'tool-forge', label: 'Tool Forge', description: 'Emergent tool generation', icon: <Hammer className="h-4 w-4" />, keywords: ['forge', 'generate', 'tool'] },
  { key: 'capabilities', label: 'Extensions', description: 'Browse and install extensions', icon: <Package className="h-4 w-4" />, keywords: ['extensions', 'install', 'browse'] },
  { key: 'rag-docs', label: 'Upload Documents', description: 'RAG document manager', icon: <FileUp className="h-4 w-4" />, keywords: ['rag', 'documents', 'upload', 'retrieval'] },
  { key: 'hitl', label: 'HITL Queue', description: 'Human-in-the-loop approvals', icon: <Shield className="h-4 w-4" />, keywords: ['approval', 'human', 'review'] },
  { key: 'channels', label: 'Channels', description: '37-channel connection manager', icon: <MessageSquare className="h-4 w-4" />, keywords: ['slack', 'discord', 'telegram', 'channel'] },
  { key: 'call-monitor', label: 'Call Monitor', description: 'Live voice call monitoring', icon: <Mic className="h-4 w-4" />, keywords: ['voice', 'call', 'live'] },
  { key: 'observability', label: 'Observability', description: 'Metrics, traces, logs', icon: <Activity className="h-4 w-4" />, keywords: ['metrics', 'traces', 'logs', 'monitor'] },
  { key: 'guardrail-eval', label: 'Guardrail Eval', description: 'Security guardrail testing', icon: <Shield className="h-4 w-4" />, keywords: ['safety', 'security', 'guardrail'] },
  { key: 'memory', label: 'Memory', description: 'Agent memory dashboard', icon: <Cpu className="h-4 w-4" /> },
  { key: 'rag', label: 'RAG Config', description: 'Retrieval-augmented generation settings', icon: <Wrench className="h-4 w-4" />, keywords: ['retrieval', 'rag', 'config'] },
  { key: 'voice', label: 'Voice Pipeline', description: 'STT/TTS pipeline settings', icon: <Mic className="h-4 w-4" />, keywords: ['speech', 'stt', 'tts'] },
  { key: 'social', label: 'Social', description: 'Social post composer', icon: <MessageSquare className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Fuzzy match helper
// ---------------------------------------------------------------------------

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    item.label,
    item.description ?? '',
    ...(item.keywords ?? []),
    item.key,
  ].join(' ').toLowerCase();
  return q.split(' ').every((word) => haystack.includes(word));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (key: string) => void;
}

/**
 * Ctrl+K command palette for quick navigation.
 */
export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => COMMANDS.filter((c) => matches(c, query)), [query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selected];
        if (item) {
          onNavigate(item.key);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, onNavigate, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border theme-border bg-[color:var(--color-background-primary)] shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b theme-border px-3 py-2.5">
          <Search className="h-4 w-4 flex-none theme-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search panels and actions…"
            className="flex-1 bg-transparent text-sm theme-text-primary placeholder:theme-text-muted focus:outline-none"
          />
          <kbd className="rounded border theme-border px-1.5 py-0.5 text-[10px] theme-text-muted">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <ul
          ref={listRef}
          className="max-h-72 overflow-y-auto py-1"
          role="listbox"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm theme-text-muted text-center">
              No results for &ldquo;{query}&rdquo;
            </li>
          )}
          {filtered.map((item, i) => (
            <li
              key={item.key}
              role="option"
              aria-selected={i === selected}
              onClick={() => { onNavigate(item.key); onClose(); }}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                i === selected
                  ? 'bg-[color:var(--color-accent-primary)] text-white'
                  : 'theme-text-secondary hover:bg-[color:var(--color-background-secondary)]'
              }`}
            >
              <span className={i === selected ? 'opacity-90' : 'theme-text-muted'}>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${i === selected ? 'text-white' : 'theme-text-primary'}`}>
                  {item.label}
                </p>
                {item.description && (
                  <p className={`text-[11px] truncate ${i === selected ? 'text-white/70' : 'theme-text-muted'}`}>
                    {item.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t theme-border px-3 py-1.5 text-[10px] theme-text-muted">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">Enter</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
