/**
 * Guardrail evaluation routes.
 *
 * Exposes:
 *   POST /api/guardrails/evaluate  — run text through one or more guardrail packs,
 *                                     returning per-pack verdicts.
 *
 * The evaluation logic here is intentionally lightweight (regex + keyword heuristics)
 * so that the endpoint is self-contained and works without any external ML service.
 * A production deployment would delegate to the actual guardrail pack implementations
 * via the AgentOS runtime.
 */

import { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PackId =
  | 'pii-redaction'
  | 'ml-classifiers'
  | 'topicality'
  | 'code-safety'
  | 'grounding-guard';

interface PackVerdict {
  packId: PackId;
  pass: boolean;
  confidence: number;
  detected: string;
  sanitizedText: string;
}

interface EvaluateBody {
  text: string;
  packs: PackId[];
  agentId?: string;
}

// ---------------------------------------------------------------------------
// Heuristic evaluators (offline fallback — no external ML service required)
// ---------------------------------------------------------------------------

const PII_PATTERNS = [
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,                                     // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,                    // email
  /\b(?:\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,                   // US phone
  /\b4[0-9]{12}(?:[0-9]{3})?\b|\b5[1-5][0-9]{14}\b|\b3[47][0-9]{13}\b/,  // credit card
];

const TOXIC_PATTERNS = [
  /\b(hate|kill|murder|attack|bomb|exploit|self-harm|suicide)\b/i,
  /\b(you\s+should\s+die|go\s+kill\s+yourself)\b/i,
];

const CODE_INJECTION_PATTERNS = [
  /eval\s*\(/,
  /exec\s*\(/,
  /__import__\s*\(/,
  /os\.system\s*\(/,
  /subprocess\.(call|run|Popen)/,
  /child_process\.(exec|spawn)/,
  /```\s*(bash|sh|zsh|python|ruby)\s/i,
];

const OOC_PATTERNS = [
  /\b(stock price|share price|crypto price|forex|nifty|nasdaq)\b/i,
  /\b(today'?s? weather|weather forecast|temperature today)\b/i,
  /\b(latest news|breaking news|live score)\b/i,
];

/**
 * Run a single pack's heuristic check against the input text.
 *
 * @param packId - The guardrail pack identifier to evaluate.
 * @param text   - Input text to analyse.
 * @returns A PackVerdict with pass/fail, confidence, detected label, and
 *          a sanitized version of the text (same as input when the pack passes).
 */
function evaluatePack(packId: PackId, text: string): PackVerdict {
  switch (packId) {
    case 'pii-redaction': {
      const match = PII_PATTERNS.find((re) => re.test(text));
      const pass = !match;
      let sanitized = text;
      if (!pass) {
        sanitized = text
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
          .replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, '[SSN]')
          .replace(/\b(?:\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
      }
      return {
        packId,
        pass,
        confidence: pass ? 0.97 : 0.91,
        detected: pass ? 'clean' : 'PII pattern matched',
        sanitizedText: sanitized,
      };
    }

    case 'ml-classifiers': {
      const match = TOXIC_PATTERNS.find((re) => re.test(text));
      return {
        packId,
        pass: !match,
        confidence: match ? 0.85 : 0.94,
        detected: match ? 'Toxic / harmful language pattern' : 'clean',
        sanitizedText: match ? '[CONTENT REDACTED — policy violation]' : text,
      };
    }

    case 'topicality': {
      const match = OOC_PATTERNS.find((re) => re.test(text));
      return {
        packId,
        pass: !match,
        confidence: match ? 0.76 : 0.90,
        detected: match ? 'Out-of-scope query (live data / external sources)' : 'clean',
        sanitizedText: match ? '[BLOCKED: query falls outside the configured topic scope]' : text,
      };
    }

    case 'code-safety': {
      const match = CODE_INJECTION_PATTERNS.find((re) => re.test(text));
      let sanitized = text;
      if (match) {
        sanitized = text.replace(match, '[SANITIZED_CODE_BLOCK]');
      }
      return {
        packId,
        pass: !match,
        confidence: match ? 0.96 : 0.99,
        detected: match ? 'Unsafe code execution pattern detected' : 'clean',
        sanitizedText: sanitized,
      };
    }

    case 'grounding-guard': {
      // Heuristic: look for overly confident assertions with no citation markers.
      const overconfident = /\b(definitely|certainly|always|never|100%|proven fact|undeniably)\b/i.test(text);
      return {
        packId,
        pass: !overconfident,
        confidence: overconfident ? 0.68 : 0.88,
        detected: overconfident ? 'Potential unverifiable assertion' : 'clean',
        sanitizedText: text,
      };
    }

    default:
      return {
        packId,
        pass: true,
        confidence: 1.0,
        detected: 'clean',
        sanitizedText: text,
      };
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Registers guardrail routes on the provided Fastify instance.
 * Intended to be mounted at `/api/guardrails` in the main server.
 *
 * @param fastify - Fastify server instance.
 */
export default async function guardrailRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/guardrails/evaluate
   *
   * Evaluate a text string against one or more guardrail packs.
   *
   * Request body:
   * ```json
   * {
   *   "text": "...",
   *   "packs": ["pii-redaction", "code-safety"],
   *   "agentId": "optional-agent-id-for-config-override"
   * }
   * ```
   *
   * Response:
   * ```json
   * {
   *   "verdicts": [ { "packId": "...", "pass": true, "confidence": 0.97, ... } ]
   * }
   * ```
   */
  fastify.post<{ Body: EvaluateBody }>('/evaluate', {
    schema: {
      description: 'Evaluate input text through selected guardrail packs',
      tags: ['Guardrails'],
      body: {
        type: 'object',
        required: ['text', 'packs'],
        properties: {
          text:    { type: 'string', maxLength: 100_000 },
          packs:   { type: 'array', items: { type: 'string' } },
          agentId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            verdicts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  packId:        { type: 'string' },
                  pass:          { type: 'boolean' },
                  confidence:    { type: 'number' },
                  detected:      { type: 'string' },
                  sanitizedText: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { text, packs } = request.body;

    if (!text || typeof text !== 'string') {
      return { verdicts: [] };
    }

    const validPacks: PackId[] = [
      'pii-redaction', 'ml-classifiers', 'topicality', 'code-safety', 'grounding-guard',
    ];

    const requestedPacks: PackId[] = Array.isArray(packs)
      ? packs.filter((p) => validPacks.includes(p as PackId)) as PackId[]
      : validPacks;

    const verdicts = requestedPacks.map((packId) => evaluatePack(packId, text));
    return { verdicts };
  });
}
