/**
 * @file approvals.ts
 * @description Human-in-the-Loop (HITL) approval queue routes.
 *
 * Routes:
 *   `GET  /api/agency/approvals`            -- list all pending approval items.
 *     Response: `{ approvals: PendingApprovalItem[] }`
 *
 *   `POST /api/agency/approvals/:id/decide` -- submit an approve/reject decision.
 *     Body:     `{ decision: 'approved' | 'rejected', modification?: string }`
 *     Response: `{ ok: true, id: string, decision: string }` (200)
 *               `{ error: string }` (404 if not found)
 *
 *   `POST /api/agency/approvals`            -- enqueue a new approval (agent runtime).
 *     Body:     `{ agentId, action, description, severity?, context?, reversible? }`
 *     Response: `{ id: string }` (201)
 *
 * The store is in-process and ephemeral; seeded with demo items for
 * development.  In production this would be backed by a database or
 * message queue.  Decision history is capped at 100 entries.
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApprovalSeverity = 'low' | 'medium' | 'high' | 'critical';
type ApprovalDecision = 'approved' | 'rejected';

interface PendingApprovalItem {
  id: string;
  type: string;
  agentId: string;
  action: string;
  description: string;
  severity: ApprovalSeverity;
  context: Record<string, unknown>;
  reversible: boolean;
  requestedAt: string;
}

interface ApprovalDecisionRecord {
  id: string;
  decision: ApprovalDecision;
  modification?: string;
  decidedAt: string;
}

// ---------------------------------------------------------------------------
// In-process approval store
// ---------------------------------------------------------------------------

/** Seed items present on startup for development / demo purposes. */
const pendingApprovals: PendingApprovalItem[] = [
  {
    id: 'approval-demo-1',
    type: 'communication',
    agentId: 'marketing-agent',
    action: 'email.send_bulk',
    description: 'Send newsletter to 5,000 subscribers',
    severity: 'high',
    context: { recipientCount: 5000, template: 'monthly-newsletter' },
    reversible: false,
    requestedAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: 'approval-demo-2',
    type: 'data_modification',
    agentId: 'pricing-agent',
    action: 'catalog.update_prices',
    description: 'Update pricing for 50 products (+5 % avg)',
    severity: 'medium',
    context: { productCount: 50, avgChange: '+5%' },
    reversible: true,
    requestedAt: new Date(Date.now() - 180_000).toISOString(),
  },
];

const decisions: ApprovalDecisionRecord[] = [];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function approvalsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/agency/approvals
   *
   * Returns all currently pending approval items.
   */
  fastify.get('/approvals', {
    schema: {
      description: 'List pending HITL approval items',
      tags: ['Agency'],
      response: {
        200: {
          type: 'object',
          properties: {
            approvals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  agentId: { type: 'string' },
                  action: { type: 'string' },
                  description: { type: 'string' },
                  severity: { type: 'string' },
                  context: { type: 'object' },
                  reversible: { type: 'boolean' },
                  requestedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (_req, reply) => {
    return reply.send({ approvals: pendingApprovals });
  });

  /**
   * POST /api/agency/approvals/:id/decide
   *
   * Body: { decision: 'approved' | 'rejected', modification?: string }
   *
   * Removes the item from pending and records the decision.
   */
  fastify.post<{
    Params: { id: string };
    Body: { decision: ApprovalDecision; modification?: string };
  }>('/approvals/:id/decide', {
    schema: {
      description: 'Submit an approve or reject decision for a pending HITL item',
      tags: ['Agency'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['approved', 'rejected'] },
          modification: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            id: { type: 'string' },
            decision: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { decision, modification } = req.body;

    const idx = pendingApprovals.findIndex((item) => item.id === id);
    if (idx === -1) {
      return reply.status(404).send({ error: `Approval ${id} not found.` });
    }

    // Remove from pending
    pendingApprovals.splice(idx, 1);

    // Record decision (keep last 100)
    decisions.push({ id, decision, modification, decidedAt: new Date().toISOString() });
    if (decisions.length > 100) decisions.shift();

    return reply.send({ ok: true, id, decision });
  });

  /**
   * POST /api/agency/approvals
   *
   * Enqueue a new approval item (called by the agent runtime).
   */
  fastify.post<{
    Body: Omit<PendingApprovalItem, 'id' | 'requestedAt'>;
  }>('/approvals', {
    schema: {
      description: 'Enqueue a new pending HITL approval item (called by agent runtime)',
      tags: ['Agency'],
      body: {
        type: 'object',
        required: ['agentId', 'action', 'description'],
        properties: {
          type: { type: 'string' },
          agentId: { type: 'string' },
          action: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string' },
          context: { type: 'object' },
          reversible: { type: 'boolean' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body;
    const item: PendingApprovalItem = {
      id: `approval-${crypto.randomUUID().slice(0, 8)}`,
      type: body.type ?? 'unknown',
      agentId: body.agentId,
      action: body.action,
      description: body.description,
      severity: (body.severity as ApprovalSeverity) ?? 'medium',
      context: body.context ?? {},
      reversible: body.reversible ?? true,
      requestedAt: new Date().toISOString(),
    };
    pendingApprovals.push(item);
    return reply.status(201).send({ id: item.id });
  });
}
