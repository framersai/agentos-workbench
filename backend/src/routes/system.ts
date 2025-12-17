import { FastifyInstance } from 'fastify';

/**
 * Registers System routes.
 * @param fastify The Fastify instance.
 */
export default async function systemRoutes(fastify: FastifyInstance) {
  /**
   * Get LLM status.
   */
  fastify.get('/llm-status', {
    schema: {
      description: 'Get the current LLM connection status',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Connection status (connected/disconnected)' },
            provider: { type: 'string', description: 'LLM provider name' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'connected', provider: 'MockProvider' };
  });
}
