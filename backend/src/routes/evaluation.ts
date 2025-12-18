import { FastifyInstance } from 'fastify';

/**
 * Registers Evaluation routes.
 * @param fastify The Fastify instance.
 */
export default async function evaluationRoutes(fastify: FastifyInstance) {
  /**
   * Get evaluation runs.
   */
  fastify.get('/runs', {
    schema: {
      description: 'List all evaluation runs',
      tags: ['Evaluation'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
              startedAt: { type: 'string' },
              completedAt: { type: 'string' },
              totalTests: { type: 'number' },
              passedTests: { type: 'number' },
              failedTests: { type: 'number' },
              averageScore: { type: 'number' }
            }
          }
        }
      }
    }
  }, async () => {
    // TODO: Return real evaluation runs when evaluation system is implemented
    return [];
  });

  /**
   * Get specific run results.
   */
  fastify.get('/runs/:runId/results', {
    schema: {
      description: 'Get detailed results for a specific evaluation run',
      tags: ['Evaluation'],
      params: {
        type: 'object',
        properties: {
          runId: { type: 'string' }
        },
        required: ['runId']
      },
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
   * Get test cases.
   */
  fastify.get('/test-cases', {
    schema: {
      description: 'List all available test cases',
      tags: ['Evaluation'],
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
   * Start a run.
   */
  fastify.post('/run', {
    schema: {
      description: 'Start a new evaluation run',
      tags: ['Evaluation'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          testCaseIds: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            runId: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return { status: 'started', runId: 'run-new' };
  });
}
