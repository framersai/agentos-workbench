import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock skill data — replace with a real registry lookup once the skill store
// is wired up.  Each entry mirrors the SkillInfo shape consumed by the UI.
// ---------------------------------------------------------------------------

/**
 * A single skill entry exposed by the skills API.
 *
 * @property name        - Unique slug used as the primary key in enable/disable calls.
 * @property description - One-line human-readable summary.
 * @property category    - Broad grouping used for UI filtering.
 * @property tags        - Searchable keyword list.
 * @property emoji       - Visual identifier rendered in card/list views.
 * @property primaryEnv  - The most important environment variable the skill
 *                         needs, or `null` if no external credentials are required.
 * @property requiresTools - Tool names that must be present for the skill to run.
 * @property enabled     - Runtime toggle state (mutable via POST endpoints).
 */
interface MockSkill {
  name: string;
  description: string;
  category: string;
  tags: string[];
  emoji: string;
  primaryEnv: string | null;
  requiresTools: string[];
  enabled: boolean;
}

/**
 * In-memory skill catalogue.  State is process-scoped and resets on restart —
 * acceptable for a workbench prototype where persistence is added separately.
 */
const MOCK_SKILLS: MockSkill[] = [
  {
    name: 'web-search',
    description: 'Search the web for information using multiple providers',
    category: 'information',
    tags: ['search', 'web', 'research'],
    emoji: '🔍',
    primaryEnv: 'SERPER_API_KEY',
    requiresTools: ['web-search'],
    enabled: false,
  },
  {
    name: 'coding-agent',
    description: 'Write, debug, and refactor code across multiple languages',
    category: 'coding',
    tags: ['code', 'programming', 'debug'],
    emoji: '💻',
    primaryEnv: null,
    requiresTools: ['shell_execute', 'file_read', 'file_write'],
    enabled: false,
  },
  {
    name: 'voice-conversation',
    description: 'Handle voice calls with speech recognition and synthesis',
    category: 'voice',
    tags: ['voice', 'speech', 'telephony'],
    emoji: '🎙️',
    primaryEnv: 'ELEVENLABS_API_KEY',
    requiresTools: ['voice-synthesis'],
    enabled: false,
  },
  {
    name: 'social-broadcast',
    description: 'Post content across social media platforms',
    category: 'social',
    tags: ['social', 'post', 'broadcast'],
    emoji: '📢',
    primaryEnv: null,
    requiresTools: ['multi-channel-post'],
    enabled: false,
  },
  {
    name: 'pii-redaction',
    description: 'Detect and redact personally identifiable information',
    category: 'security',
    tags: ['pii', 'privacy', 'redaction', 'security'],
    emoji: '🛡️',
    primaryEnv: 'PII_LLM_API_KEY',
    requiresTools: ['pii_scan', 'pii_redact'],
    enabled: false,
  },
  {
    name: 'deep-research',
    description: 'Multi-step research with query classification and source aggregation',
    category: 'information',
    tags: ['research', 'analysis', 'deep-dive'],
    emoji: '🔬',
    primaryEnv: 'SERPER_API_KEY',
    requiresTools: ['web-search', 'web-browser'],
    enabled: false,
  },
  {
    name: 'image-generation',
    description: 'Generate images from text prompts',
    category: 'media',
    tags: ['image', 'generation', 'creative'],
    emoji: '🎨',
    primaryEnv: 'OPENAI_API_KEY',
    requiresTools: ['image-generation'],
    enabled: false,
  },
  {
    name: 'ml-content-classifier',
    description: 'Classify content for toxicity, injection, and jailbreak attempts',
    category: 'security',
    tags: ['ml', 'classifier', 'safety'],
    emoji: '🛡️',
    primaryEnv: null,
    requiresTools: ['classify_content'],
    enabled: false,
  },
  {
    name: 'code-safety',
    description: 'Scan code for OWASP Top 10 vulnerabilities',
    category: 'security',
    tags: ['code', 'security', 'owasp'],
    emoji: '🛡️',
    primaryEnv: null,
    requiresTools: ['scan_code'],
    enabled: false,
  },
  {
    name: 'grounding-guard',
    description: 'Verify response faithfulness against RAG sources',
    category: 'security',
    tags: ['grounding', 'hallucination', 'rag'],
    emoji: '🔍',
    primaryEnv: null,
    requiresTools: ['check_grounding'],
    enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Route schemas (Fastify JSON Schema for Swagger docs + response validation)
// ---------------------------------------------------------------------------

const skillSchema = {
  type: 'object',
  properties: {
    name:         { type: 'string' },
    description:  { type: 'string' },
    category:     { type: 'string' },
    tags:         { type: 'array', items: { type: 'string' } },
    emoji:        { type: 'string' },
    primaryEnv:   { type: ['string', 'null'] },
    requiresTools: { type: 'array', items: { type: 'string' } },
    enabled:      { type: 'boolean' },
  },
} as const;

const skillDetailSchema = {
  ...skillSchema,
  properties: {
    ...skillSchema.properties,
    content: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Registers all `/api/agentos/skills` routes on the provided Fastify instance.
 *
 * Routes:
 *  - `GET  /skills`         — returns the full catalogue.
 *  - `GET  /skills/active`  — returns only enabled skills.
 *  - `GET  /skills/:name`   — returns one skill with rendered SKILL.md content.
 *  - `POST /skills/enable`  — enables a skill by name.
 *  - `POST /skills/disable` — disables a skill by name.
 *
 * @param fastify The Fastify instance passed by `fastify.register`.
 */
export default async function skillRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * List all skills.
   * Returns the full catalogue regardless of enabled state.
   */
  fastify.get('/skills', {
    schema: {
      description: 'List all available skills',
      tags: ['Skills'],
      response: {
        200: { type: 'array', items: skillSchema },
      },
    },
  }, async () => MOCK_SKILLS);

  /**
   * List active (enabled) skills only.
   * Useful for the agent runtime to know which skills are in scope.
   */
  fastify.get('/skills/active', {
    schema: {
      description: 'List only currently enabled skills',
      tags: ['Skills'],
      response: {
        200: { type: 'array', items: skillSchema },
      },
    },
  }, async () => MOCK_SKILLS.filter((s) => s.enabled));

  /**
   * Get full detail for a single skill, including a rendered SKILL.md stub.
   *
   * @param req.params.name - The skill slug to look up.
   * @returns The skill with a `content` markdown string, or 404 if not found.
   */
  fastify.get<{ Params: { name: string } }>('/skills/:name', {
    schema: {
      description: 'Get detailed information for a single skill',
      tags: ['Skills'],
      params: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      response: {
        200: skillDetailSchema,
      },
    },
  }, async (req, reply) => {
    const { name } = req.params;
    const skill = MOCK_SKILLS.find((s) => s.name === name);
    if (!skill) {
      return reply.code(404).send({ error: 'Skill not found' });
    }

    // Build a synthetic SKILL.md so the UI can render rich detail without
    // requiring real SKILL.md files on disk in the workbench context.
    const content = [
      `# ${skill.emoji} ${skill.name}`,
      '',
      skill.description,
      '',
      '## When to Use',
      '',
      `Use this skill when you need to ${skill.description.toLowerCase()}.`,
      '',
      '## Required Tools',
      '',
      skill.requiresTools.map((t) => `- \`${t}\``).join('\n'),
      '',
      '## Tags',
      '',
      skill.tags.join(', '),
    ].join('\n');

    return { ...skill, content };
  });

  /**
   * Enable a skill by name.
   *
   * Body: `{ name: string }` — the slug of the skill to enable.
   * Returns `{ ok: true }` on success.  Silently succeeds if the skill does
   * not exist so that the UI can fire-and-forget without error handling.
   */
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
    const { name } = req.body;
    const skill = MOCK_SKILLS.find((s) => s.name === name);
    if (skill) skill.enabled = true;
    return { ok: true };
  });

  /**
   * Disable a skill by name.
   *
   * Body: `{ name: string }` — the slug of the skill to disable.
   * Returns `{ ok: true }` on success.
   */
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
    const { name } = req.body;
    const skill = MOCK_SKILLS.find((s) => s.name === name);
    if (skill) skill.enabled = false;
    return { ok: true };
  });
}
