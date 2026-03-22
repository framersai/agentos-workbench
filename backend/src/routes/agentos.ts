import { FastifyInstance } from 'fastify';
import { getAgentOS } from '../lib/agentos';
import {
  mockExtensions,
  mockTools,
  mockModels,
  mockExecutions
} from '../mockData';

const TEXT_DELTA_CHUNK_TYPE = 'text_delta';
const ERROR_CHUNK_TYPE = 'error';

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
    return mockExtensions;
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
    return mockTools;
  });

  /**
   * Install extension.
   */
  fastify.post('/extensions/install', {
    schema: {
      description: 'Install a new extension',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          extensionId: { type: 'string' }
        },
        required: ['extensionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    }
  }, async () => {
    return { success: true };
  });

  /**
   * Execute tool.
   */
  fastify.post('/tools/execute', {
    schema: {
      description: 'Execute a specific tool',
      tags: ['AgentOS'],
      body: {
        type: 'object',
        properties: {
          toolId: { type: 'string' },
          params: { type: 'object', additionalProperties: true }
        },
        required: ['toolId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            result: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return { result: 'Tool execution result' };
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
  let guardrailConfig: {
    tier: string;
    packs: Array<{
      id: string;
      name: string;
      description: string;
      installed: boolean;
      enabled: boolean;
    }>;
  } = {
    tier: 'balanced',
    packs: [
      { id: 'pii-redaction',  name: 'PII Redaction',  description: 'Detect and redact personal info',                         installed: false, enabled: true  },
      { id: 'ml-classifiers', name: 'ML Classifiers', description: 'Toxicity, injection, jailbreak via ONNX BERT',             installed: false, enabled: false },
      { id: 'topicality',     name: 'Topicality',     description: 'Embedding-based topic enforcement + drift detection',      installed: false, enabled: false },
      { id: 'code-safety',    name: 'Code Safety',    description: 'OWASP Top 10 code scanning (25 regex rules)',              installed: false, enabled: true  },
      { id: 'grounding-guard',name: 'Grounding Guard',description: 'RAG-grounded hallucination detection via NLI',             installed: false, enabled: false },
    ],
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
                  description: { type: 'string' },
                  installed:   { type: 'boolean' },
                  enabled:     { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => guardrailConfig);

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
    const body = req.body as { tier?: string; packs?: Record<string, boolean> };

    if (body.tier) {
      guardrailConfig.tier = body.tier;
    }

    if (body.packs) {
      for (const pack of guardrailConfig.packs) {
        // Convert kebab-case id to camelCase to look up the incoming key.
        // e.g. "pii-redaction" → "piiRedaction"
        const camelKey = pack.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        if (camelKey in body.packs) {
          pack.enabled = body.packs[camelKey];
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
