/**
 * @file workflow.ts
 * @description Graph builder backend endpoints for compile and run.
 *
 * Routes:
 *   `POST /api/agency/workflow/compile`
 *     Body:     `{ nodes: GraphNodePayload[] }`
 *     Response: `{ ir: string, nodeCount: number, compiledAt: string }`
 *     Compiles the visual graph into an intermediate representation (IR).
 *
 *   `POST /api/agency/workflow/start`
 *     Body:     `{ nodes: GraphNodePayload[] }`
 *     Response: Streaming `text/plain` with per-node execution logs.
 *     Headers:  `X-AgentOS-Graph-Run-Id` -- run ID for runtime tracking.
 *               `X-AgentOS-Graph-Goal` -- derived goal string.
 *     Executes the workflow via BFS traversal from entry nodes (no incoming
 *     edges).  Disconnected / cyclic nodes are handled by a fallback pass.
 *     Each node execution is mirrored to the {@link graphRunStore} for
 *     persistence and inspection in the Runtime Runs tab.
 */

import { FastifyInstance } from 'fastify';
import { graphRunStore } from '../services/graphRunStore';

/** Minimal graph node shape sent from the UI. */
interface GraphNodePayload {
  id: string;
  type: string;
  label: string;
  config: Record<string, string>;
  connectsTo: string[];
}

type WorkflowTaskSnapshot = Record<string, {
  status?: string;
  assignedRoleId?: string;
  assignedExecutorId?: string;
  output?: unknown;
  error?: { message?: string };
  metadata?: Record<string, unknown>;
}>;

/**
 * Compiles a node list into an intermediate representation (IR).
 *
 * In production, this would invoke the AgentGraph / workflow runtime.
 * For now it produces a deterministic textual IR that mirrors the node DAG.
 *
 * The IR identifies entry points (nodes with no incoming edges) and lists
 * all node instructions with their type, label, config, and next pointers.
 *
 * @param nodes - Array of graph node payloads from the frontend.
 * @returns A multi-line text IR string.
 */
function compileToIr(nodes: GraphNodePayload[]): string {
  const lines: string[] = [
    '# AgentOS Workflow IR',
    `# compiled: ${new Date().toISOString()}`,
    `# nodes: ${nodes.length}`,
    '',
  ];

  // Find entry nodes (no incoming edges)
  const hasIncoming = new Set(nodes.flatMap((n) => n.connectsTo));
  const entryNodes = nodes.filter((n) => !hasIncoming.has(n.id));

  lines.push('entry_points:');
  for (const n of entryNodes) {
    lines.push(`  - ${n.id}  # ${n.label}`);
  }
  lines.push('');

  lines.push('node_instructions:');
  for (const node of nodes) {
    lines.push(`  ${node.id}:`);
    lines.push(`    type: ${node.type}`);
    lines.push(`    label: "${node.label}"`);
    for (const [k, v] of Object.entries(node.config)) {
      lines.push(`    ${k}: "${v}"`);
    }
    if (node.connectsTo.length > 0) {
      lines.push(`    next: [${node.connectsTo.join(', ')}]`);
    }
  }

  return lines.join('\n');
}

