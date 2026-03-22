import { FastifyInstance } from 'fastify';
import { getAgentOS } from '../lib/agentos';

// ---------------------------------------------------------------------------
// Mock memory data — mirrors the four-tier AgentOS cognitive memory model.
// Used as fallback when the real AgentOS runtime is not connected or does not
// expose its internal memory subsystem via a public API.
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
// Runtime helpers — attempt to extract real memory data from AgentOS
// ---------------------------------------------------------------------------

/**
 * Attempts to reach into the AgentOS runtime's private `conversationManager`
 * and `activeConversations` Map to extract live session data.
 *
 * The AgentOS class currently keeps `conversationManager` private with no
 * public getter, so we resort to bracket-notation access.  This is acceptable
 * for a workbench/devtools integration — the alternative is pure mock data.
 *
 * @returns An object with `conversationManager` and `activeConversations`
 *          if both are reachable, or `null` if the runtime is unavailable.
 */
async function tryGetRuntimeMemory(): Promise<{
  conversationManager: any;
  activeConversations: Map<string, any>;
} | null> {
  try {
    const agentos = await getAgentOS();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cm = (agentos as any).conversationManager;
    if (!cm) return null;
    const active: Map<string, any> | undefined = (cm as any).activeConversations;
    if (!active || !(active instanceof Map)) return null;
    return { conversationManager: cm, activeConversations: active };
  } catch {
    return null;
  }
}

/**
 * Build real memory stats from the AgentOS ConversationManager's active
 * conversation contexts.
 *
 * Each ConversationContext exposes `.getHistory()` (all messages) and public
 * fields `sessionId` and `createdAt`.  We count user/assistant messages as
 * episodic entries and derive token estimates from message counts.
 *
 * @param activeConversations - The internal Map from ConversationManager.
 * @returns Stats object matching the shape the frontend expects, plus
 *          `connected: true` to indicate live data.
 */
function buildRealMemoryStats(activeConversations: Map<string, any>): Record<string, unknown> {
  let totalMessages = 0;
  let newestTimestamp = 0;
  let totalTokenEstimate = 0;

  for (const ctx of activeConversations.values()) {
    try {
      const history: ReadonlyArray<any> = typeof ctx.getHistory === 'function'
        ? ctx.getHistory()
        : [];
      totalMessages += history.length;

      for (const msg of history) {
        const ts = msg.timestamp ?? msg.createdAt ?? 0;
        if (ts > newestTimestamp) newestTimestamp = ts;
        // Rough token estimate: ~4 chars per token for English text
        const content = typeof msg.content === 'string' ? msg.content : '';
        totalTokenEstimate += Math.ceil(content.length / 4);
      }
    } catch {
      // Context may be in a bad state — skip
    }
  }

  const sessionCount = activeConversations.size;

  return {
    connected: true,
    episodic: {
      count: totalMessages,
      newest: newestTimestamp || undefined,
    },
    semantic: { count: 0 },
    procedural: { count: 0 },
    working: {
      tokens: totalTokenEstimate,
      maxTokens: 128_000,
      activeSessions: sessionCount,
    },
  };
}

/**
 * Build a real working memory snapshot from active conversation contexts.
 *
 * @param activeConversations - The internal Map from ConversationManager.
 * @returns Working memory object matching the `WorkingMemory` shape.
 */
function buildRealWorkingMemory(activeConversations: Map<string, any>): Record<string, unknown> {
  let totalTokenEstimate = 0;
  let activeTurns = 0;
  const summaries: string[] = [];

  for (const ctx of activeConversations.values()) {
    try {
      const history: ReadonlyArray<any> = typeof ctx.getHistory === 'function'
        ? ctx.getHistory()
        : [];
      activeTurns += history.length;
      for (const msg of history) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        totalTokenEstimate += Math.ceil(content.length / 4);
      }

      // Try to extract rolling summary from context state if available
      const state = (ctx as any).state ?? (ctx as any).sessionMetadata ?? {};
      const summary = state.rollingSummaryState?.summary ?? state.rollingSummary ?? '';
      if (summary) summaries.push(summary);
    } catch {
      // skip
    }
  }

  return {
    connected: true,
    tokens: totalTokenEstimate,
    maxTokens: 128_000,
    activeTurns,
    summarizedTurns: 0,
    rollingSummary: summaries.length > 0
      ? summaries.join(' | ')
      : `${activeConversations.size} active session(s), ${activeTurns} total turns in context.`,
  };
}

/**
 * Build a real timeline from active conversation messages.
 *
 * Derives WRITE operations from conversation messages since we don't have
 * a dedicated memory operation log from the runtime.
 *
 * @param activeConversations - The internal Map from ConversationManager.
 * @param sinceTs - Optional lower bound timestamp filter (Unix ms).
 * @returns Array of timeline entries derived from conversation history.
 */
