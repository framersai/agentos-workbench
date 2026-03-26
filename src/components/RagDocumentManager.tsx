/**
 * RagDocumentManager — document upload, index browser, search tester, and
 * collection manager for the AgentOS RAG stack.
 *
 * Sub-tabs:
 *   Upload     — drag-and-drop file area + URL input.
 *   Documents  — indexed document table with delete action.
 *   Search     — query input, rerank toggle, results with relevance scores.
 *   Chunks     — per-document chunk viewer with token counts.
 *   Collections — create/delete named collections, assign documents.
 *
 * All state lives in {@link useRagDocStore}.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Globe,
  Search,
  Layers,
  Folder,
  Upload,
  Trash2,
  RefreshCw,
  Link,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { useRagDocStore, type RagDocument, type SearchResult, type DocumentChunk } from '@/state/ragDocStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type RagSubTab = 'upload' | 'documents' | 'search' | 'chunks' | 'collections';

const SUB_TABS: Array<{ key: RagSubTab; label: string }> = [
  { key: 'upload',      label: 'Upload'      },
  { key: 'documents',   label: 'Documents'   },
  { key: 'search',      label: 'Search'      },
  { key: 'chunks',      label: 'Chunks'      },
  { key: 'collections', label: 'Collections' },
];

// ---------------------------------------------------------------------------
// Document type icon + badge
// ---------------------------------------------------------------------------

const DOC_TYPE_ICON: Record<RagDocument['type'], LucideIcon> = {
  markdown: FileText,
  pdf:      FileText,
  text:     FileText,
  url:      Globe,
};

const DOC_TYPE_COLOR: Record<RagDocument['type'], string> = {
  markdown: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  pdf:      'border-rose-500/30 bg-rose-500/10 text-rose-400',
  text:     'border-violet-500/30 bg-violet-500/10 text-violet-400',
  url:      'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
};

function DocTypeBadge({ type }: { type: RagDocument['type'] }) {
  return (
    <span className={`rounded-sm border px-1.5 py-px text-[9px] font-medium uppercase ${DOC_TYPE_COLOR[type]}`}>
      {type}
    </span>
  );
}

function formatBytes(bytes?: number): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Drag-and-drop upload area
// ---------------------------------------------------------------------------

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}

function DropZone({ onFiles, uploading }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors',
        dragOver ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary',
      ].join(' ')}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      role="button"
      tabIndex={0}
      aria-label="Drop files here or click to browse"
    >
      <Upload size={24} className={dragOver ? 'text-sky-400' : 'theme-text-muted'} aria-hidden="true" />
      <div className="text-center">
        <p className="text-xs font-medium theme-text-primary">
          {uploading ? 'Uploading…' : 'Drop files here, or click to browse'}
        </p>
        <p className="mt-0.5 text-[10px] theme-text-muted">
          Supports .md, .txt, .pdf files
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.txt,.pdf,text/plain,text/markdown,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL input row
// ---------------------------------------------------------------------------

interface UrlInputRowProps {
  onSubmit: (url: string) => void;
  uploading: boolean;
}

function UrlInputRow({ onSubmit, uploading }: UrlInputRowProps) {
  const [value, setValue] = useState('');
  const handle = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-text-muted" aria-hidden="true" />
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
          placeholder="https://example.com/docs"
          className="w-full rounded-md border theme-border theme-bg-primary py-1.5 pl-7 pr-3 text-xs theme-text-primary placeholder:theme-text-muted focus:border-sky-500 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={handle}
        disabled={!value.trim() || uploading}
        className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {uploading ? <RefreshCw size={11} className="animate-spin" aria-hidden="true" /> : 'Index URL'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document table row
// ---------------------------------------------------------------------------

interface DocRowProps {
  doc: RagDocument;
  onDelete: () => void;
  onViewChunks: () => void;
}

function DocRow({ doc, onDelete, onViewChunks }: DocRowProps) {
  const Icon = DOC_TYPE_ICON[doc.type];
  return (
    <li className="flex items-center gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2 text-[10px]">
      <Icon size={12} className="shrink-0 theme-text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium theme-text-primary">{doc.name}</p>
        <p className="theme-text-muted">
          {doc.chunkCount} chunks · {formatBytes(doc.sizeBytes)} ·{' '}
          {new Date(doc.indexedAt).toLocaleDateString()}
        </p>
      </div>
      <DocTypeBadge type={doc.type} />
      <button
        type="button"
        onClick={onViewChunks}
        className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-secondary hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title="View chunks"
      >
        Chunks
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] text-rose-400 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title="Delete document from index"
      >
        <Trash2 size={9} aria-hidden="true" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Search result card
// ---------------------------------------------------------------------------

function SearchResultCard({ result, rank }: { result: SearchResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-lg border theme-border theme-bg-primary px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-mono text-sky-400">#{rank}</span>
            <span className="font-medium theme-text-primary truncate">{result.documentName}</span>
            <span className="theme-text-muted shrink-0">chunk {result.chunkIndex}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] theme-text-secondary">
            <span>
              Score: <span className="font-mono font-semibold theme-text-primary">{result.score.toFixed(3)}</span>
            </span>
            {result.rerankScore != null && (
              <span>
                Rerank: <span className="font-mono font-semibold text-emerald-400">{result.rerankScore.toFixed(3)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] p-1 theme-text-secondary hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap break-all rounded-md border theme-border bg-[color:var(--color-background-tertiary,theme(colors.slate.900))] p-2 text-[10px] theme-text-secondary max-h-40 overflow-y-auto">
          {result.text}
        </pre>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Chunk viewer card
// ---------------------------------------------------------------------------

function ChunkCard({ chunk }: { chunk: DocumentChunk }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-lg border theme-border theme-bg-primary px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="font-mono text-sky-400">#{chunk.index}</span>
          <span className="theme-text-secondary">{chunk.tokenCount} tokens</span>
          {chunk.overlapTokens > 0 && (
            <span className="theme-text-muted">{chunk.overlapTokens} overlap</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-secondary hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'View'}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap break-all rounded-md border theme-border bg-[color:var(--color-background-tertiary,theme(colors.slate.900))] p-2 text-[10px] theme-text-secondary max-h-40 overflow-y-auto">
          {chunk.text}
        </pre>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * RagDocumentManager — full document lifecycle management for the AgentOS RAG stack.
 *
 * Upload files or URLs, browse indexed documents, test semantic search queries,
 * inspect how documents were chunked, and manage named collections.
 */
