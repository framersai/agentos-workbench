import fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import agentosRoutes from './routes/agentos';
import systemRoutes from './routes/system';
import evaluationRoutes from './routes/evaluation';
import planningRoutes from './routes/planning';
import marketplaceRoutes from './routes/marketplace';
import userRoutes from './routes/user';
import skillRoutes from './routes/skills';
import memoryRoutes from './routes/memory.js';
import voiceRoutes from './routes/voice';
import approvalsRoutes from './routes/approvals';
import discoveryRoutes from './routes/discovery';
import workflowRoutes from './routes/workflow';
import forgeRoutes from './routes/forge';
import channelRoutes from './routes/channels';
import socialRoutes from './routes/social';
import guardrailRoutes from './routes/guardrails';
import observabilityRoutes from './routes/observability';
import ragRoutes from './routes/rag';
import { initializeAgentOS } from './lib/agentos';
import { config } from 'dotenv';
config()

const server = fastify({
  logger: true
});

/**
 * Main application setup.
 */
async function main() {
  await initializeAgentOS();
  const configuredPort = Number(
    process.env.AGENTOS_WORKBENCH_BACKEND_PORT ?? process.env.PORT ?? 3001
  );
  const port = Number.isFinite(configuredPort) ? configuredPort : 3001;
  const host = process.env.AGENTOS_WORKBENCH_BACKEND_HOST?.trim() || '0.0.0.0';
  const swaggerHost = process.env.AGENTOS_WORKBENCH_PUBLIC_HOST?.trim() || `localhost:${port}`;

  // Register Swagger
  await server.register(swagger, {
    swagger: {
      info: {
        title: 'AgentOS Workbench API',
        description: 'API documentation for the AgentOS Workbench backend',
        version: '1.0.0'
      },
      host: swaggerHost,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json']
    }
  });

  await server.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  // Register CORS
  await server.register(cors, {
    origin: true, // Allow all origins for dev/workbench
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  // Register Rate Limit
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register Routes
  server.register(agentosRoutes, { prefix: '/api/agentos' });
  server.register(systemRoutes, { prefix: '/api/system' });
  server.register(evaluationRoutes, { prefix: '/api/evaluation' });
  server.register(planningRoutes, { prefix: '/api/planning' });
  server.register(marketplaceRoutes, { prefix: '/api/marketplace' });
  server.register(userRoutes, { prefix: '/api/user' });
  server.register(skillRoutes, { prefix: '/api/agentos' });
  server.register(memoryRoutes, { prefix: '/api/agentos' });
  server.register(voiceRoutes, { prefix: '/api/voice' });
  server.register(approvalsRoutes, { prefix: '/api/agency' });
  server.register(discoveryRoutes, { prefix: '/api/agency' });
  server.register(workflowRoutes, { prefix: '/api/agency' });
  server.register(forgeRoutes, { prefix: '/api/agency' });
  server.register(channelRoutes, { prefix: '/api/channels' });
  server.register(socialRoutes, { prefix: '/api/social' });
  server.register(guardrailRoutes, { prefix: '/api/guardrails' });
  server.register(observabilityRoutes, { prefix: '/api/observability' });
  server.register(ragRoutes, { prefix: '/api/rag' });

  // Health check
  server.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            port: { type: 'number' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'ok', port };
  });

  try {
    await server.listen({ port, host });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