function generateExecutionId(): string {
  return `graph-builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveGoal(nodes: GraphNodePayload[]): string {
  if (nodes.length === 0) {
    return 'Empty graph run';
  }
  const labels = nodes
    .map((node) => node.label.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (labels.length === 0) {
    return `Graph Builder run (${nodes.length} nodes)`;
  }
  return `Graph Builder: ${labels.join(' -> ')}`;
}

function toWorkflowTaskSnapshot(nodes: GraphNodePayload[]): WorkflowTaskSnapshot {
  return Object.fromEntries(
    nodes.map((node, index) => [
      node.id,
      {
        status: 'pending',
        metadata: {
          displayName: node.label,
          nodeType: node.type,
          actionType: node.type === 'tool' ? 'tool_call' : 'gmi_action',
          toolId: node.config.toolName || undefined,
          confidence: 0.82,
          executionOrderHint: index + 1,
        },
      },
    ])
  );
}

function syncRunSnapshot(input: {
  runId: string;
  conversationId: string;
  goal: string;
  nodes: GraphNodePayload[];
  tasks: WorkflowTaskSnapshot;
  status: string;
}) {
  graphRunStore.syncWorkflowSnapshot({
    runId: input.runId,
    source: 'workflow',
    goal: input.goal,
    workflowId: 'graph-builder.local',
    conversationId: input.conversationId,
    workflow: {
      status: input.status,
      tasks: input.tasks,
    },
  });
}

function appendRunEvent(runId: string, type: string, summary: string, payload?: Record<string, unknown>) {
  graphRunStore.appendEvent(runId, { type, summary, payload });
}

export default async function workflowRoutes(fastify: FastifyInstance): Promise<void> {
  /** Compile a workflow graph to IR. */
  fastify.post<{ Body: { nodes: GraphNodePayload[] } }>('/workflow/compile', {
    schema: {
      description: 'Compile a visual workflow graph to IR',
      tags: ['Workflow'],
      body: {
        type: 'object',
        required: ['nodes'],
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ir: { type: 'string' },
            nodeCount: { type: 'number' },
            compiledAt: { type: 'string' },
          },
        },
      },
    },
  }, async (req) => {
    const { nodes } = req.body;
    const ir = compileToIr(nodes);
    return {
      ir,
      nodeCount: nodes.length,
      compiledAt: new Date().toISOString(),
    };
  });

  /**
   * Start a workflow execution.
   *
   * Returns a streaming response so the UI can display incremental output.
   * Each chunk is a plain-text line describing step execution.
   */
  fastify.post<{ Body: { nodes: GraphNodePayload[] } }>('/workflow/start', {
    schema: {
      description: 'Start a workflow execution (streaming)',
      tags: ['Workflow'],
      body: {
        type: 'object',
        required: ['nodes'],
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { nodes } = req.body;
    const executionId = generateExecutionId();
    const conversationId = `${executionId}-conversation`;
    const goal = deriveGoal(nodes);
    const taskSnapshots = toWorkflowTaskSnapshot(nodes);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const hasIncoming = new Set(nodes.flatMap((n) => n.connectsTo));
    const queue = nodes.filter((n) => !hasIncoming.has(n.id));
    const visited = new Set<string>();

    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('X-AgentOS-Graph-Run-Id', executionId);
    reply.raw.setHeader('X-AgentOS-Graph-Goal', goal);

    const write = (line: string) => {
      reply.raw.write(`${line}\n`);
    };

    graphRunStore.beginRun({
      runId: executionId,
      source: 'workflow',
      goal,
      workflowId: 'graph-builder.local',
      conversationId,
    });
    syncRunSnapshot({
      runId: executionId,
      conversationId,
      goal,
      nodes,
      tasks: taskSnapshots,
      status: 'running',
    });
    appendRunEvent(executionId, 'graph_received', `Received ${nodes.length} graph node(s)`, {
      nodeCount: nodes.length,
    });

    write(`[workflow] starting — ${nodes.length} node(s)`);
    write(`[graph-run] ${executionId}`);

    try {
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        taskSnapshots[node.id] = {
          ...taskSnapshots[node.id],
          status: 'running',
          metadata: {
            ...taskSnapshots[node.id]?.metadata,
            startedAt: new Date().toISOString(),
          },
        };
        syncRunSnapshot({
          runId: executionId,
          conversationId,
          goal,
          nodes,
          tasks: taskSnapshots,
          status: 'running',
        });
        appendRunEvent(executionId, 'node_started', `Started ${node.label}`, {
          nodeId: node.id,
          nodeType: node.type,
        });
        write(`[node:${node.type}] ${node.label} — executing`);

        // Simulate realistic per-node-type execution times
        const delayByType: Record<string, number> = {
          gmi: 1800,
          tool: 1200,
          human: 2200,
          voice: 1600,
          router: 600,
          guardrail: 900,
          subgraph: 2000,
        };
        const baseDelay = delayByType[node.type] ?? 1000;
        // Add ±20% jitter so nodes don't all take the same time
        const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
        await new Promise<void>((resolve) => setTimeout(resolve, Math.round(baseDelay + jitter)));

        taskSnapshots[node.id] = {
          ...taskSnapshots[node.id],
          status: 'completed',
          output: {
            summary: `${node.label} completed`,
            nodeType: node.type,
          },
          metadata: {
            ...taskSnapshots[node.id]?.metadata,
            completedAt: new Date().toISOString(),
          },
        };
        syncRunSnapshot({
          runId: executionId,
          conversationId,
          goal,
          nodes,
          tasks: taskSnapshots,
          status: 'running',
        });
        appendRunEvent(executionId, 'node_completed', `Completed ${node.label}`, {
          nodeId: node.id,
          nodeType: node.type,
        });
        write(`[node:${node.type}] ${node.label} — done`);

        for (const nextId of node.connectsTo) {
          const next = nodeMap.get(nextId);
          if (next) queue.push(next);
        }
      }

      // If the graph contains cycles or disconnected components with only incoming edges,
      // process any nodes that were not reached by the BFS entry traversal.
      for (const node of nodes) {
        if (visited.has(node.id)) {
          continue;
        }
        queue.push(node);
      }
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visited.has(node.id)) {
          continue;
        }
        visited.add(node.id);

        taskSnapshots[node.id] = {
          ...taskSnapshots[node.id],
          status: 'completed',
          output: {
            summary: `${node.label} completed via fallback traversal`,
            nodeType: node.type,
          },
          metadata: {
            ...taskSnapshots[node.id]?.metadata,
            traversalMode: 'fallback',
            completedAt: new Date().toISOString(),
          },
        };
        syncRunSnapshot({
          runId: executionId,
          conversationId,
          goal,
          nodes,
          tasks: taskSnapshots,
          status: 'running',
        });
        appendRunEvent(executionId, 'node_completed', `Completed ${node.label}`, {
          nodeId: node.id,
          nodeType: node.type,
          traversalMode: 'fallback',
        });
        write(`[node:${node.type}] ${node.label} — done`);
      }

      write(`[workflow] execution complete`);
      graphRunStore.completeRun(executionId);
      reply.raw.end();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Workflow execution failed');
      appendRunEvent(executionId, 'node_failed', err.message);
      graphRunStore.failRun(executionId, err.message);
      write(`[error] ${err.message}`);
      reply.raw.end();
    }
  });
}
