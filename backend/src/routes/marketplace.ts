import { FastifyInstance } from 'fastify';

/**
 * Registers Marketplace routes.
 * @param fastify The Fastify instance.
 */
export default async function marketplaceRoutes(fastify: FastifyInstance) {
  /**
   * Search marketplace.
   */
  fastify.get('/search', {
    schema: {
      description: 'Search marketplace for agents, personas, workflows, and extensions',
      tags: ['Marketplace'],
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: { type: 'string', enum: ['agent', 'persona', 'workflow', 'extension', 'template'] },
          category: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              version: { type: 'string' },
              publisher: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  verified: { type: 'boolean' }
                }
              },
              categories: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
              license: { type: 'string' },
              ratings: {
                type: 'object',
                properties: {
                  average: { type: 'number' },
                  count: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request) => {
    // TODO: Return real marketplace items when marketplace is implemented
    return [];
  });

  /**
   * Get installed items.
   */
  fastify.get('/installed', {
    schema: {
      description: 'List all installed marketplace items',
      tags: ['Marketplace'],
      response: {
        200: {
          type: 'array',
          items: { type: 'object' }
        }
      }
    }
  }, async () => {
    return [];
  });

  /**
   * Install item.
   */
  fastify.post('/install', {
    schema: {
      description: 'Install a marketplace item',
      tags: ['Marketplace'],
      body: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          version: { type: 'string' }
        },
        required: ['itemId']
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
   * Uninstall item.
   */
  fastify.delete('/uninstall/:installationId', {
    schema: {
      description: 'Uninstall a marketplace item',
      tags: ['Marketplace'],
      params: {
        type: 'object',
        properties: {
          installationId: { type: 'string' }
        },
        required: ['installationId']
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
