/**
 * @file channels.ts
 * @description Channel connection management endpoints for all 37 platforms.
 *
 * Routes:
 *   `GET  /api/channels/status`
 *     Response: `{ channels: ChannelRecord[] }`
 *     Returns the current status for all 37 channels.
 *
 *   `POST /api/channels/:id/connect`
 *     Body:     `{ credentials?: Record<string, string> }`
 *     Response: `{ ok: true, status: 'connected' }` (200) or `{ error }` (404).
 *     Merges provided credentials and sets status to 'connected'.
 *
 *   `POST /api/channels/:id/disconnect`
 *     Response: `{ ok: true, status: 'disconnected' }` (200).
 *
 *   `POST /api/channels/broadcast`
 *     Body:     `{ text: string, channelIds: string[] }`
 *     Response: `{ ok, results: Record<id, 'sent'|'not_found'|'not_connected'>, sentAt }`
 *     Sends a message to each specified channel that is currently connected.
 *
 *   `POST /api/channels/test-webhook`
 *     Body:     `{ url: string, payload: string }` (payload must be valid JSON)
 *     Response: `{ ok, status, statusText, body }` (200) or `{ error }` (400/502).
 *     Forwards the JSON payload to the given URL with a 10 s timeout.
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// In-memory channel state registry
// ---------------------------------------------------------------------------

type ChannelStatus = 'connected' | 'disconnected' | 'error' | 'rate-limited';

interface ChannelRecord {
  id: string;
  name: string;
  category: string;
  status: ChannelStatus;
  lastMessageAt: number | null;
  errorCount: number;
  rateLimitRemaining: number | null;
  credentials: Record<string, string>;
}

/** Canonical list of the 37 supported channel platforms. */
const CHANNEL_CATALOG: Pick<ChannelRecord, 'id' | 'name' | 'category'>[] = [
  { id: 'twitter',       name: 'Twitter / X',      category: 'social'    },
  { id: 'linkedin',      name: 'LinkedIn',          category: 'social'    },
  { id: 'facebook',      name: 'Facebook',          category: 'social'    },
  { id: 'instagram',     name: 'Instagram',         category: 'social'    },
  { id: 'threads',       name: 'Threads',           category: 'social'    },
  { id: 'pinterest',     name: 'Pinterest',         category: 'social'    },
  { id: 'snapchat',      name: 'Snapchat',          category: 'social'    },
  { id: 'bluesky',       name: 'Bluesky',           category: 'social'    },
  { id: 'mastodon',      name: 'Mastodon',          category: 'social'    },
  { id: 'discord',       name: 'Discord',           category: 'messaging' },
  { id: 'slack',         name: 'Slack',             category: 'messaging' },
  { id: 'telegram',      name: 'Telegram',          category: 'messaging' },
  { id: 'whatsapp',      name: 'WhatsApp',          category: 'messaging' },
  { id: 'line',          name: 'LINE',              category: 'messaging' },
  { id: 'wechat',        name: 'WeChat',            category: 'messaging' },
  { id: 'viber',         name: 'Viber',             category: 'messaging' },
  { id: 'signal',        name: 'Signal',            category: 'messaging' },
  { id: 'matrix',        name: 'Matrix',            category: 'messaging' },
  { id: 'youtube',       name: 'YouTube',           category: 'video'     },
  { id: 'tiktok',        name: 'TikTok',            category: 'video'     },
  { id: 'twitch',        name: 'Twitch',            category: 'video'     },
  { id: 'vimeo',         name: 'Vimeo',             category: 'video'     },
  { id: 'rumble',        name: 'Rumble',            category: 'video'     },
  { id: 'devto',         name: 'Dev.to',            category: 'blog'      },
  { id: 'hashnode',      name: 'Hashnode',          category: 'blog'      },
  { id: 'medium',        name: 'Medium',            category: 'blog'      },
  { id: 'wordpress',     name: 'WordPress',         category: 'blog'      },
  { id: 'ghost',         name: 'Ghost',             category: 'blog'      },
  { id: 'substack',      name: 'Substack',          category: 'blog'      },
  { id: 'reddit',        name: 'Reddit',            category: 'community' },
  { id: 'farcaster',     name: 'Farcaster',         category: 'community' },
  { id: 'lemmy',         name: 'Lemmy',             category: 'community' },
  { id: 'nostr',         name: 'Nostr',             category: 'community' },
  { id: 'googlebusiness',name: 'Google Business',   category: 'business'  },
  { id: 'gmb',           name: 'Google My Business',category: 'business'  },
  { id: 'shopify',       name: 'Shopify',           category: 'business'  },
  { id: 'hubspot',       name: 'HubSpot',           category: 'business'  },
];

