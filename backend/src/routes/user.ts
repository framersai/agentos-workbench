import { FastifyInstance } from 'fastify';

/**
 * Registers User routes.
 * @param fastify The Fastify instance.
 */
export default async function userRoutes(fastify: FastifyInstance) {
  /**
   * Get user settings.
   */
  fastify.get('/settings', {
    schema: {
      description: 'Get current user settings',
      tags: ['User'],
      response: {
        200: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark', 'system'], description: 'UI theme preference' },
            language: { type: 'string', description: 'Language code (e.g., en, es)' }
          }
        }
      }
    }
  }, async () => {
    return { theme: 'system', language: 'en' };
  });

  /**
   * Update user settings.
   */
  fastify.post('/settings', {
    schema: {
      description: 'Update user settings',
      tags: ['User'],
      body: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'system'] },
          language: { type: 'string' }
        }
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
}
