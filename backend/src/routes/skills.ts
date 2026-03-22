import { FastifyInstance } from 'fastify';
import {
  getWorkbenchSkill,
  listWorkbenchSkills,
  type WorkbenchSkillInfo,
} from '../lib/registryCatalog';

const enabledSkills = new Set<string>();

function serializeSkill(skill: WorkbenchSkillInfo) {
  return {
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    version: skill.version,
    description: skill.description,
    category: skill.category,
    namespace: skill.namespace,
    verified: skill.verified,
    source: skill.source,
    verifiedAt: skill.verifiedAt,
    tags: skill.tags,
    emoji: skill.emoji,
    primaryEnv: skill.primaryEnv,
    requiredEnvVars: skill.requiredEnvVars,
    requiredSecrets: skill.requiredSecrets,
    requiresTools: skill.requiredTools,
    requiredBins: skill.requiredBins,
    installHints: skill.installHints,
    enabled: enabledSkills.has(skill.name),
  };
}

export default async function skillRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/skills', {
    schema: {
      description: 'List all available skills from the curated/workspace registries',
      tags: ['Skills'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              name: { type: 'string' },
              displayName: { type: 'string' },
              category: { type: 'string' },
              description: { type: 'string' },
              enabled: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, async () => {
    const skills = await listWorkbenchSkills();
    return skills.map(serializeSkill);
  });

  fastify.get('/skills/active', {
    schema: {
      description: 'List only enabled skills',
      tags: ['Skills'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              name: { type: 'string' },
              enabled: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, async () => {
    const skills = await listWorkbenchSkills();
    return skills.map(serializeSkill).filter((skill) => skill.enabled);
  });

  fastify.get<{ Params: { name: string } }>('/skills/:name', {
    schema: {
      description: 'Get skill metadata and rendered SKILL.md body',
      tags: ['Skills'],
      params: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
          properties: {
            name: { type: 'string' },
            displayName: { type: 'string' },
            content: { type: 'string' },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const skill = await getWorkbenchSkill(req.params.name);
    if (!skill) {
      return reply.code(404).send({ error: 'Skill not found' });
    }

    return {
      ...serializeSkill(skill),
      content: skill.content,
    };
  });

  fastify.post<{ Body: { name: string } }>('/skills/enable', {
    schema: {
      description: 'Enable a skill by name',
      tags: ['Skills'],
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  }, async (req) => {
    enabledSkills.add(req.body.name);
    return { ok: true };
  });

  fastify.post<{ Body: { name: string } }>('/skills/disable', {
    schema: {
      description: 'Disable a skill by name',
      tags: ['Skills'],
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  }, async (req) => {
    enabledSkills.delete(req.body.name);
    return { ok: true };
  });
}
