/**
 * RAG document management routes.
 *
 * Exposes:
 *   GET  /api/rag/documents              — list indexed documents
 *   POST /api/rag/upload                 — index a file or URL
 *   POST /api/rag/search                 — semantic search over documents
 *   GET  /api/rag/documents/:id/chunks   — list chunks for a specific document
 *
 * All responses return demo data in the workbench context since no live
 * vector store is guaranteed to be present.  A production deployment
 * would delegate to the AgentOS RetrievalAugmentor service.
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// In-memory document store for the demo session
// ---------------------------------------------------------------------------

interface RagDocument {
  id: string;
  name: string;
  type: 'markdown' | 'pdf' | 'text' | 'url';
  chunkCount: number;
  indexedAt: string;
  sizeBytes?: number;
  collectionIds: string[];
}

interface DocumentChunk {
  index: number;
  text: string;
  tokenCount: number;
  overlapTokens: number;
}

interface SearchResult {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
  rerankScore?: number;
}

// Seed the in-memory store with demo documents.
const docStore: RagDocument[] = [
  { id: 'doc-001', name: 'AgentOS Architecture.md',      type: 'markdown', chunkCount: 24, indexedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), sizeBytes: 18_432, collectionIds: ['col-001'] },
  { id: 'doc-002', name: 'Voice Pipeline Runbook.pdf',   type: 'pdf',      chunkCount: 41, indexedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(), sizeBytes: 124_288, collectionIds: ['col-001'] },
  { id: 'doc-003', name: 'https://agentos.sh/docs',      type: 'url',      chunkCount: 12, indexedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),  collectionIds: [] },
  { id: 'doc-004', name: 'Guardrail Configuration.md',   type: 'markdown', chunkCount: 8,  indexedAt: new Date(Date.now() - 30 * 60_000).toISOString(),    sizeBytes: 6_144, collectionIds: ['col-002'] },
];

/**
 * Generate realistic-looking demo chunks for any document id.
 *
 * @param doc - The document to generate chunks for.
 * @returns An array of demo DocumentChunk objects.
 */
function buildChunks(doc: RagDocument): DocumentChunk[] {
  return Array.from({ length: Math.min(doc.chunkCount, 6) }, (_, i) => ({
    index: i,
    text: `[Demo chunk ${i} of "${doc.name}"]\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
    tokenCount: 110 + i * 8,
    overlapTokens: i === 0 ? 0 : 20,
  }));
}

/**
 * Generate demo search results for a query.
 *
 * @param query   - The search query string.
 * @param rerank  - Whether reranking was requested (adds rerankScore).
 * @returns An array of demo SearchResult objects.
 */
function buildSearchResults(query: string, rerank: boolean): SearchResult[] {
  return docStore.slice(0, 3).map((doc, i) => ({
    documentId: doc.id,
    documentName: doc.name,
    chunkIndex: i,
    text: `[Demo result ${i + 1} for "${query}"]\n\nThis chunk is from "${doc.name}" and contains relevant content about: ${query}.`,
    score: parseFloat((0.95 - i * 0.07).toFixed(3)),
    rerankScore: rerank ? parseFloat((0.97 - i * 0.05).toFixed(3)) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Registers RAG document management routes on the provided Fastify instance.
 * Intended to be mounted at `/api/rag` in the main server.
 *
 * @param fastify - Fastify server instance.
 */
export default async function ragRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/rag/documents */
  fastify.get('/documents', {
    schema: {
      description: 'List all indexed RAG documents',
      tags: ['RAG'],
      response: {
        200: {
          type: 'object',
          properties: {
            documents: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async () => {
    return { documents: docStore };
  });

  /** POST /api/rag/upload */
  fastify.post<{ Body: { url?: string } }>('/upload', {
    schema: {
      description: 'Upload a file or URL for indexing into the vector store',
      tags: ['RAG'],
    },
  }, async (request) => {
    const body = request.body as { url?: string } | undefined;

    // URL-based ingestion.
    if (body?.url) {
      const doc: RagDocument = {
        id: crypto.randomUUID(),
        name: body.url,
        type: 'url',
        chunkCount: 10,
        indexedAt: new Date().toISOString(),
        collectionIds: [],
      };
      docStore.unshift(doc);
      return { document: doc, costUsd: 0.0002, callCount: doc.chunkCount };
    }

    // File upload — return a placeholder without actual multipart parsing in demo mode.
    const doc: RagDocument = {
      id: crypto.randomUUID(),
      name: 'uploaded-document.md',
      type: 'markdown',
      chunkCount: 8,
      indexedAt: new Date().toISOString(),
      sizeBytes: 4_096,
      collectionIds: [],
    };
    docStore.unshift(doc);
    return { document: doc, costUsd: 0.0004, callCount: doc.chunkCount };
  });

  /** POST /api/rag/search */
  fastify.post<{ Body: { query: string; rerank?: boolean } }>('/search', {
    schema: {
      description: 'Perform a semantic search over indexed documents',
      tags: ['RAG'],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query:  { type: 'string' },
          rerank: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            results: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async (request) => {
    const { query, rerank = false } = request.body;
    const results = buildSearchResults(query, rerank);
    return { results };
  });

  /** GET /api/rag/documents/:id/chunks */
  fastify.get<{ Params: { id: string } }>('/documents/:id/chunks', {
    schema: {
      description: 'Return the chunk list for a specific indexed document',
      tags: ['RAG'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            chunks: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async (request) => {
    const doc = docStore.find((d) => d.id === request.params.id);
    if (!doc) {
      return { chunks: [] };
    }
    return { chunks: buildChunks(doc) };
  });
}