function buildRealTimeline(
  activeConversations: Map<string, any>,
  sinceTs: number,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const ctx of activeConversations.values()) {
    try {
      const history: ReadonlyArray<any> = typeof ctx.getHistory === 'function'
        ? ctx.getHistory()
        : [];
      for (const msg of history) {
        const ts = msg.timestamp ?? msg.createdAt ?? Date.now();
        if (ts <= sinceTs) continue;
        entries.push({
          timestamp: ts,
          operation: 'WRITE',
          category: 'episodic',
          content: typeof msg.content === 'string'
            ? msg.content.slice(0, 120)
            : `[${msg.role ?? 'unknown'} message]`,
          metadata: {
            role: msg.role,
            sessionId: ctx.sessionId,
          },
        });
      }
    } catch {
      // skip
    }
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Build real memory entries from active conversation contexts.
 *
 * Maps conversation messages into the episodic tier structure.
 * Semantic and procedural tiers are empty since the AgentOS runtime does not
 * yet expose those stores via a public API.
 *
 * @param activeConversations - The internal Map from ConversationManager.
 * @returns A MemoryStore-shaped object with `connected: true`.
 */
function buildRealEntries(activeConversations: Map<string, any>): Record<string, unknown> {
  const episodic: MemoryEntry[] = [];
  let msgIdx = 0;

  for (const ctx of activeConversations.values()) {
    try {
      const history: ReadonlyArray<any> = typeof ctx.getHistory === 'function'
        ? ctx.getHistory()
        : [];
      for (const msg of history) {
        msgIdx++;
        episodic.push({
          id: `live-${ctx.sessionId ?? 'unknown'}-${msgIdx}`,
          content: typeof msg.content === 'string'
            ? msg.content.slice(0, 200)
            : `[${msg.role ?? 'unknown'} message]`,
          confidence: 1.0,
          timestamp: msg.timestamp ?? msg.createdAt ?? Date.now(),
          source: 'conversation',
          tags: [msg.role ?? 'unknown', ctx.sessionId ?? 'session'],
        });
      }
    } catch {
      // skip
    }
  }

  return {
    connected: true,
    episodic,
    semantic: [],
    procedural: [],
  };
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Registers all `/api/agentos/memory` routes on the provided Fastify instance.
 *
 * Each route first attempts to extract live data from the running AgentOS
 * ConversationManager.  If the runtime is unavailable or the internal memory
 * subsystem is not reachable, the route falls back to mock demonstration data.
 *
 * Every response includes a `connected` boolean so the frontend can display
 * a "Live Data" vs "Mock Data" badge.
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
   *
   * Attempts to read from the live AgentOS ConversationManager first;
   * falls back to mock data if the runtime is unavailable.
   */
  fastify.get('/memory/stats', {
    schema: {
      description: 'Aggregate memory statistics across all tiers',
      tags: ['Memory'],
      response: {
        200: {
          type: 'object',
          properties: {
            connected:  { type: 'boolean' },
            episodic:   { type: 'object', properties: { count: { type: 'number' }, newest: { type: 'number' } } },
            semantic:   { type: 'object', properties: { count: { type: 'number' } } },
            procedural: { type: 'object', properties: { count: { type: 'number' } } },
            working:    { type: 'object', properties: { tokens: { type: 'number' }, maxTokens: { type: 'number' } } },
          },
        },
      },
    },
  }, async () => {
    const runtime = await tryGetRuntimeMemory();
    if (runtime) {
      try {
        return buildRealMemoryStats(runtime.activeConversations);
      } catch {
        // Fall through to mock data
      }
    }
    return {
      connected: false,
      episodic:   { count: mockMemoryEntries.episodic.length,   newest: mockMemoryEntries.episodic[0]?.timestamp },
      semantic:   { count: mockMemoryEntries.semantic.length },
      procedural: { count: mockMemoryEntries.procedural.length },
      working:    { tokens: mockMemoryEntries.working.tokens, maxTokens: mockMemoryEntries.working.maxTokens },
    };
  });

  /**
   * Memory operation timeline.
   *
   * Attempts to derive timeline events from live conversation history first;
   * falls back to mock timeline data if the runtime is unavailable.
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

    const runtime = await tryGetRuntimeMemory();
    if (runtime) {
      try {
        const entries = buildRealTimeline(runtime.activeConversations, sinceTs);
        return { connected: true, timeline: entries };
      } catch {
        // Fall through to mock data
      }
    }
    return {
      connected: false,
      timeline: mockTimeline.filter((e) => e.timestamp > sinceTs),
    };
  });

  /**
   * Retrieve memory entries.
   *
   * Attempts to build entries from live conversation contexts first;
   * falls back to mock entries if the runtime is unavailable.
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

    const runtime = await tryGetRuntimeMemory();
    if (runtime) {
      try {
        if (type === 'working') {
          return buildRealWorkingMemory(runtime.activeConversations);
        }
        const entries = buildRealEntries(runtime.activeConversations) as Record<string, unknown>;
        if (type && type in entries) return entries[type];
        return entries;
      } catch {
        // Fall through to mock data
      }
    }

    if (type === 'working') return { connected: false, ...mockMemoryEntries.working };
    if (type && type in mockMemoryEntries) return (mockMemoryEntries as Record<string, unknown>)[type];
    return { connected: false, ...mockMemoryEntries };
  });

  /**
   * Working memory snapshot.
   *
   * Attempts to build working memory stats from the live ConversationManager;
   * falls back to mock data if the runtime is unavailable.
   */
  fastify.get('/memory/working', {
    schema: {
      description: 'Current working (context-window) memory snapshot',
      tags: ['Memory'],
    },
  }, async () => {
    const runtime = await tryGetRuntimeMemory();
    if (runtime) {
      try {
        return buildRealWorkingMemory(runtime.activeConversations);
      } catch {
        // Fall through to mock data
      }
    }
    return { connected: false, ...mockMemoryEntries.working };
  });

  /**
   * Delete a long-term memory entry by id.
   *
   * Currently only operates on the mock store.  When the AgentOS runtime
   * exposes a public memory deletion API, this route should delegate to it
   * for entries with a `live-` prefix.
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

    // Live entries (prefixed `live-`) are read-only projections from the
    // ConversationManager — deletion is not yet supported.
    if (id.startsWith('live-')) {
      return reply.code(400).send({
        error: 'Cannot delete live conversation entries.  Use the conversation API to manage sessions.',
      });
    }

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