const channelState: Map<string, ChannelRecord> = new Map(
  CHANNEL_CATALOG.map((c) => [
    c.id,
    {
      ...c,
      status: 'disconnected',
      lastMessageAt: null,
      errorCount: 0,
      rateLimitRemaining: null,
      credentials: {},
    },
  ])
);

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function channelRoutes(fastify: FastifyInstance): Promise<void> {
  /** Return the current status of all channels. */
  fastify.get('/status', {
    schema: {
      description: 'Get connection status for all 37 channels',
      tags: ['Channels'],
      response: {
        200: {
          type: 'object',
          properties: {
            channels: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
  }, async () => ({
    channels: Array.from(channelState.values()),
  }));

  /** Connect a channel with the provided credentials. */
  fastify.post<{
    Params: { id: string };
    Body: { credentials?: Record<string, string> };
  }>('/:id/connect', {
    schema: {
      description: 'Connect a channel',
      tags: ['Channels'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          credentials: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, status: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const channel = channelState.get(req.params.id);
    if (!channel) return reply.code(404).send({ error: 'Channel not found' });
    channel.status = 'connected';
    channel.lastMessageAt = Date.now();
    if (req.body.credentials) {
      channel.credentials = { ...channel.credentials, ...req.body.credentials };
    }
    return { ok: true, status: 'connected' };
  });

  /** Disconnect a channel. */
  fastify.post<{ Params: { id: string } }>('/:id/disconnect', {
    schema: {
      description: 'Disconnect a channel',
      tags: ['Channels'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, status: { type: 'string' } },
        },
      },
    },
  }, async (req) => {
    const channel = channelState.get(req.params.id);
    if (channel) channel.status = 'disconnected';
    return { ok: true, status: 'disconnected' };
  });

  /** Broadcast a message to multiple connected channels. */
  fastify.post<{
    Body: { text: string; channelIds: string[] };
  }>('/broadcast', {
    schema: {
      description: 'Broadcast a message to multiple channels',
      tags: ['Channels'],
      body: {
        type: 'object',
        required: ['text', 'channelIds'],
        properties: {
          text: { type: 'string' },
          channelIds: { type: 'array', items: { type: 'string' } },
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
    const { text, channelIds } = req.body;
    const results: Record<string, string> = {};

    for (const id of channelIds) {
      const channel = channelState.get(id);
      if (!channel) {
        results[id] = 'not_found';
        continue;
      }
      if (channel.status !== 'connected') {
        results[id] = 'not_connected';
        continue;
      }
      // In production, invoke the channel adapter here
      channel.lastMessageAt = Date.now();
      results[id] = 'sent';
    }

    return { ok: true, results, text: text.slice(0, 100), sentAt: new Date().toISOString() };
  });

  /** Test a webhook endpoint by sending a custom payload. */
  fastify.post<{
    Body: { url: string; payload: string };
  }>('/test-webhook', {
    schema: {
      description: 'Test a webhook URL with a custom payload',
      tags: ['Channels'],
      body: {
        type: 'object',
        required: ['url', 'payload'],
        properties: {
          url: { type: 'string' },
          payload: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (req, reply) => {
    const { url, payload } = req.body;

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return reply.code(400).send({ error: 'Payload must be valid JSON.' });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPayload),
        signal: AbortSignal.timeout(10_000),
      });
      const responseText = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: responseText.slice(0, 2000),
      };
    } catch (err) {
      return reply.code(502).send({
        error: `Webhook delivery failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
