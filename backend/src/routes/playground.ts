/**
 * @file playground.ts
 * @description Backend routes for the AgentPlayground and PromptWorkspace panels.
 *
 * Routes:
 *   POST /api/playground/run     — Run a single agent config + prompt, stream SSE response.
 *   POST /api/playground/compare — Run the same prompt against two configs, return both results.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { getAgentOS } from '../lib/agentos';
import { buildWorkbenchProcessRequestInput } from './agentos';

// ---------------------------------------------------------------------------
// Anthropic direct client (AgentOS doesn't have a native Anthropic provider)
// ---------------------------------------------------------------------------

function isClaudeModel(model?: string): boolean {
  return Boolean(model && model.startsWith('claude-'));
}

let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (_anthropicClient) return _anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _anthropicClient = new Anthropic({ apiKey });
  return _anthropicClient;
}

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
    'claude-haiku-4-5': 0.0008,
    'claude-sonnet-4': 0.003,
    'claude-opus-4': 0.015,
  };
  const OUTPUT_RATES: Record<string, number> = {
    'gpt-4o': 0.01,
    'gpt-4o-mini': 0.0006,
    'gpt-4-turbo': 0.03,
    'claude-3-5-sonnet': 0.015,
    'claude-haiku-4-5': 0.004,
    'claude-sonnet-4': 0.015,
    'claude-opus-4': 0.075,
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

/** Try to get a live AgentOS instance. Returns null if unavailable. */
async function resolveAgentOS(): Promise<{ processRequest: (input: unknown) => AsyncGenerator<Record<string, unknown>> } | null> {
  try {
    const instance = await getAgentOS();
    if (instance && typeof instance.processRequest === 'function') {
      return instance as unknown as { processRequest: (input: unknown) => AsyncGenerator<Record<string, unknown>> };
    }
    return null;
  } catch {
    return null;
  }
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
      const agentos = await resolveAgentOS();
      const runtimeMode: PlaygroundRuntimeMode = agentos ? 'live' : 'stub';

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
        if (isClaudeModel(config.model)) {
          // Route Claude models directly to Anthropic API (AgentOS lacks a native Anthropic provider)
          const anthropic = getAnthropicClient();
          if (!anthropic) {
            send('error', { message: 'ANTHROPIC_API_KEY is not configured. Add it to backend/.env to use Claude models.', runtimeMode: 'live' });
            reply.raw.end();
            return;
          }

          const stream = anthropic.messages.stream({
            model: config.model!,
            max_tokens: config.maxTokens ?? 1024,
            temperature: config.temperature,
            system: config.systemPrompt || undefined,
            messages: [{ role: 'user', content: prompt }],
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send('text_delta', { text: event.delta.text });
            }
          }

          const finalMessage = await stream.finalMessage();
          const promptTokens = finalMessage.usage.input_tokens;
          const completionTokens = finalMessage.usage.output_tokens;
          const latencyMs = Date.now() - startMs;
          const usage: UsageInfo = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCostUsd: estimateCost(promptTokens, completionTokens, config.model),
          };
          send('done', { toolCalls: [], usage, latencyMs, sessionId, runtimeMode: 'live' as PlaygroundRuntimeMode });
        } else if (agentos) {
          const toolCalls: ToolCallEntry[] = [];
          let promptTokens = 0;
          let completionTokens = 0;

          const iterator = agentos.processRequest(
            buildWorkbenchProcessRequestInput({
              userId: 'playground-user',
              sessionId: sessionId ?? `playground-${Date.now()}`,
              textInput: prompt,
              model: config.model,
            })
          );

          for await (const chunk of iterator) {
            const chunkType = String(chunk.type ?? '');
            if (chunkType === 'text_delta' && chunk.textDelta) {
              send('text_delta', { text: chunk.textDelta });
            } else if (chunkType === 'tool_call_request' && Array.isArray(chunk.toolCalls)) {
              for (const tc of chunk.toolCalls as Array<Record<string, unknown>>) {
                const entry: ToolCallEntry = {
                  name: String(tc.name ?? ''),
                  args: tc.arguments ?? tc.args,
                  result: tc.result,
                };
                toolCalls.push(entry);
                send('tool_call', entry);
              }
            } else if (chunkType === 'usage') {
              promptTokens = Number(chunk.promptTokens ?? 0);
              completionTokens = Number(chunk.completionTokens ?? 0);
            } else if (chunkType === 'error') {
              send('error', { message: String(chunk.message ?? chunk.error ?? 'Unknown error'), runtimeMode });
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
      const agentos = await resolveAgentOS();
      const runtimeMode: PlaygroundRuntimeMode = agentos ? 'live' : 'stub';
      reply.header('X-AgentOS-Playground-Mode', runtimeMode);

      async function runConfig(config: PlaygroundConfig): Promise<CompareResult> {
        const startMs = Date.now();
        try {
          if (isClaudeModel(config.model)) {
            const anthropic = getAnthropicClient();
            if (!anthropic) {
              throw new Error('ANTHROPIC_API_KEY is not configured.');
            }

            const response = await anthropic.messages.create({
              model: config.model!,
              max_tokens: config.maxTokens ?? 1024,
              temperature: config.temperature,
              system: config.systemPrompt || undefined,
              messages: [{ role: 'user', content: prompt }],
            });

            const fullText = response.content
              .filter((block): block is Anthropic.TextBlock => block.type === 'text')
              .map((block) => block.text)
              .join('');

            return {
              text: fullText,
              toolCalls: [],
              usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                estimatedCostUsd: estimateCost(response.usage.input_tokens, response.usage.output_tokens, config.model),
              },
              latencyMs: Date.now() - startMs,
              runtimeMode: 'live',
            };
          } else if (agentos) {
            let fullText = '';
            let promptTokens = 0;
            let completionTokens = 0;

            const iterator = agentos.processRequest(
              buildWorkbenchProcessRequestInput({
                userId: 'playground-user',
                sessionId: `compare-${Date.now()}`,
                textInput: prompt,
                model: config.model,
              })
            );

            for await (const chunk of iterator) {
              const chunkType = String(chunk.type ?? '');
              if (chunkType === 'text_delta' && chunk.textDelta) {
                fullText += String(chunk.textDelta);
              } else if (chunkType === 'usage') {
                promptTokens = Number(chunk.promptTokens ?? 0);
                completionTokens = Number(chunk.completionTokens ?? 0);
              } else if (chunkType === 'error') {
                throw new Error(String(chunk.message ?? chunk.error ?? 'Unknown error'));
              }
            }

            return {
              text: fullText,
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
