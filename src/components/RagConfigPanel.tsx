/**
 * @file RagConfigPanel.tsx
 * @description Configure the Retrieval-Augmented Generation (RAG) stack
 * for an agency run.
 *
 * Vector store options:
 *
 * | Backend    | Persistence | Best For                       |
 * |------------|-------------|--------------------------------|
 * | In-Memory  | Ephemeral   | Dev / small corpora (< 5 k)   |
 * | HNSWlib    | Local disk  | Medium corpora (5 k -- 500 k) |
 * | Qdrant     | Remote DB   | Production / large corpora     |
 *
 * Retrieval tuning:
 *   - **topK** (1--20): number of top document chunks per query.
 *   - **minScore** (0--1): cosine-similarity floor for inclusion.
 *
 * Document sources support three loaders:
 *   - `markdown` -- local `.md` files.
 *   - `web`      -- fetches + extracts from a URL.
 *   - `pdf`      -- local PDF extraction.
 *
 * Optional per-agent access notes let you restrict which agent roles may
 * query the RAG index (e.g. "Only the researcher role may access the legal
 * documents index.").
 *
 * Config flows upward via {@link RagConfigPanelProps.onConfigChange}.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported vector store backends for the RAG pipeline. */
export type VectorStoreKind = 'in-memory' | 'hnswlib' | 'qdrant';

/** Supported document loaders for indexing sources. */
export type DocumentLoader = 'markdown' | 'web' | 'pdf';

/** A single document source added to the RAG index. */
export interface DocumentSource {
  /** UUID generated client-side via `crypto.randomUUID()`. */
  id: string;
  /** Local file path or remote URL to index. */
  pathOrUrl: string;
  /** How to parse this source (markdown, web, or pdf). */
  loader: DocumentLoader;
}

export interface RagConfig {
  enabled: boolean;
  vectorStore: VectorStoreKind;
  embeddingModel: string;
  topK: number;
  minScore: number;
  sources: DocumentSource[];
  /** Optional instructions for restricting which agents have RAG access. */
  agentAccessNotes: string;
}

