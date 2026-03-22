import { FastifyInstance } from 'fastify';
import { getAgentOS } from '../lib/agentos';
import {
  mockModels,
  mockExecutions
} from '../mockData';
import {
  listGuardrailExtensions,
  listWorkbenchExtensions,
  listWorkbenchTools,
} from '../lib/registryCatalog';

const TEXT_DELTA_CHUNK_TYPE = 'text_delta';
const ERROR_CHUNK_TYPE = 'error';
const GUARDRAIL_PACK_ORDER = [
  'pii-redaction',
  'ml-classifiers',
  'topicality',
  'code-safety',
  'grounding-guard',
] as const;

type GuardrailPackId = typeof GUARDRAIL_PACK_ORDER[number];
type GuardrailTier = 'dangerous' | 'permissive' | 'balanced' | 'strict' | 'paranoid';

const TIER_GUARDRAIL_DEFAULTS: Record<GuardrailTier, Record<GuardrailPackId, boolean>> = {
  dangerous: {
    'pii-redaction': false,
    'ml-classifiers': false,
    topicality: false,
    'code-safety': false,
    'grounding-guard': false,
  },
  permissive: {
    'pii-redaction': false,
    'ml-classifiers': false,
    topicality: false,
    'code-safety': true,
    'grounding-guard': false,
  },
  balanced: {
    'pii-redaction': true,
    'ml-classifiers': false,
    topicality: false,
    'code-safety': true,
    'grounding-guard': false,
  },
  strict: {
    'pii-redaction': true,
    'ml-classifiers': true,
    topicality: false,
    'code-safety': true,
    'grounding-guard': false,
  },
  paranoid: {
    'pii-redaction': true,
    'ml-classifiers': true,
    topicality: true,
    'code-safety': true,
    'grounding-guard': true,
  },
};

/**
 * Registers AgentOS routes.
 * @param fastify The Fastify instance.
 */
