/**
 * @file discovery.ts
 * @description Capability discovery browser routes.
 *
 * Route:
 *   `GET /api/agency/capabilities?query=&kind=&category=&limit=`
 *
 *   Query params:
 *     - `query`    -- free-text keyword filter (optional).
 *     - `kind`     -- one of: tool | skill | extension | channel (optional).
 *     - `category` -- category string filter (optional).
 *     - `limit`    -- max results, default 50, max 200 (optional).
 *
 *   Response: `{ capabilities: CapabilityItem[], total: number }`
 *
 * Scoring algorithm ({@link keywordScore}):
 *   Exact name match = 100, starts-with = 80, name-contains = 60,
 *   description-contains = 30, tag-contains = 20, no match = 0.
 *   Results are sorted by score descending, then tier ascending.
 *
 * Tier assignment:
 *   - Tools default to tier 1.
 *   - Skills: tier 0 if verified, else tier 1.
 *   - Extensions: tier 0 if verified, else tier 2.
 *
 * This is a lightweight alternative to the full CapabilityDiscoveryEngine
 * in `packages/agentos` -- it works without the HNSW vector index so the
 * workbench backend has no extra dependencies.
 */

import { FastifyInstance } from 'fastify';
import {
  listWorkbenchSkills,
  listWorkbenchTools,
  listWorkbenchExtensions,
} from '../lib/registryCatalog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CapabilityKind = 'tool' | 'skill' | 'extension' | 'channel';

interface CapabilityItem {
  id: string;
  name: string;
  kind: CapabilityKind;
  category?: string;
  description: string;
  /** Tier: 0 = always visible, 1 = semantic match, 2 = full schema */
  tier: 0 | 1 | 2;
  schema?: string;
  usageExample?: string;
  dependencies?: string[];
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Naive keyword relevance scorer for capability search.
 *
 * Scoring tiers (higher = better match):
 *   - 100: exact name match
 *   -  80: name starts with query
 *   -  60: name contains query
 *   -  30: description contains query
 *   -  20: tags contain query
 *   -   0: no match (item excluded from results)
 *
 * @param item  - The capability to score.
 * @param query - Lowercase search query from the user.
 * @returns A relevance score (0 = no match).
 */
function keywordScore(item: CapabilityItem, query: string): number {
  if (!query) return 1;
  const lower = query.toLowerCase();
  const name = item.name.toLowerCase();
  const desc = item.description.toLowerCase();
  const tags = (item.tags ?? []).join(' ').toLowerCase();

  if (name === lower) return 100;
  if (name.startsWith(lower)) return 80;
  if (name.includes(lower)) return 60;
  if (desc.includes(lower)) return 30;
  if (tags.includes(lower)) return 20;
  return 0;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export default async function discoveryRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/agency/capabilities
   *
   * Query params:
   *   query    — free-text keyword filter (optional)
   *   kind     — one of: tool | skill | extension | channel (optional)
   *   category — category string filter (optional)
   *   limit    — max results (default 50)
   */
  fastify.get<{
    Querystring: {
      query?: string;
      kind?: string;
      category?: string;
      limit?: string;
    };
  }>('/capabilities', {
    schema: {
      description: 'Search and list discovered capabilities (tools, skills, extensions)',
      tags: ['Agency'],
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword search query' },
          kind: { type: 'string', description: 'Filter by kind: tool | skill | extension | channel' },
          category: { type: 'string', description: 'Filter by category string' },
          limit: { type: 'string', description: 'Maximum results (default 50)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            capabilities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  kind: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  tier: { type: 'number' },
                  tags: { type: 'array', items: { type: 'string' } },
                  dependencies: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            total: { type: 'number' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const query = (req.query.query ?? '').trim().toLowerCase();
    const kindFilter = (req.query.kind ?? '').trim().toLowerCase();
    const categoryFilter = (req.query.category ?? '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    // Fetch all sources in parallel
    const [tools, skills, extensions] = await Promise.all([
      listWorkbenchTools().catch(() => []),
      listWorkbenchSkills().catch(() => []),
      listWorkbenchExtensions().catch(() => []),
    ]);

    const capabilities: CapabilityItem[] = [];

    // --- Tools (tier 1 by default) ---
    for (const t of tools) {
      capabilities.push({
        id: `tool:${t.id}`,
        name: t.name,
        kind: 'tool',
        category: t.category,
        description: t.description,
        tier: 1,
        tags: [],
        dependencies: [],
      });
    }

    // --- Skills (tier 0 if verified, otherwise 1) ---
    for (const s of skills) {
      capabilities.push({
        id: `skill:${s.id}`,
        name: s.displayName ?? s.name,
        kind: 'skill',
        category: s.category,
        description: s.description,
        tier: s.verified ? 0 : 1,
        tags: s.tags ?? [],
        dependencies: s.requiredTools ?? [],
      });
    }

    // --- Extensions (tier 0 if verified, 2 for community) ---
    for (const ext of extensions) {
      capabilities.push({
        id: `extension:${ext.id}`,
        name: ext.name,
        kind: 'extension',
        category: ext.category,
        description: ext.description,
        tier: ext.verified ? 0 : 2,
        tags: ext.keywords ?? [],
        dependencies: [],
      });
    }

    // Apply filters
    let filtered = capabilities.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (categoryFilter && (item.category ?? '').toLowerCase() !== categoryFilter) return false;
      return true;
    });

    // Apply search + sort by score
    if (query) {
      filtered = filtered
        .map((item) => ({ item, score: keywordScore(item, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.item.tier - b.item.tier)
        .slice(0, limit)
        .map(({ item }) => item);
    } else {
      // Default: sort by tier ascending then name
      filtered = filtered
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
        .slice(0, limit);
    }

    return reply.send({ capabilities: filtered, total: filtered.length });
  });
}