export function RagDocumentManager() {
  const documents       = useRagDocStore((s) => s.documents);
  const searchResults   = useRagDocStore((s) => s.searchResults);
  const rerankEnabled   = useRagDocStore((s) => s.rerankEnabled);
  const selectedDocChunks = useRagDocStore((s) => s.selectedDocChunks);
  const selectedDocId   = useRagDocStore((s) => s.selectedDocId);
  const collections     = useRagDocStore((s) => s.collections);
  const embeddingCostUsd = useRagDocStore((s) => s.embeddingCostUsd);
  const embeddingCallCount = useRagDocStore((s) => s.embeddingCallCount);
  const loading         = useRagDocStore((s) => s.loading);
  const uploading       = useRagDocStore((s) => s.uploading);
  const searching       = useRagDocStore((s) => s.searching);
  const chunksLoading   = useRagDocStore((s) => s.chunksLoading);
  const fetchDocuments  = useRagDocStore((s) => s.fetchDocuments);
  const uploadFile      = useRagDocStore((s) => s.uploadFile);
  const uploadUrl       = useRagDocStore((s) => s.uploadUrl);
  const search          = useRagDocStore((s) => s.search);
  const setRerankEnabled = useRagDocStore((s) => s.setRerankEnabled);
  const fetchChunks     = useRagDocStore((s) => s.fetchChunks);
  const createCollection = useRagDocStore((s) => s.createCollection);
  const deleteCollection = useRagDocStore((s) => s.deleteCollection);
  const assignToCollection = useRagDocStore((s) => s.assignToCollection);
  const deleteDocument  = useRagDocStore((s) => s.deleteDocument);

  const [activeSubTab, setActiveSubTab]   = useState<RagSubTab>('upload');
  const [searchQuery, setSearchQuery]     = useState('');
  const [newColName, setNewColName]       = useState('');

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleFiles = useCallback(
    (files: File[]) => {
      files.forEach((f) => void uploadFile(f));
    },
    [uploadFile],
  );

  const handleSearch = () => {
    if (searchQuery.trim()) void search(searchQuery.trim());
  };

  const selectedDocName = documents.find((d) => d.id === selectedDocId)?.name ?? 'Unknown';

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">RAG</p>
            <h3 className="text-sm font-semibold theme-text-primary">Document Manager</h3>
          </div>
          <HelpTooltip label="Explain RAG document manager" side="bottom">
            Upload documents into the vector store, browse indexed content, test semantic search,
            inspect chunk splits, and organise documents into named collections.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-2">
          {/* Embedding cost badge */}
          <span
            className="rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-muted"
            title={`${embeddingCallCount} embedding API calls this session`}
          >
            embed: ${embeddingCostUsd.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={() => void fetchDocuments()}
            disabled={loading}
            title="Refresh document list"
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
            {key === 'documents' && documents.length > 0 && (
              <span className="ml-1 rounded-full bg-sky-500/30 px-1 text-[9px]">{documents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upload tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'upload' && (
        <div className="space-y-4">
          <DropZone onFiles={handleFiles} uploading={uploading} />
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Index a URL</p>
            <UrlInputRow onSubmit={(url) => void uploadUrl(url)} uploading={uploading} />
          </div>
          <p className="text-[10px] theme-text-muted">
            Documents are chunked, embedded with the configured model, and stored in the active vector
            store.  Embedding cost accumulates in the header badge.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Documents tab                                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'documents' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <FileText size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No documents indexed yet.</p>
              <p className="text-[10px] theme-text-muted">Upload files or index URLs in the Upload tab.</p>
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="Indexed documents">
              {documents.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onDelete={() => deleteDocument(doc.id)}
                  onViewChunks={() => {
                    void fetchChunks(doc.id);
                    setActiveSubTab('chunks');
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Search tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'search' && (
        <div className="space-y-3">
          {/* Query + rerank */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-text-muted" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search documents…"
                className="w-full rounded-md border theme-border theme-bg-primary py-1.5 pl-7 pr-3 text-xs theme-text-primary placeholder:theme-text-muted focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searching}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {searching ? <RefreshCw size={11} className="animate-spin" aria-hidden="true" /> : 'Search'}
            </button>
          </div>

          {/* Rerank toggle */}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border theme-border theme-bg-primary px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={rerankEnabled}
              onChange={(e) => setRerankEnabled(e.target.checked)}
              className="shrink-0 accent-sky-500"
            />
            <div>
              <span className="font-semibold theme-text-primary">Enable Reranking</span>
              <p className="mt-0.5 text-[10px] theme-text-secondary">
                Apply a cross-encoder reranker after initial vector retrieval.
              </p>
            </div>
          </label>

          {/* Results */}
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-6 text-center">
              <Search size={18} className="theme-text-muted" aria-hidden="true" />
              <p className="text-[10px] theme-text-muted">Run a search query above to see retrieved chunks.</p>
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="Search results">
              {searchResults.map((result, i) => (
                <SearchResultCard key={`${result.documentId}-${result.chunkIndex}`} result={result} rank={i + 1} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Chunks tab                                                           */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'chunks' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              {selectedDocId ? `Chunks — ${selectedDocName}` : 'Chunks'}
            </p>
            {chunksLoading && (
              <RefreshCw size={11} className="animate-spin theme-text-muted" aria-hidden="true" />
            )}
          </div>

          {!selectedDocId ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Layers size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No document selected.</p>
              <p className="text-[10px] theme-text-muted">
                Click &ldquo;Chunks&rdquo; on any document in the Documents tab.
              </p>
            </div>
          ) : selectedDocChunks.length === 0 && !chunksLoading ? (
            <p className="text-[10px] theme-text-muted">No chunks found for this document.</p>
          ) : (
            <ul className="space-y-1.5" aria-label="Document chunks">
              {selectedDocChunks.map((chunk) => (
                <ChunkCard key={chunk.index} chunk={chunk} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Collections tab                                                      */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'collections' && (
        <div className="space-y-4">
          {/* Create collection */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">New Collection</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newColName.trim()) {
                    createCollection(newColName.trim());
                    setNewColName('');
                  }
                }}
                placeholder="Collection name…"
                className="flex-1 rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary placeholder:theme-text-muted focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newColName.trim()) {
                    createCollection(newColName.trim());
                    setNewColName('');
                  }
                }}
                disabled={!newColName.trim()}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Create
              </button>
            </div>
          </div>

          {/* Collections list */}
          {collections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-6 text-center">
              <Folder size={18} className="theme-text-muted" aria-hidden="true" />
              <p className="text-[10px] theme-text-muted">No collections yet. Create one above.</p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Collections">
              {collections.map((col) => (
                <li key={col.id} className="rounded-lg border theme-border theme-bg-primary px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <Folder size={11} className="theme-text-muted shrink-0" aria-hidden="true" />
                      <span className="font-medium theme-text-primary">{col.name}</span>
                      <span className="theme-text-muted">{col.documentIds.length} docs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCollection(col.id)}
                      className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] text-rose-400 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      title="Delete collection"
                    >
                      <Trash2 size={9} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Assign document dropdown */}
                  {documents.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            assignToCollection(e.target.value, col.id);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 rounded-md border theme-border bg-[color:var(--color-background-secondary)] px-2 py-1 text-[10px] theme-text-primary focus:border-sky-500 focus:outline-none"
                        title="Assign a document to this collection"
                      >
                        <option value="" disabled>Assign document…</option>
                        {documents
                          .filter((d) => !d.collectionIds.includes(col.id))
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Assigned docs */}
                  {col.documentIds.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {col.documentIds.map((docId) => {
                        const doc = documents.find((d) => d.id === docId);
                        if (!doc) return null;
                        return (
                          <li key={docId} className="flex items-center gap-1.5 text-[9px] theme-text-secondary">
                            <FileText size={9} className="theme-text-muted shrink-0" aria-hidden="true" />
                            <span className="truncate">{doc.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
