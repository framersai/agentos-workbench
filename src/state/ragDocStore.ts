/**
 * ragDocStore — Zustand store for the RagDocumentManager panel.
 *
 * Manages the indexed document list, search results, chunk viewer, collection
 * management, and embedding cost running total.
 *
 * Backend endpoints:
 *   POST /api/rag/upload
 *   GET  /api/rag/documents
 *   POST /api/rag/search
 *   GET  /api/rag/documents/:id/chunks
 */

import { create } from 'zustand';
import { resolveWorkbenchApiBaseUrl } from '@/lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single document that has been indexed into the vector store.
 */
export interface RagDocument {
  id: string;
  name: string;
  /** "markdown" | "pdf" | "text" | "url" */
  type: 'markdown' | 'pdf' | 'text' | 'url';
  /** Number of chunks this document was split into. */
  chunkCount: number;
  /** ISO-8601 of last indexing run. */
  indexedAt: string;
  /** Size in bytes, undefined for URL sources. */
  sizeBytes?: number;
  /** Collection(s) this document belongs to. */
  collectionIds: string[];
}

/**
 * A retrieved chunk returned by a RAG search query.
 */
export interface SearchResult {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  /** Chunk text. */
  text: string;
  /** Cosine similarity score 0–1. */
  score: number;
  /** Reranker score 0–1, present when reranking is on. */
  rerankScore?: number;
}

/**
 * A single chunk as returned by the chunk viewer endpoint.
 */
export interface DocumentChunk {
  index: number;
  text: string;
  /** Approximate token count. */
  tokenCount: number;
  /** Number of tokens shared with adjacent chunks. */
  overlapTokens: number;
}

/**
 * A named collection grouping documents.
 */
export interface RagCollection {
  id: string;
  name: string;
  documentIds: string[];
  /** ISO-8601 creation time. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface RagDocState {
  documents: RagDocument[];
  searchQuery: string;
  searchResults: SearchResult[];
  rerankEnabled: boolean;
  /** Currently opened document's chunks. */
  selectedDocChunks: DocumentChunk[];
  selectedDocId: string | null;
  collections: RagCollection[];
  /** Running total of embedding API call cost in USD. */
  embeddingCostUsd: number;
  /** Number of embedding API calls made this session. */
  embeddingCallCount: number;
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  chunksLoading: boolean;
  error: string | null;

  // --- Actions ---
  fetchDocuments: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  uploadUrl: (url: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  setRerankEnabled: (enabled: boolean) => void;
  fetchChunks: (docId: string) => Promise<void>;
  createCollection: (name: string) => void;
  deleteCollection: (collectionId: string) => void;
  assignToCollection: (docId: string, collectionId: string) => void;
  deleteDocument: (docId: string) => void;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_DOCS: RagDocument[] = [
  { id: 'doc-001', name: 'AgentOS Architecture.md',       type: 'markdown', chunkCount: 24, indexedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), sizeBytes: 18_432, collectionIds: ['col-001'] },
  { id: 'doc-002', name: 'Voice Pipeline Runbook.pdf',    type: 'pdf',      chunkCount: 41, indexedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(), sizeBytes: 124_288, collectionIds: ['col-001'] },
  { id: 'doc-003', name: 'https://agentos.sh/docs',       type: 'url',      chunkCount: 12, indexedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),  collectionIds: [] },
  { id: 'doc-004', name: 'Guardrail Configuration.md',    type: 'markdown', chunkCount: 8,  indexedAt: new Date(Date.now() - 30 * 60_000).toISOString(),    sizeBytes: 6_144, collectionIds: ['col-002'] },
  { id: 'doc-005', name: 'Social Broadcast Skill.txt',    type: 'text',     chunkCount: 6,  indexedAt: new Date(Date.now() - 10 * 60_000).toISOString(),    sizeBytes: 3_072, collectionIds: [] },
];