export default async function agentosRoutes(fastify: FastifyInstance) {
  
  /**
   * Chat endpoint.
   * Accepts a POST request with a message and returns a simulated response.
   */
  fastify.post('/chat', {
    schema: {
      description: 'Send a single message to the agent and wait for the full response',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          personaId: { type: 'string' },
          input: { type: 'string' },
          conversationId: { type: 'string' }
        },
        required: ['input']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            role: { type: 'string' },
            content: { type: 'string' },
            created: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const agentos = await getAgentOS();
    const { userId, personaId, input, conversationId } = request.body as any;
    
    // We consume the generator to return a simple response
    // In a real non-streaming scenario, we might wait for the full response.
    // For now, we'll just gather the text.
    let fullText = '';
    const iterator = agentos.processRequest({
        userId: userId || 'anonymous',
        sessionId: conversationId || `session-${Date.now()}`,
        textInput: input,
        selectedPersonaId: personaId,
        conversationId: conversationId,
    });

    for await (const chunk of iterator) {
        if (chunk.type === TEXT_DELTA_CHUNK_TYPE && chunk.textDelta) {
            fullText += chunk.textDelta;
        }
        // Handle error chunks
        if (chunk.type === ERROR_CHUNK_TYPE) {
            throw chunk; 
        }
    }

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: fullText,
      created: Date.now()
    };
  });

  /**
   * Stream endpoint (SSE).
   * Streams a simulated response line by line.
   */
  
  fastify.get('/stream', {
    schema: {
      description: 'Stream agent response via Server-Sent Events',
      tags: ['AgentOS'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          mode: { type: 'string', description: 'Persona ID' },
          conversationId: { type: 'string' },
          messages: { type: 'string', description: 'JSON string of message history' }
        }
      }
    }
  }, async (request, reply) => {
    const agentos = await getAgentOS();
    const { userId, mode, conversationId, messages } = request.query as any;
    
    // Manually set CORS headers because we are using reply.raw
    const origin = request.headers.origin || 'http://localhost:5175';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    let textInput = '';
    if (messages) {
        try {
            const parsedMessages = JSON.parse(messages);
            if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                const lastMsg = parsedMessages[parsedMessages.length - 1];
                textInput = lastMsg.content;
            }
        } catch (e) {
            console.error('Failed to parse messages param', e);
        }
    }

    try {
        const iterator = agentos.processRequest({
            userId: userId || 'anonymous',
            sessionId: conversationId || `session-${Date.now()}`,
            textInput: textInput,
            selectedPersonaId: mode,
            conversationId: conversationId,
        });

        for await (const chunk of iterator) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        reply.raw.write('event: done\ndata: {}\n\n');
    } catch (error: any) {
        console.error("Stream error:", error);
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Unknown error' })}\n\n`);
    } finally {
        reply.raw.end();
    }
  });

  /**
   * List personas.
   */
  fastify.get('/personas', {
    schema: {
      description: 'List available personas',
      tags: ['AgentOS'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            personas: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        }
      }
    }
  }, async (request) => {
    const agentos = await getAgentOS();
    const { userId } = request.query as any;
    const personas = await agentos.listAvailablePersonas(userId);
    return { personas };
  });

  fastify.get<{ Params: { conversationId: string }; Querystring: { userId?: string } }>('/conversations/:conversationId', {
    schema: {
      description: 'Get conversation history for a conversation id',
      tags: ['AgentOS'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
        },
        required: ['conversationId'],
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
          properties: {
            conversation: { type: ['object', 'null'], additionalProperties: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const agentos = await getAgentOS();
    const getConversationHistory = (agentos as unknown as {
      getConversationHistory?: (conversationId: string, userId: string) => Promise<unknown>;
    }).getConversationHistory;

    if (typeof getConversationHistory !== 'function') {
      return { conversation: null, unsupported: true };
    }

    const conversation = await getConversationHistory(
      request.params.conversationId,
      request.query.userId || 'agentos-workbench-user'
    );

    return { conversation };
  });

  /**
   * List workflow definitions.
   */
  fastify.get('/workflows/definitions', {
    schema: {
      description: 'List available workflow definitions',
      tags: ['AgentOS'],
      response: {
        200: {
          type: 'object',
          properties: {
            definitions: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        }
      }
    }
  }, async () => {
    const agentos = await getAgentOS();
    const definitions = agentos.listWorkflowDefinitions();
    return { definitions };
  });

  /**
   * Execute agency.
   */
  fastify.post('/agency/execute', {
    schema: {
      description: 'Execute an agency with multiple agents',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          agencyConfig: { type: 'object', additionalProperties: true },
          goal: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            agencyId: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'started', agencyId: 'agency-123' };
  });

  /**
   * Stream agency execution (SSE).
   */
  fastify.get('/agency/stream', {
    schema: {
      description: 'Stream agency execution events via Server-Sent Events',
      tags: ['AgentOS'],
      querystring: {
        type: 'object',
        properties: {
          agencyId: { type: 'string' },
          userId: { type: 'string' },
          goal: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const origin = request.headers.origin || 'http://localhost:5175';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // Simulate agency streaming events
    reply.raw.write(`data: ${JSON.stringify({ type: 'AGENCY_UPDATE', status: 'started' })}\n\n`);

    setTimeout(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'AGENCY_UPDATE', status: 'completed' })}\n\n`);
      reply.raw.write('event: done\ndata: {}\n\n');
      reply.raw.end();
    }, 1000);
  });

  /**
   * Stream agency workflow execution (SSE).
   */
  fastify.get('/agency/workflow/stream', {
    schema: {
      description: 'Stream agency workflow execution events via Server-Sent Events',
      tags: ['AgentOS'],
      querystring: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const origin = request.headers.origin || 'http://localhost:5175';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // Simulate workflow streaming events
    reply.raw.write(`data: ${JSON.stringify({ type: 'WORKFLOW_UPDATE', status: 'started' })}\n\n`);

    setTimeout(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'WORKFLOW_UPDATE', status: 'completed' })}\n\n`);
      reply.raw.write('event: done\ndata: {}\n\n');
      reply.raw.end();
    }, 1000);
  });

  /**
   * List extensions.
   */
  fastify.get('/extensions', {
    schema: {
      description: 'List all available extensions',
      tags: ['AgentOS'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              package: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              verified: { type: 'boolean' },
              installed: { type: 'boolean' },
              tools: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, async () => {
    return listWorkbenchExtensions();
  });

  /**
   * List tools.
   */
  fastify.get('/extensions/tools', {
    schema: {
      description: 'List all available tools from extensions',
      tags: ['AgentOS'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              extension: { type: 'string' },
              hasSideEffects: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async () => {
    return listWorkbenchTools();
  });

  /**
   * In-memory set tracking which extensions have been "installed" in the
   * current workbench session.  In standalone mode there is no real npm
   * install — this set simulates the installed state so the UI can toggle
   * extensions on/off within a single session.
   */
  const sessionInstalledExtensions = new Set<string>();

  /**
   * Install extension.
   *
   * In connected mode this would delegate to the AgentOS extension loader
   * (`npm install @framers/agentos-ext-{name}` or dynamic import).  In
   * standalone mode the install is simulated — the extension id is tracked
   * in an in-memory set so subsequent list calls reflect the new state.
   *
   * The response includes a `mode` field ('standalone' | 'connected') so
   * the frontend can display appropriate messaging about the install scope.
   */
  fastify.post('/extensions/install', {
    schema: {
      description: 'Install an extension (simulated in standalone mode, real in connected mode)',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          extensionId: { type: 'string' },
          package: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            installed: { type: 'boolean' },
            mode: { type: 'string' },
            message: { type: 'string' },
          }
        }
      }
    }
  }, async (request) => {
    const body = request.body as { extensionId?: string; package?: string };
    const extensions = await listWorkbenchExtensions();
    const extension = extensions.find((entry) =>
      entry.id === body.extensionId ||
      entry.package === body.package
    );

    if (!extension) {
      return { success: false, installed: false, mode: 'standalone', message: 'Extension not found in registry.' };
    }

    // Attempt real runtime integration — check if the AgentOS instance has
    // an extension loader we can delegate to.
    try {
      const agentos = await getAgentOS();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extensionManager = (agentos as any).extensionManager;
      if (extensionManager && typeof extensionManager.loadExtension === 'function') {
        await extensionManager.loadExtension(extension.package);
        return {
          success: true,
          installed: true,
          mode: 'connected',
          message: `Extension ${extension.name} loaded via AgentOS runtime.`,
        };
      }
    } catch {
      // Runtime not available or extension manager not exposed — fall through
    }

    // Standalone fallback: track install in session memory
    sessionInstalledExtensions.add(extension.id);
    return {
      success: true,
      installed: extension.installed || sessionInstalledExtensions.has(extension.id),
      mode: 'standalone',
      message: `Extension ${extension.name} marked as installed (simulated — standalone mode).`,
    };
  });

  /**
   * Execute tool.
   *
   * Attempts to delegate to the real AgentOS ToolOrchestrator.processToolCall()
   * when the runtime is available and the tool is registered.  Falls back to a
   * stub response in standalone mode.
   *
   * The response includes a `mode` field ('standalone' | 'connected') so the
   * frontend can distinguish between real and simulated execution results.
   */
  fastify.post('/tools/execute', {
    schema: {
      description: 'Execute a specific tool via the AgentOS runtime or return a stub in standalone mode',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          toolId: { type: 'string' },
          params: { type: 'object', additionalProperties: true },
          input: { type: 'object', additionalProperties: true },
        },
        required: ['toolId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            result: {},
            toolId: { type: 'string' },
            mode: { type: 'string' },
            isError: { type: 'boolean' },
            echoedInput: { type: 'object', additionalProperties: true },
          }
        }
      }
    }
  }, async (request) => {
    const body = request.body as { toolId: string; params?: Record<string, unknown>; input?: Record<string, unknown> };
    const args = body.input ?? body.params ?? {};

    // Attempt real tool execution via the AgentOS ToolOrchestrator
    try {
      const agentos = await getAgentOS();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolOrchestrator = (agentos as any).toolOrchestrator;
      if (toolOrchestrator && typeof toolOrchestrator.processToolCall === 'function') {
        const result = await toolOrchestrator.processToolCall({
          toolCallRequest: {
            id: `workbench-${Date.now()}`,
            name: body.toolId,
            arguments: args,
          },
          gmiId: 'workbench',
          personaId: 'default',
          personaCapabilities: {},
          userContext: { userId: 'workbench-user' },
        });

        return {
          result: result.output ?? result.errorDetails?.message ?? null,
          toolId: body.toolId,
          mode: 'connected',
          isError: Boolean(result.isError),
          echoedInput: args,
        };
      }
    } catch {
      // Runtime not available or tool orchestrator not exposed — fall through
    }

    // Standalone fallback
    return {
      result: 'Tool execution is stubbed in standalone mode.  Connect an AgentOS runtime with registered tools to enable live execution.',
      toolId: body.toolId,
      mode: 'standalone',
      isError: false,
      echoedInput: args,
    };
  });

  /**
   * Start agency workflow.
   */
  fastify.post('/agency/workflow/start', {
    schema: {
      description: 'Start a new agency workflow',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          userId: { type: 'string' },
          config: { type: 'object', additionalProperties: true }
        },
        required: ['workflowId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'started' };
  });



  /**
   * List models.
   */
  fastify.get('/models', {
    schema: {
      description: 'List all available LLM models',
      tags: ['AgentOS'],
      response: {
        200: {
          type: 'object',
          properties: {
            models: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  provider: { type: 'string' },
                  pricing: {
                    type: 'object',
                    properties: {
                      inputCostPer1K: { type: 'number' },
                      outputCostPer1K: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async () => {
    return { models: mockModels };
  });

  // ---------------------------------------------------------------------------
  // Guardrail Pack endpoints
  // ---------------------------------------------------------------------------

  /**
   * In-memory guardrail configuration store.
   *
   * Holds the active security tier and the per-pack enable/disable state.
   * Persisted only for the lifetime of the process; a real implementation
   * would back this with a database row.
   */
  let guardrailTier: GuardrailTier = 'balanced';
  let guardrailPackState: Record<GuardrailPackId, boolean> = {
    ...TIER_GUARDRAIL_DEFAULTS.balanced,
  };

  /**
   * GET /guardrails — returns the current guardrail tier + pack configuration.
   */
  fastify.get('/guardrails', {
    schema: {
      description: 'Get the current guardrail tier and 5-pack configuration',
      tags: ['AgentOS'],
      response: {
        200: {
          type: 'object',
          properties: {
            tier:  { type: 'string' },
            packs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:          { type: 'string' },
                  name:        { type: 'string' },
                  package:     { type: 'string' },
                  description: { type: 'string' },
                  installed:   { type: 'boolean' },
                  enabled:     { type: 'boolean' },
                  verified:    { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const extensions = await listGuardrailExtensions();
    const packs = GUARDRAIL_PACK_ORDER.map((packId) => {
      const extension = extensions.find((entry) => entry.package.endsWith(packId));
      return {
        id: packId,
        package: extension?.package ?? `@framers/agentos-ext-${packId}`,
        name: extension?.name ?? packId,
        description: extension?.description ?? '',
        installed: extension?.installed ?? false,
        enabled: guardrailPackState[packId],
        verified: extension?.verified ?? false,
      };
    });

    return {
      tier: guardrailTier,
      packs,
    };
  });

  /**
   * POST /guardrails/configure — update the active tier and/or individual pack
   * enable states.
   *
   * Body fields are both optional:
   * - `tier`  — new security tier string
   * - `packs` — map of camelCase pack key → enabled boolean
   *             (e.g. `{ "piiRedaction": true, "codeSafety": false }`)
   *
   * Pack keys are matched by converting each pack's kebab-case id to camelCase
   * (e.g. `pii-redaction` → `piiRedaction`).
   */
  fastify.post('/guardrails/configure', {
    schema: {
      description: 'Update the guardrail tier and/or individual pack toggles',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          tier:  { type: 'string' },
          packs: { type: 'object', additionalProperties: { type: 'boolean' } },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  }, async (req) => {
    const body = req.body as { tier?: GuardrailTier; packs?: Record<string, boolean> };

    if (body.tier && body.tier in TIER_GUARDRAIL_DEFAULTS) {
      guardrailTier = body.tier;
      if (!body.packs) {
        guardrailPackState = { ...TIER_GUARDRAIL_DEFAULTS[body.tier] };
      }
    }

    if (body.packs) {
      for (const packId of GUARDRAIL_PACK_ORDER) {
        // Convert kebab-case id to camelCase to look up the incoming key.
        // e.g. "pii-redaction" → "piiRedaction"
        const camelKey = packId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        if (camelKey in body.packs) {
          guardrailPackState[packId] = body.packs[camelKey];
        }
      }
    }

    return { ok: true };
  });

  /**
   * List agency executions.
   */
  fastify.get('/agency/executions', {
    schema: {
      description: 'List all agency execution records',
      tags: ['AgentOS'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            executions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agencyId: { type: 'string' },
                  workflowId: { type: 'string' },
                  userId: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async () => {
    return { executions: mockExecutions };
  });

  /**
   * Get specific agency execution.
   */
  fastify.get('/agency/executions/:agencyId', {
    schema: {
      description: 'Get details of a specific agency execution',
      tags: ['AgentOS'],
      params: {
        type: 'object',
        properties: {
          agencyId: { type: 'string' }
        },
        required: ['agencyId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            execution: {
              type: 'object',
              properties: {
                agencyId: { type: 'string' },
                workflowId: { type: 'string' },
                userId: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' }
              }
            },
            seats: { type: 'array', items: { type: 'object' } }
          }
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request) => {
    const { agencyId } = request.params as { agencyId: string };
    const execution = mockExecutions.find(e => e.agencyId === agencyId);
    if (!execution) {
      throw { statusCode: 404, message: 'Execution not found' };
    }
    return { execution, seats: [] };
  });
}
