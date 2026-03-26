/**
 * workflow routes — graph builder backend endpoints.
 *
 * POST /api/agency/workflow/compile  — compile a node list to IR.
 * POST /api/agency/workflow/start    — start streaming workflow execution.
 */

import { FastifyInstance } from 'fastify';

/** Minimal graph node shape sent from the UI. */
interface GraphNodePayload {
  id: string;
  type: string;
  label: string;
  config: Record<string, string>;
  connectsTo: string[];
}

/**
 * Compiles a node list into an intermediate representation (IR).
 *
 * In production, this would invoke the AgentGraph / workflow runtime.
 * For now it produces a deterministic textual IR that mirrors the node DAG.
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

    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');
    reply.raw.setHeader('Cache-Control', 'no-cache');

    const write = (line: string) => {
      reply.raw.write(`${line}\n`);
    };

    write(`[workflow] starting — ${nodes.length} node(s)`);

    // Walk nodes in topological order (BFS from entry nodes)
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const hasIncoming = new Set(nodes.flatMap((n) => n.connectsTo));
    const queue = nodes.filter((n) => !hasIncoming.has(n.id));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      write(`[node:${node.type}] ${node.label} — executing`);

      // Simulate async node execution
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      write(`[node:${node.type}] ${node.label} — done`);

      for (const nextId of node.connectsTo) {
        const next = nodeMap.get(nextId);
        if (next) queue.push(next);
      }
    }

    write(`[workflow] execution complete`);
    reply.raw.end();
  });
}
