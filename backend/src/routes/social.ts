/**
 * social routes — multi-platform social post publishing endpoints.
 *
 * POST /api/social/compose   — publish a post immediately.
 * POST /api/social/schedule  — schedule a post for future publication.
 * GET  /api/social/posts     — retrieve post history.
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// In-memory post store
// ---------------------------------------------------------------------------

type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
type SocialPlatform = string;

interface PostRecord {
  id: string;
  text: string;
  platforms: SocialPlatform[];
  status: PostStatus;
  scheduledAt: number | null;
  publishedAt: number | null;
  link: string | null;
  mediaUrls: string[];
  variants: Record<SocialPlatform, string>;
}

const postStore: PostRecord[] = [];

function generateId(): string {
  return `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function socialRoutes(fastify: FastifyInstance): Promise<void> {
  /** Publish a post immediately to one or more platforms. */
  fastify.post<{
    Body: {
      text: string;
      platforms: SocialPlatform[];
      variants?: Record<SocialPlatform, string>;
      mediaUrls?: string[];
    };
  }>('/compose', {
    schema: {
      description: 'Publish a social post immediately',
      tags: ['Social'],
      body: {
        type: 'object',
        required: ['text', 'platforms'],
        properties: {
          text: { type: 'string' },
          platforms: { type: 'array', items: { type: 'string' } },
          variants: { type: 'object', additionalProperties: { type: 'string' } },
          mediaUrls: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (req) => {
    const { text, platforms, variants = {}, mediaUrls = [] } = req.body;
    const postId = generateId();

    const post: PostRecord = {
      id: postId,
      text,
      platforms,
      status: 'published',
      scheduledAt: null,
      publishedAt: Date.now(),
      link: null,
      mediaUrls,
      variants,
    };
    postStore.unshift(post);

    return {
      ok: true,
      postId,
      status: 'published',
      publishedAt: post.publishedAt,
      platforms,
    };
  });

  /** Schedule a post for future publication. */
  fastify.post<{
    Body: {
      text: string;
      platforms: SocialPlatform[];
      scheduledAt: number;
      variants?: Record<SocialPlatform, string>;
      mediaUrls?: string[];
    };
  }>('/schedule', {
    schema: {
      description: 'Schedule a social post for future publication',
      tags: ['Social'],
      body: {
        type: 'object',
        required: ['text', 'platforms', 'scheduledAt'],
        properties: {
          text: { type: 'string' },
          platforms: { type: 'array', items: { type: 'string' } },
          scheduledAt: { type: 'number' },
          variants: { type: 'object', additionalProperties: { type: 'string' } },
          mediaUrls: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (req) => {
    const { text, platforms, scheduledAt, variants = {}, mediaUrls = [] } = req.body;
    const postId = generateId();

    const post: PostRecord = {
      id: postId,
      text,
      platforms,
      status: 'scheduled',
      scheduledAt,
      publishedAt: null,
      link: null,
      mediaUrls,
      variants,
    };
    postStore.unshift(post);

    return {
      ok: true,
      postId,
      status: 'scheduled',
      scheduledAt,
      platforms,
    };
  });

  /**
   * Retrieve post history.
   *
   * Supports optional `?status=` filter and `?limit=` pagination.
   */
  fastify.get<{
    Querystring: { status?: PostStatus; limit?: string };
  }>('/posts', {
    schema: {
      description: 'List post history',
      tags: ['Social'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
            total: { type: 'number' },
          },
        },
      },
    },
  }, async (req) => {
    const { status, limit } = req.query;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    let filtered = postStore;
    if (status) {
      filtered = postStore.filter((p) => p.status === status);
    }

    return {
      posts: filtered.slice(0, limitNum),
      total: filtered.length,
    };
  });
}
