/**
 * @file playground.ts
 * @description Backend routes for the AgentPlayground and PromptWorkspace panels.
 *
 * Routes:
 *   POST /api/playground/run     — Run a single agent config + prompt, stream SSE response.
 *   POST /api/playground/compare — Run the same prompt against two configs, return both results.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAgentOS } from '../lib/agentos';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaygroundConfig {
  /** System instructions for the agent. */
  systemPrompt?: string;
  /** LLM model id, e.g. 'gpt-4o-mini'. */
  model?: string;
  /** Sampling temperature 0–2. */
  temperature?: number;
  /** Hard token limit for the response. */
  maxTokens?: number;
  /** Max tool-call steps before halting. */
  maxSteps?: number;
  /** Guardrail security tier. */
  guardrailTier?: 'dangerous' | 'permissive' | 'balanced' | 'strict' | 'paranoid';
  /** List of tool names to enable. */
  tools?: string[];
}

interface RunRequestBody {
  /** The user's prompt. */
  prompt: string;
  /** Agent configuration. */
  config?: PlaygroundConfig;
  /** Session identifier for tracing. */
  sessionId?: string;
}

interface CompareRequestBody {
  /** The user's prompt (same for both sides). */
  prompt: string;
  /** Left-side (A) configuration. */
  configA: PlaygroundConfig;
  /** Right-side (B) configuration. */
  configB: PlaygroundConfig;
}

interface CompareResult {
  text: string;
  toolCalls: ToolCallEntry[];
  usage: UsageInfo;
  latencyMs: number;
  runtimeMode: PlaygroundRuntimeMode;
  error?: string;
}

interface ToolCallEntry {
  name: string;
  args: unknown;
  result: unknown;
}

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

type PlaygroundRuntime = Record<string, unknown>;
export type PlaygroundRuntimeMode = 'live' | 'stub';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Estimate USD cost given token counts and a model id. */
function estimateCost(
  promptTokens: number,
  completionTokens: number,
  model?: string
): number {
  const INPUT_RATES: Record<string, number> = {
    'gpt-4o': 0.0025,
    'gpt-4o-mini': 0.00015,
    'gpt-4-turbo': 0.01,
    'claude-3-5-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    'claude-sonnet-4': 0.003,
  };
  const OUTPUT_RATES: Record<string, number> = {
    'gpt-4o': 0.01,
    'gpt-4o-mini': 0.0006,
    'gpt-4-turbo': 0.03,
    'claude-3-5-sonnet': 0.015,
    'claude-3-haiku': 0.00125,
    'claude-sonnet-4': 0.015,
  };
  const key = Object.keys(INPUT_RATES).find((k) => model?.includes(k)) ?? '';
  const inputRate = INPUT_RATES[key] ?? 0.0005;
  const outputRate = OUTPUT_RATES[key] ?? 0.0015;
  return (promptTokens / 1000) * inputRate + (completionTokens / 1000) * outputRate;
}

/** Build a stub response for when AgentOS is not available. */
function buildStubResponse(prompt: string, config: PlaygroundConfig) {
  const model = config.model ?? 'gpt-4o-mini';
  const sys = config.systemPrompt ?? '(no system prompt)';
  const promptTokens = Math.ceil((sys.length + prompt.length) / 4);
  const completionTokens = 64;
  return {
    text: `[Playground stub — connect AgentOS for live responses]\n\nModel: ${model}\nSystem: ${sys.slice(0, 80)}…\nPrompt: ${prompt}`,
    toolCalls: [] as ToolCallEntry[],
    runtimeMode: 'stub' as const,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: estimateCost(promptTokens, completionTokens, model),
    } satisfies UsageInfo,
  };
}

export async function resolvePlaygroundRuntime(
  getRuntime: () => Promise<unknown> = getAgentOS,
  loadModule: (specifier: string) => Promise<Record<string, unknown> | null> = async (specifier) => {
    const runtimeImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<Record<string, unknown>>;
    return runtimeImport(specifier).catch(() => null);
  },
): Promise<PlaygroundRuntime | null> {
  try {
    // First try the module exports directly (generateText/streamText are top-level functions)
    const moduleExports = await loadModule('@framers/agentos');
    if (moduleExports && typeof moduleExports.generateText === 'function') {
      return moduleExports as PlaygroundRuntime;
    }
    // Fall back to AgentOS instance (legacy path)
    const runtime = await getRuntime();
    return runtime && typeof runtime === 'object' ? (runtime as PlaygroundRuntime) : null;
  } catch {
    return null;
  }
}

