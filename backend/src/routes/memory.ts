import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock memory data — mirrors the four-tier AgentOS cognitive memory model.
// Replace with real memory engine lookups once the backend store is wired up.
// ---------------------------------------------------------------------------

/**
 * A single entry in one of the long-term memory categories (episodic, semantic,
 * or procedural).
 *
 * @property id         - Stable unique identifier for delete/pin operations.
 * @property content    - Human-readable description of the remembered fact or event.
 * @property confidence - Model confidence score in [0, 1].
 * @property timestamp  - Unix ms when the entry was written.
 * @property source     - Origin of the memory: 'conversation' | 'observation' | 'rag' | 'learned' | 'policy'.
 * @property tags       - Searchable label list used for UI filtering.
 */
interface MemoryEntry {
  id: string;
  content: string;
  confidence: number;
  timestamp: number;
  source: string;
  tags: string[];
}

/**
 * Snapshot of the agent's working (context-window) memory.
 *
 * @property tokens        - Current token consumption of the active context.
 * @property maxTokens     - Hard limit imposed by the model's context window.
 * @property activeTurns   - Number of un-summarised conversation turns in context.
 * @property summarizedTurns - Turns that have been compressed into the rolling summary.
 * @property rollingSummary  - Condensed narrative of prior context used to preserve continuity.
 */
interface WorkingMemory {
  tokens: number;
  maxTokens: number;
  activeTurns: number;
  summarizedTurns: number;
  rollingSummary: string;
}

/**
 * Container for all four memory categories served by the `/memory/entries` endpoint.
 */
interface MemoryStore {
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
  working: WorkingMemory;
}

/**
 * A single entry in the memory operation timeline feed.
 *
 * @property timestamp  - Unix ms when the operation occurred.
 * @property operation  - Operation type: WRITE | RETRIEVE | CONSOLIDATE | SUMMARIZE | DELETE.
 * @property category   - Memory tier that was targeted.
 * @property content    - Short description of what was written, retrieved, or transformed.
 * @property metadata   - Arbitrary key/value bag (confidence, relevance, tokensSaved, etc.).
 */