export interface RagConfigPanelProps {
  value?: RagConfig;
  onConfigChange?: (config: RagConfig) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RagConfig = {
  enabled: false,
  vectorStore: 'in-memory',
  embeddingModel: 'text-embedding-3-small',
  topK: 5,
  minScore: 0.7,
  sources: [],
  agentAccessNotes: '',
};

const VECTOR_STORE_OPTIONS: Array<{ value: VectorStoreKind; label: string; description: string }> = [
  { value: 'in-memory', label: 'In-Memory', description: 'Fast, ephemeral. Good for dev and small corpora.' },
  { value: 'hnswlib', label: 'HNSWlib', description: 'Persistent local index. Good for medium-sized corpora.' },
  { value: 'qdrant', label: 'Qdrant', description: 'Production vector DB. Requires a running Qdrant instance.' },
];

const LOADER_OPTIONS: Array<{ value: DocumentLoader; label: string }> = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'web', label: 'Web / URL' },
  { value: 'pdf', label: 'PDF' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RagConfigPanel — configure retrieval-augmented generation for agency runs.
 */
export function RagConfigPanel({ value, onConfigChange }: RagConfigPanelProps) {
  const [config, setConfig] = useState<RagConfig>(value ?? DEFAULT_CONFIG);
  const [newPath, setNewPath] = useState('');
  const [newLoader, setNewLoader] = useState<DocumentLoader>('markdown');

  const update = (patch: Partial<RagConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    onConfigChange?.(next);
  };

  const addSource = () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    const source: DocumentSource = {
      id: crypto.randomUUID(),
      pathOrUrl: trimmed,
      loader: newLoader,
    };
    update({ sources: [...config.sources, source] });
    setNewPath('');
  };

  const removeSource = (id: string) => {
    update({ sources: config.sources.filter((s) => s.id !== id) });
  };

  const updateSourceLoader = (id: string, loader: DocumentLoader) => {
    update({
      sources: config.sources.map((s) => (s.id === id ? { ...s, loader } : s)),
    });
  };

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Agency</p>
          <h3 className="text-sm font-semibold theme-text-primary">RAG Configuration</h3>
        </div>
        <HelpTooltip label="Explain RAG config panel" side="bottom">
          Configure Retrieval-Augmented Generation so agents can search your documents before
          generating responses. Pick a vector store backend, tune retrieval parameters, and add
          document sources.
        </HelpTooltip>
      </header>

      {/* Enable toggle */}
      <div className="mb-4">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border theme-border theme-bg-primary px-3 py-2 transition-colors hover:bg-white/5">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="shrink-0 accent-sky-500"
          />
          <div>
            <span className="text-xs font-semibold theme-text-primary">Enable RAG</span>
            <p className="mt-0.5 text-[10px] theme-text-secondary">
              Agents will retrieve relevant document chunks before each response.
            </p>
          </div>
        </label>
      </div>

      {config.enabled && (
        <>
          {/* Vector store */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Vector Store
            </p>
            <div className="space-y-1">
              {VECTOR_STORE_OPTIONS.map(({ value: storeVal, label, description }) => {
                const selected = config.vectorStore === storeVal;
                return (
                  <label
                    key={storeVal}
                    className={[
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                      selected
                        ? 'border-sky-500/60 bg-sky-500/10'
                        : 'theme-border theme-bg-primary hover:bg-white/5',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="rag-vector-store"
                      checked={selected}
                      onChange={() => update({ vectorStore: storeVal })}
                      className="mt-0.5 shrink-0 accent-sky-500"
                    />
                    <div>
                      <span
                        className={
                          selected
                            ? 'text-xs font-semibold text-sky-400'
                            : 'text-xs font-semibold theme-text-primary'
                        }
                      >
                        {label}
                      </span>
                      <p className="mt-0.5 text-[10px] theme-text-secondary">{description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Embedding model */}
          <div className="mb-4">
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Embedding Model
            </p>
            <input
              type="text"
              value={config.embeddingModel}
              onChange={(e) => update({ embeddingModel: e.target.value })}
              title="Embedding model identifier, e.g. text-embedding-3-small or a local model ID."
              placeholder="text-embedding-3-small"
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* topK + minScore sliders */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {/* topK */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Top-K</p>
                <span className="text-xs font-semibold theme-text-primary">{config.topK}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={config.topK}
                onChange={(e) => update({ topK: Number(e.target.value) })}
                title="Number of top document chunks to retrieve per query."
                className="w-full accent-sky-500"
              />
              <div className="mt-0.5 flex justify-between text-[9px] theme-text-muted">
                <span>1</span>
                <span>20</span>
              </div>
            </div>

            {/* minScore */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Min Score</p>
                <span className="text-xs font-semibold theme-text-primary">
                  {config.minScore.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.minScore}
                onChange={(e) => update({ minScore: Number(e.target.value) })}
                title="Minimum cosine similarity score for a chunk to be included in context."
                className="w-full accent-sky-500"
              />
              <div className="mt-0.5 flex justify-between text-[9px] theme-text-muted">
                <span>0.00</span>
                <span>1.00</span>
              </div>
            </div>
          </div>

          {/* Document sources */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Document Sources
            </p>

            {config.sources.length === 0 ? (
              <p className="mb-2 rounded-lg border border-dashed theme-border px-3 py-2 text-[10px] theme-text-muted">
                No sources added yet. Add a file path or URL below.
              </p>
            ) : (
              <ul className="mb-2 space-y-1.5">
                {config.sources.map((src) => (
                  <li
                    key={src.id}
                    className="flex items-center gap-2 rounded-lg border theme-border theme-bg-primary px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] theme-text-primary">
                      {src.pathOrUrl}
                    </span>
                    <select
                      value={src.loader}
                      onChange={(e) => updateSourceLoader(src.id, e.target.value as DocumentLoader)}
                      title="Loader type for this document source."
                      className="rounded border theme-border bg-[color:var(--color-background-secondary)] px-1 py-0.5 text-[10px] theme-text-primary focus:outline-none"
                    >
                      {LOADER_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSource(src.id)}
                      title="Remove this document source."
                      className="shrink-0 rounded-full border theme-border p-1 text-slate-500 transition hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Trash2 size={10} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add source row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSource(); } }}
                placeholder="/path/to/doc.md or https://…"
                title="Enter a file path or URL for a document to include in the RAG index."
                className="flex-1 rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
              />
              <select
                value={newLoader}
                onChange={(e) => setNewLoader(e.target.value as DocumentLoader)}
                title="Loader type for the new document source."
                className="rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1.5 text-xs theme-text-primary focus:outline-none"
              >
                {LOADER_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addSource}
                disabled={!newPath.trim()}
                title="Add this document source to the RAG index."
                className="inline-flex items-center gap-1 rounded-full border theme-border px-2.5 py-1 text-[10px] font-semibold theme-text-secondary transition hover:opacity-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Plus size={10} aria-hidden="true" /> Add
              </button>
            </div>
          </div>

          {/* Per-agent access notes */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Per-Agent Access Notes
            </p>
            <textarea
              value={config.agentAccessNotes}
              onChange={(e) => update({ agentAccessNotes: e.target.value })}
              rows={2}
              placeholder="Optionally restrict which roles have RAG access, e.g. 'Only the researcher role may query the legal documents index.'"
              title="Instructions for controlling which agents have access to the RAG context."
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            />
          </div>
        </>
      )}
    </section>
  );
}