const DEMO_COLLECTIONS: RagCollection[] = [
  { id: 'col-001', name: 'Technical Docs', documentIds: ['doc-001', 'doc-002'], createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  { id: 'col-002', name: 'Security',       documentIds: ['doc-004'],             createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];

const DEMO_SEARCH_RESULTS: SearchResult[] = [
  { documentId: 'doc-001', documentName: 'AgentOS Architecture.md',    chunkIndex: 3, text: '## Capability Discovery Engine\n\nThe discovery engine uses tiered semantic matching to surface relevant tools and skills at runtime without embedding the full catalog into every prompt...', score: 0.94, rerankScore: 0.97 },
  { documentId: 'doc-002', documentName: 'Voice Pipeline Runbook.pdf', chunkIndex: 8, text: 'The voice pipeline state machine transitions: IDLE → LISTENING on VAD trigger, LISTENING → PROCESSING on endpoint detection, PROCESSING → SPEAKING on TTS generation...', score: 0.81, rerankScore: 0.88 },
  { documentId: 'doc-003', documentName: 'https://agentos.sh/docs',    chunkIndex: 1, text: 'AgentOS is an open-source multi-agent runtime with first-class voice, RAG, and guardrail support. Installation via npm install -g @agentos/cli...', score: 0.72, rerankScore: 0.74 },
];

const DEMO_CHUNKS: DocumentChunk[] = [
  { index: 0, text: '# AgentOS Architecture Overview\n\nAgentOS is a modular multi-agent orchestration runtime built on TypeScript...', tokenCount: 128, overlapTokens: 0 },
  { index: 1, text: '## Core Components\n\nThe runtime is composed of five primary subsystems: ToolOrchestrator, CapabilityDiscoveryEngine, ConversationManager, ExtensionManager, and ModelProviderManager...', tokenCount: 142, overlapTokens: 20 },
  { index: 2, text: '## ToolOrchestrator\n\nThe ToolOrchestrator maintains a registry of ITool implementations and routes incoming tool-call requests to the appropriate executor...', tokenCount: 136, overlapTokens: 20 },
  { index: 3, text: '## Capability Discovery Engine\n\nThe discovery engine uses tiered semantic matching to surface relevant tools and skills at runtime without embedding the full catalog into every prompt...', tokenCount: 155, overlapTokens: 18 },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRagDocStore = create<RagDocState>()((set, get) => ({
  documents: DEMO_DOCS,
  searchQuery: '',
  searchResults: [],
  rerankEnabled: true,
  selectedDocChunks: [],
  selectedDocId: null,
  collections: DEMO_COLLECTIONS,
  embeddingCostUsd: 0.0042,
  embeddingCallCount: 91,
  loading: false,
  uploading: false,
  searching: false,
  chunksLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/rag/documents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { documents: RagDocument[] };
      set({ loading: false, documents: data.documents ?? DEMO_DOCS });
    } catch {
      set({ loading: false, documents: DEMO_DOCS });
    }
  },

  uploadFile: async (file) => {
    set({ uploading: true, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/api/rag/upload`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { document: RagDocument; costUsd: number; callCount: number };
      set((s) => ({
        uploading: false,
        documents: [data.document, ...s.documents],
        embeddingCostUsd: s.embeddingCostUsd + (data.costUsd ?? 0),
        embeddingCallCount: s.embeddingCallCount + (data.callCount ?? 1),
      }));
    } catch {
      // Simulate adding the doc locally in demo mode.
      const doc: RagDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.md') ? 'markdown' : 'text',
        chunkCount: Math.ceil(file.size / 512),
        indexedAt: new Date().toISOString(),
        sizeBytes: file.size,
        collectionIds: [],
      };
      set((s) => ({
        uploading: false,
        documents: [doc, ...s.documents],
        embeddingCostUsd: s.embeddingCostUsd + 0.0004,
        embeddingCallCount: s.embeddingCallCount + doc.chunkCount,
      }));
    }
  },

  uploadUrl: async (url) => {
    set({ uploading: true, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/rag/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { document: RagDocument; costUsd: number; callCount: number };
      set((s) => ({
        uploading: false,
        documents: [data.document, ...s.documents],
        embeddingCostUsd: s.embeddingCostUsd + (data.costUsd ?? 0),
        embeddingCallCount: s.embeddingCallCount + (data.callCount ?? 1),
      }));
    } catch {
      const doc: RagDocument = {
        id: `doc-${Date.now()}`,
        name: url,
        type: 'url',
        chunkCount: 10,
        indexedAt: new Date().toISOString(),
        collectionIds: [],
      };
      set((s) => ({
        uploading: false,
        documents: [doc, ...s.documents],
        embeddingCostUsd: s.embeddingCostUsd + 0.0002,
        embeddingCallCount: s.embeddingCallCount + 10,
      }));
    }
  },

  search: async (query) => {
    set({ searching: true, searchQuery: query, error: null });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const { rerankEnabled } = get();
      const res = await fetch(`${base}/api/rag/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, rerank: rerankEnabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { results: SearchResult[] };
      set({ searching: false, searchResults: data.results ?? DEMO_SEARCH_RESULTS });
    } catch {
      set({ searching: false, searchResults: DEMO_SEARCH_RESULTS });
    }
  },

  setRerankEnabled: (enabled) => set({ rerankEnabled: enabled }),

  fetchChunks: async (docId) => {
    set({ chunksLoading: true, selectedDocId: docId });
    try {
      const base = resolveWorkbenchApiBaseUrl();
      const res = await fetch(`${base}/api/rag/documents/${docId}/chunks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { chunks: DocumentChunk[] };
      set({ chunksLoading: false, selectedDocChunks: data.chunks ?? DEMO_CHUNKS });
    } catch {
      set({ chunksLoading: false, selectedDocChunks: DEMO_CHUNKS });
    }
  },

  createCollection: (name) => {
    const col: RagCollection = {
      id: `col-${Date.now()}`,
      name,
      documentIds: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ collections: [...s.collections, col] }));
  },

  deleteCollection: (collectionId) =>
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== collectionId),
      documents: s.documents.map((d) => ({
        ...d,
        collectionIds: d.collectionIds.filter((id) => id !== collectionId),
      })),
    })),

  assignToCollection: (docId, collectionId) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === docId && !d.collectionIds.includes(collectionId)
          ? { ...d, collectionIds: [...d.collectionIds, collectionId] }
          : d,
      ),
      collections: s.collections.map((c) =>
        c.id === collectionId && !c.documentIds.includes(docId)
          ? { ...c, documentIds: [...c.documentIds, docId] }
          : c,
      ),
    })),

  deleteDocument: (docId) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== docId),
      collections: s.collections.map((c) => ({
        ...c,
        documentIds: c.documentIds.filter((id) => id !== docId),
      })),
    })),
}));