interface TimelineEntry {
  timestamp: number;
  operation: string;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * In-memory mock data store.  State is process-scoped and resets on restart —
 * acceptable for a workbench prototype where persistence is added separately.
 */
const mockMemoryEntries: MemoryStore = {
  episodic: [
    {
      id: 'ep-1',
      content: 'User asked about billing refund policy',
      confidence: 0.85,
      timestamp: Date.now() - 180_000,
      source: 'conversation',
      tags: ['billing'],
    },
    {
      id: 'ep-2',
      content: 'User prefers formal communication style',
      confidence: 0.72,
      timestamp: Date.now() - 900_000,
      source: 'observation',
      tags: ['style'],
    },
    {
      id: 'ep-3',
      content: 'User mentioned they are a premium subscriber',
      confidence: 0.91,
      timestamp: Date.now() - 1_800_000,
      source: 'conversation',
      tags: ['account'],
    },
  ],
  semantic: [
    {
      id: 'sem-1',
      content: 'Company refund policy allows returns within 30 days',
      confidence: 0.95,
      timestamp: Date.now() - 3_600_000,
      source: 'rag',
      tags: ['policy'],
    },
    {
      id: 'sem-2',
      content: 'Business hours are 9am-5pm EST Monday through Friday',
      confidence: 0.90,
      timestamp: Date.now() - 7_200_000,
      source: 'rag',
      tags: ['hours'],
    },
  ],
  procedural: [
    {
      id: 'proc-1',
      content: 'Always use formal greeting for this user',
      confidence: 1.0,
      timestamp: Date.now() - 86_400_000,
      source: 'learned',
      tags: ['greeting'],
    },
    {
      id: 'proc-2',
      content: 'Escalate billing disputes to human agent after 2 failed resolutions',
      confidence: 0.88,
      timestamp: Date.now() - 172_800_000,
      source: 'policy',
      tags: ['escalation'],
    },
  ],
  working: {
    tokens: 4200,
    maxTokens: 8000,
    activeTurns: 3,
    summarizedTurns: 2,
    rollingSummary:
      'User is a premium customer inquiring about refund policy for a recent charge. ' +
      'They prefer formal communication and have been with the company for 2 years.',
  },
};

/**
 * Chronological log of recent memory operations shown in the Timeline sub-view.
 */
const mockTimeline: TimelineEntry[] = [
  {
    timestamp: Date.now() - 180_000,
    operation: 'WRITE',
    category: 'episodic',
    content: 'User asked about billing refund policy',
    metadata: { confidence: 0.85 },
  },
  {
    timestamp: Date.now() - 175_000,
    operation: 'RETRIEVE',
    category: 'semantic',
    content: 'Company refund policy is 30 days',
    metadata: { relevance: 0.92, source: 'rag' },
  },
  {
    timestamp: Date.now() - 120_000,
    operation: 'WRITE',
    category: 'episodic',
    content: 'User mentioned premium subscription',
    metadata: { confidence: 0.91 },
  },
  {
    timestamp: Date.now() - 60_000,
    operation: 'SUMMARIZE',
    category: 'working',
    content: 'Compressed turns 1-5 into rolling summary',
    metadata: { tokensSaved: 2400 },
  },
  {
    timestamp: Date.now() - 30_000,
    operation: 'CONSOLIDATE',
    category: 'semantic',
    content: 'Promoted billing pattern to semantic memory',
    metadata: { fromCategory: 'episodic' },
  },
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Registers all `/api/agentos/memory` routes on the provided Fastify instance.
 *
 * Routes:
 *  - `GET    /memory/stats`         — aggregate counts + working memory token usage.
 *  - `GET    /memory/timeline`      — chronological operation feed, filterable by `since` ms.
 *  - `GET    /memory/entries`       — full memory store; optionally filtered by `type`.
 *  - `GET    /memory/working`       — working memory snapshot only.
 *  - `DELETE /memory/entries/:id`   — remove a long-term memory entry by id.
 *
 * @param fastify The Fastify instance passed by `fastify.register`.
 */
export default async function memoryRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Aggregate memory statistics.
   * Returns entry counts for each long-term tier plus current working memory
   * token consumption — suitable for the Overview card summary row.
   */
  fastify.get('/memory/stats', {
    schema: {
      description: 'Aggregate memory statistics across all tiers',
      tags: ['Memory'],
      response: {
        200: {
          type: 'object',
          properties: {
            episodic:   { type: 'object', properties: { count: { type: 'number' }, newest: { type: 'number' } } },
            semantic:   { type: 'object', properties: { count: { type: 'number' } } },
            procedural: { type: 'object', properties: { count: { type: 'number' } } },
            working:    { type: 'object', properties: { tokens: { type: 'number' }, maxTokens: { type: 'number' } } },
          },
        },
      },
    },
  }, async () => ({
    episodic:   { count: mockMemoryEntries.episodic.length,   newest: mockMemoryEntries.episodic[0]?.timestamp },
    semantic:   { count: mockMemoryEntries.semantic.length },
    procedural: { count: mockMemoryEntries.procedural.length },
    working:    { tokens: mockMemoryEntries.working.tokens, maxTokens: mockMemoryEntries.working.maxTokens },
  }));

  /**
   * Memory operation timeline.
   *
   * @param req.query.since - Optional Unix ms lower bound; only entries after this timestamp are returned.
   * @returns Array of {@link TimelineEntry} objects in chronological order.
   */
  fastify.get<{ Querystring: { since?: string } }>('/memory/timeline', {
    schema: {
      description: 'Chronological log of memory operations, optionally filtered by `since` timestamp (ms)',
      tags: ['Memory'],
      querystring: {
        type: 'object',
        properties: { since: { type: 'string' } },
      },
    },
  }, async (req) => {
    const { since } = req.query;
    const sinceTs = since ? parseInt(since, 10) : 0;
    return mockTimeline.filter((e) => e.timestamp > sinceTs);
  });

  /**
   * Retrieve memory entries.
   *
   * @param req.query.type - Optional category filter: 'episodic' | 'semantic' | 'procedural' | 'working'.
   *                         Omit to return the full store.
   * @returns The requested category array, the working memory object, or the full store.
   */
  fastify.get<{ Querystring: { type?: string } }>('/memory/entries', {
    schema: {
      description: 'Retrieve memory entries, optionally filtered to a single category via `type`',
      tags: ['Memory'],
      querystring: {
        type: 'object',
        properties: { type: { type: 'string' } },
      },
    },
  }, async (req) => {
    const { type } = req.query;
    if (type === 'working') return mockMemoryEntries.working;
    if (type && type in mockMemoryEntries) return (mockMemoryEntries as Record<string, unknown>)[type];
    return mockMemoryEntries;
  });

  /**
   * Working memory snapshot.
   * Returns the current context-window usage and rolling summary without
   * requiring the caller to know the full store shape.
   */
  fastify.get('/memory/working', {
    schema: {
      description: 'Current working (context-window) memory snapshot',
      tags: ['Memory'],
    },
  }, async () => mockMemoryEntries.working);

  /**
   * Delete a long-term memory entry by id.
   *
   * Searches episodic, semantic, and procedural tiers in order.
   * Returns 404 if the id is not found in any tier.
   *
   * @param req.params.id - The entry id to remove.
   * @returns `{ ok: true }` on success.
   */
  fastify.delete<{ Params: { id: string } }>('/memory/entries/:id', {
    schema: {
      description: 'Delete a long-term memory entry by id',
      tags: ['Memory'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    for (const cat of ['episodic', 'semantic', 'procedural'] as const) {
      const idx = mockMemoryEntries[cat].findIndex((e) => e.id === id);
      if (idx >= 0) {
        mockMemoryEntries[cat].splice(idx, 1);
        return { ok: true };
      }
    }
    return reply.code(404).send({ error: 'Memory entry not found' });
  });
}