export function getPlaygroundRuntimeMode(
  runtime: PlaygroundRuntime | null,
  methodName: 'streamText' | 'generateText'
): PlaygroundRuntimeMode {
  return runtime && typeof runtime[methodName] === 'function' ? 'live' : 'stub';
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function playgroundRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/playground/run
   *
   * Accepts a config + prompt and streams an SSE response with text chunks,
   * tool call events, and a final `done` event carrying usage stats.
   */
  fastify.post<{ Body: RunRequestBody }>(
    '/run',
    {
      schema: {
        description: 'Run an agent config against a prompt and stream the response via SSE',
        tags: ['Playground'],
        body: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
            config: { type: 'object', additionalProperties: true },
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RunRequestBody }>, reply: FastifyReply) => {
      const { prompt, config = {}, sessionId } = request.body;
      const startMs = Date.now();
      const agentos = await resolvePlaygroundRuntime();
      const runtimeMode = getPlaygroundRuntimeMode(agentos, 'streamText');

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.setHeader('X-AgentOS-Playground-Mode', runtimeMode);
      reply.raw.flushHeaders();

      function send(event: string, data: unknown) {
        reply.raw.write(`data: ${JSON.stringify({ type: event, ...( typeof data === 'object' && data ? data : { data }) })}\n\n`);
      }

      try {
        if (runtimeMode === 'live') {
          const liveRuntime = agentos as PlaygroundRuntime & {
            streamText: (opts: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>;
          };
          const streamFn = liveRuntime.streamText as (
            opts: Record<string, unknown>
          ) => AsyncIterable<Record<string, unknown>>;

          const systemPrompt = config.systemPrompt ?? 'You are a helpful AI assistant.';
          let promptTokens = 0;
          let completionTokens = 0;
          const toolCalls: ToolCallEntry[] = [];

          const stream = streamFn({
            model: config.model ?? 'gpt-4o-mini',
            system: systemPrompt,
            prompt,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            maxSteps: config.maxSteps,
          });

          for await (const chunk of stream) {
            const chunkType = chunk.type as string;
            if (chunkType === 'text_delta') {
              send('text_delta', { text: chunk.text });
            } else if (chunkType === 'tool_call') {
              const entry: ToolCallEntry = {
                name: String(chunk.toolName ?? ''),
                args: chunk.args,
                result: chunk.result,
              };
              toolCalls.push(entry);
              send('tool_call', entry);
            } else if (chunkType === 'finish') {
              promptTokens = Number(chunk.promptTokens ?? 0);
              completionTokens = Number(chunk.completionTokens ?? 0);
            }
          }

          const latencyMs = Date.now() - startMs;
          const usage: UsageInfo = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCostUsd: estimateCost(promptTokens, completionTokens, config.model),
          };
          send('done', { toolCalls, usage, latencyMs, sessionId, runtimeMode });
        } else {
          // AgentOS not available — emit stub chunks
          const stub = buildStubResponse(prompt, config);
          // Simulate streaming character by character in chunks
          const words = stub.text.split(' ');
          for (const word of words) {
            send('text_delta', { text: word + ' ' });
            await new Promise((r) => setTimeout(r, 5));
          }
          const latencyMs = Date.now() - startMs;
          send('done', {
            toolCalls: stub.toolCalls,
            usage: stub.usage,
            latencyMs,
            sessionId,
            runtimeMode: stub.runtimeMode,
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send('error', { message, runtimeMode });
      } finally {
        reply.raw.end();
      }
    }
  );

  /**
   * POST /api/playground/compare
   *
   * Runs the same prompt against two different configs and returns both
   * results in a single JSON response (no streaming).
   */
  fastify.post<{ Body: CompareRequestBody }>(
    '/compare',
    {
      schema: {
        description: 'Run the same prompt against two agent configs and return both results',
        tags: ['Playground'],
        body: {
          type: 'object',
          required: ['prompt', 'configA', 'configB'],
          properties: {
            prompt: { type: 'string' },
            configA: { type: 'object', additionalProperties: true },
            configB: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CompareRequestBody }>, reply: FastifyReply) => {
      const { prompt, configA, configB } = request.body;
      const agentos = await resolvePlaygroundRuntime();
      const runtimeMode = getPlaygroundRuntimeMode(agentos, 'generateText');
      reply.header('X-AgentOS-Playground-Mode', runtimeMode);

      async function runConfig(config: PlaygroundConfig): Promise<CompareResult> {
        const startMs = Date.now();
        try {
          if (runtimeMode === 'live') {
            const liveRuntime = agentos as PlaygroundRuntime & {
              generateText: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
            };
            const genFn = liveRuntime.generateText as (
              opts: Record<string, unknown>
            ) => Promise<Record<string, unknown>>;
            const result = await genFn({
              model: config.model ?? 'gpt-4o-mini',
              system: config.systemPrompt ?? 'You are a helpful AI assistant.',
              prompt,
              temperature: config.temperature,
              maxTokens: config.maxTokens,
            });
            const text = String(result.text ?? '');
            const usageObj = (result.usage ?? {}) as Record<string, unknown>;
            const promptTokens = Number(usageObj.promptTokens ?? 0);
            const completionTokens = Number(usageObj.completionTokens ?? 0);
            return {
              text,
              toolCalls: [],
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                estimatedCostUsd: estimateCost(promptTokens, completionTokens, config.model),
              },
              latencyMs: Date.now() - startMs,
              runtimeMode,
            };
          }
          // Stub path
          const stub = buildStubResponse(prompt, config);
          return { ...stub, latencyMs: Date.now() - startMs };
        } catch (err: unknown) {
          return {
            text: '',
            toolCalls: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
            latencyMs: Date.now() - startMs,
            runtimeMode,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      const [resultA, resultB] = await Promise.all([runConfig(configA), runConfig(configB)]);
      return reply.send({ resultA, resultB });
    }
  );
}
