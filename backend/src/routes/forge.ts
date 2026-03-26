/**
 * @file forge.ts
 * @description Emergent tool forge backend endpoints.
 *
 * Routes:
 *   `POST /api/agency/forge`
 *     Body:     `{ description: string, parametersSchema?: string }`
 *     Response: `{ requestId, status, verdict: JudgeVerdict, tool: ForgedTool | null }`
 *     Generates a stub implementation, judges it (correctness/safety/efficiency),
 *     and registers the tool in the Session tier if approved.
 *
 *   `GET /api/agency/forged-tools`
 *     Response: `{ tools: SerializedForgedTool[] }`
 *     Lists all in-memory forged tools with computed avgLatencyMs and successRate.
 *
 *   `POST /api/agency/forged-tools/:id/run`
 *     Body:     arbitrary JSON input
 *     Response: tool execution result (200) or error (404/500).
 *     Evaluates the tool's stub implementation via `new Function()`.
 *     Tracks callCount, successCount, and totalLatencyMs for usage stats.
 *
 * Judge scoring heuristic (dev stub):
 *   - correctness: 50 + (wordCount * 2), capped at 100.
 *   - safety: fixed 95 %.
 *   - efficiency: 60 + wordCount, capped at 100.
 *   - Approval threshold: correctness >= 60 AND safety >= 80.
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// In-memory tool registry (persists across requests within a server process)
// ---------------------------------------------------------------------------

interface ForgedTool {
  id: string;
  name: string;
  description: string;
  /** Generated implementation as a JS function body string. */
  implementation: string;
  tier: 'session' | 'agent' | 'shared';
  callCount: number;
  successCount: number;
  totalLatencyMs: number;
  createdAt: number;
}

interface JudgeVerdict {
  requestId: string;
  toolId: string;
  toolName: string;
  status: 'approved' | 'rejected';
  scores: {
    correctness: number;
    safety: number;
    efficiency: number;
  };
  reasoning: string;
  verdictAt: number;
}

const toolRegistry: ForgedTool[] = [];

function generateId(): string {
  return `forge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Stub implementation generator.
 *
 * In production this would call the LLM to synthesise a real implementation.
 * The stub always returns a descriptive echo that lets the UI exercise all flows.
 *
 * @param description - Natural-language description of the desired tool.
 * @param parametersSchema - Optional JSON Schema string for tool parameters.
 * @returns A JS function body string that can be evaluated via `new Function()`.
 */
function generateImplementation(description: string, parametersSchema: string): string {
  return `
// Generated stub for: ${description}
// Parameters schema: ${parametersSchema || '(none)'}
async function run(params) {
  return { ok: true, result: \`Tool executed with params: \${JSON.stringify(params)}\` };
}
`.trim();
}

/**
 * Evaluate the stub for safety and completeness, returning a synthetic score.
 *
 * A real judge would invoke an LLM or a static analysis pass.  This dev stub
 * uses description word count as a proxy for implementation quality.
 *
 * @param description - The tool description to score.
 * @returns A {@link JudgeVerdict} with synthetic scores (requestId left blank for caller).
 */
function judgeImplementation(description: string): JudgeVerdict & { toolId: string } {
  const toolId = generateId();
  // Score heuristic: description length proxy for quality
  const descWords = description.trim().split(/\s+/).length;
  const correctness = Math.min(100, 50 + descWords * 2);
  const safety = 95;
  const efficiency = Math.min(100, 60 + descWords);
  const approved = correctness >= 60 && safety >= 80;

  return {
    requestId: '',           // filled by caller
    toolId,
    toolName: description.slice(0, 40).trim(),
    status: approved ? 'approved' : 'rejected',
    scores: { correctness, safety, efficiency },
    reasoning: approved
      ? `Stub implementation passed correctness (${correctness}%), safety (${safety}%), and efficiency (${efficiency}%) thresholds.`
      : `Implementation scored below the 60% correctness threshold (got ${correctness}%). Refine the description and resubmit.`,
    verdictAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function forgeRoutes(fastify: FastifyInstance): Promise<void> {
  /** Submit a forge request and receive a verdict + forged tool. */
  fastify.post<{
    Body: { description: string; parametersSchema?: string };
  }>('/forge', {
    schema: {
      description: 'Submit a tool forge request',
      tags: ['Forge'],
      body: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string' },
          parametersSchema: { type: 'string' },
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
    const { description, parametersSchema = '' } = req.body;
    const requestId = generateId();

    const judgeResult = judgeImplementation(description);
    judgeResult.requestId = requestId;

    if (judgeResult.status === 'rejected') {
      return reply.code(200).send({
        requestId,
        status: 'rejected',
        verdict: judgeResult,
        tool: null,
      });
    }

    const impl = generateImplementation(description, parametersSchema);
    const tool: ForgedTool = {
      id: judgeResult.toolId,
      name: judgeResult.toolName,
      description,
      implementation: impl,
      tier: 'session',
      callCount: 0,
      successCount: 0,
      totalLatencyMs: 0,
      createdAt: Date.now(),
    };
    toolRegistry.push(tool);

    return reply.code(200).send({
      requestId,
      status: 'approved',
      verdict: judgeResult,
      tool: serializeTool(tool),
    });
  });

  /** List all forged tools. */
  fastify.get('/forged-tools', {
    schema: {
      description: 'List all forged tools',
      tags: ['Forge'],
      response: {
        200: {
          type: 'object',
          properties: {
            tools: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
  }, async () => ({
    tools: toolRegistry.map(serializeTool),
  }));

  /** Run a forged tool with arbitrary JSON input. */
  fastify.post<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>('/forged-tools/:id/run', {
    schema: {
      description: 'Run a forged tool with test input',
      tags: ['Forge'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: { type: 'object', additionalProperties: true },
    },
  }, async (req, reply) => {
    const tool = toolRegistry.find((t) => t.id === req.params.id);
    if (!tool) {
      return reply.code(404).send({ error: 'Tool not found' });
    }

    const startMs = Date.now();
    tool.callCount += 1;

    // Evaluate the stub implementation safely
    let result: unknown;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('params', `${tool.implementation}\nreturn run(params);`);
      result = await Promise.resolve(fn(req.body));
      tool.successCount += 1;
    } catch (err) {
      tool.totalLatencyMs += Date.now() - startMs;
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Tool execution failed',
      });
    }

    tool.totalLatencyMs += Date.now() - startMs;
    return reply.code(200).send(result);
  });
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise a {@link ForgedTool} for the API response, computing derived
 * fields (avgLatencyMs, successRate) from raw counters.
 */
function serializeTool(tool: ForgedTool) {
  const avgLatencyMs =
    tool.callCount > 0 ? Math.round(tool.totalLatencyMs / tool.callCount) : 0;
  const successRate =
    tool.callCount > 0 ? Math.round((tool.successCount / tool.callCount) * 100) : 100;
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    tier: tool.tier,
    callCount: tool.callCount,
    successRate,
    avgLatencyMs,
    createdAt: tool.createdAt,
  };
}
