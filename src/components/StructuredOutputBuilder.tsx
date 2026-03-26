/**
 * @file StructuredOutputBuilder.tsx
 * @description JSON schema definition UI for constraining structured agent output.
 *
 * When enabled, the agent is instructed to return JSON conforming to the user's
 * schema.  The builder supports five templates that pre-fill common patterns:
 *
 * | Template       | Purpose                                  |
 * |----------------|------------------------------------------|
 * | Q&A            | Answer + confidence + sources             |
 * | Classification | Label + score + alternatives              |
 * | Extraction     | Entity list with spans + summary          |
 * | Report         | Title + sections + recommendations        |
 * | Custom         | Blank schema for freeform use             |
 *
 * Each template provides both a JSON Schema object and a matching example
 * output.  The textarea runs live JSON syntax validation via
 * {@link validateJson} and shows a green/red indicator.
 *
 * The `description` field is appended to the agent system prompt as a
 * schema hint so the model understands the required output structure.
 *
 * Config flows upward via {@link StructuredOutputBuilderProps.onConfigChange}.
 */

import { useEffect, useState } from 'react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { CheckCircle2, XCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration emitted by {@link StructuredOutputBuilder}. */
export interface StructuredOutputConfig {
  /** Whether to enforce structured JSON output from the agent. */
  enabled: boolean;
  /** JSON Schema source (stringified). Validated on every keystroke. */
  schema: string;
  /** Human-readable description injected into the agent system prompt. */
  description: string;
  /** Which template was used as the starting point. */
  templateKey: TemplateKey;
}

export interface StructuredOutputBuilderProps {
  value?: StructuredOutputConfig;
  onConfigChange?: (config: StructuredOutputConfig) => void;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type TemplateKey = 'qa' | 'classification' | 'extraction' | 'report' | 'custom';

interface TemplateDescriptor {
  key: TemplateKey;
  label: string;
  description: string;
  schema: object;
  exampleOutput: object;
}

const TEMPLATES: TemplateDescriptor[] = [
  {
    key: 'qa',
    label: 'Q&A',
    description: 'Answer with supporting sources.',
    schema: {
      type: 'object',
      required: ['answer', 'sources'],
      properties: {
        answer: { type: 'string', description: 'Concise answer to the question.' },
        confidence: { type: 'number', description: 'Confidence score 0–1.' },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of source URLs or document names.',
        },
      },
    },
    exampleOutput: {
      answer: 'The capital of France is Paris.',
      confidence: 0.99,
      sources: ['https://en.wikipedia.org/wiki/Paris'],
    },
  },
  {
    key: 'classification',
    label: 'Classification',
    description: 'Label input with a category and score.',
    schema: {
      type: 'object',
      required: ['label', 'score'],
      properties: {
        label: { type: 'string', description: 'Predicted class label.' },
        score: { type: 'number', description: 'Probability for the top label, 0–1.' },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              score: { type: 'number' },
            },
          },
        },
      },
    },
    exampleOutput: {
      label: 'positive',
      score: 0.87,
      alternatives: [
        { label: 'neutral', score: 0.1 },
        { label: 'negative', score: 0.03 },
      ],
    },
  },
  {
    key: 'extraction',
    label: 'Extraction',
    description: 'Extract structured entities from text.',
    schema: {
      type: 'object',
      required: ['entities'],
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'value'],
            properties: {
              type: { type: 'string', description: 'Entity type (PERSON, ORG, DATE, …).' },
              value: { type: 'string', description: 'Raw entity text.' },
              span: {
                type: 'object',
                properties: {
                  start: { type: 'integer' },
                  end: { type: 'integer' },
                },
              },
            },
          },
        },
        summary: { type: 'string', description: 'Brief summary of extracted content.' },
      },
    },
    exampleOutput: {
      entities: [
        { type: 'PERSON', value: 'Ada Lovelace', span: { start: 0, end: 12 } },
        { type: 'DATE', value: '1843', span: { start: 40, end: 44 } },
      ],
      summary: 'Ada Lovelace wrote the first algorithm in 1843.',
    },
  },
  {
    key: 'report',
    label: 'Report',
    description: 'Multi-section structured report.',
    schema: {
      type: 'object',
      required: ['title', 'sections'],
      properties: {
        title: { type: 'string' },
        executive_summary: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            required: ['heading', 'content'],
            properties: {
              heading: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
    },
    exampleOutput: {
      title: 'Quarterly Analysis',
      executive_summary: 'Growth was strong in Q3.',
      sections: [{ heading: 'Revenue', content: 'Increased by 12 %.' }],
      recommendations: ['Expand to new markets'],
    },
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'Start from a blank schema.',
    schema: {
      type: 'object',
      required: [],
      properties: {},
    },
    exampleOutput: {},
  },
];

const DEFAULT_CONFIG: StructuredOutputConfig = {
  enabled: false,
  schema: JSON.stringify(TEMPLATES[0]!.schema, null, 2),
  description: '',
  templateKey: 'qa',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates a JSON string.
 * @param text - Raw JSON source to validate.
 * @returns `null` when the JSON is syntactically valid, or an error message string.
 */
function validateJson(text: string): string | null {
  if (!text.trim()) return 'Schema must not be empty.';
  try {
    JSON.parse(text);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON.';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StructuredOutputBuilder — build a JSON schema that constrains agent output.
 */
export function StructuredOutputBuilder({ value, onConfigChange }: StructuredOutputBuilderProps) {
  const [config, setConfig] = useState<StructuredOutputConfig>(value ?? DEFAULT_CONFIG);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Validate on every schema text change
  useEffect(() => {
    if (config.enabled) {
      setJsonError(validateJson(config.schema));
    } else {
      setJsonError(null);
    }
  }, [config.schema, config.enabled]);

  const update = (patch: Partial<StructuredOutputConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    onConfigChange?.(next);
  };

  const handleTemplateChange = (key: TemplateKey) => {
    const tpl = TEMPLATES.find((t) => t.key === key)!;
    update({ templateKey: key, schema: JSON.stringify(tpl.schema, null, 2) });
  };

  const selectedTemplate = TEMPLATES.find((t) => t.key === config.templateKey)!;

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Agency</p>
          <h3 className="text-sm font-semibold theme-text-primary">Structured Output</h3>
        </div>
        <HelpTooltip label="Explain structured output builder" side="bottom">
          When enabled the agent is instructed to return a JSON object that conforms to your schema.
          Pick a template to pre-fill a starting schema, then customise it.
        </HelpTooltip>
      </header>

      {/* Enable toggle */}
      <div className="mb-4">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border theme-border theme-bg-primary px-3 py-2 transition-colors hover:bg-white/5">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="shrink-0 accent-sky-500"
          />
          <div>
            <span className="text-xs font-semibold theme-text-primary">
              Require structured JSON output
            </span>
            <p className="mt-0.5 text-[10px] theme-text-secondary">
              The agent will be instructed to return output conforming to your JSON schema.
            </p>
          </div>
        </label>
      </div>

      {config.enabled && (
        <>
          {/* Template picker */}
          <div className="mb-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Template</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATES.map((tpl) => {
                const active = config.templateKey === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => handleTemplateChange(tpl.key)}
                    title={tpl.description}
                    className={[
                      'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      active
                        ? 'bg-sky-500 text-white border-transparent'
                        : 'theme-border theme-text-secondary hover:bg-white/5',
                    ].join(' ')}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
            {selectedTemplate.key !== 'custom' && (
              <p className="mt-1 text-[10px] theme-text-muted">{selectedTemplate.description}</p>
            )}
          </div>

          {/* Schema editor */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">JSON Schema</p>
              {jsonError ? (
                <span className="flex items-center gap-1 text-[10px] text-rose-400">
                  <XCircle size={10} aria-hidden="true" /> Invalid JSON
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 size={10} aria-hidden="true" /> Valid
                </span>
              )}
            </div>
            <textarea
              value={config.schema}
              onChange={(e) => update({ schema: e.target.value })}
              rows={12}
              spellCheck={false}
              title="Edit the JSON schema that constrains structured agent output."
              className={[
                'w-full rounded-md border px-2 py-1.5 font-mono text-[10px] theme-text-primary focus:outline-none',
                'theme-bg-primary',
                jsonError
                  ? 'border-rose-500/60 focus:border-rose-500'
                  : 'theme-border focus:border-sky-500',
              ].join(' ')}
            />
            {jsonError && (
              <p className="mt-0.5 text-[10px] text-rose-400">{jsonError}</p>
            )}
          </div>

          {/* Schema description */}
          <div className="mb-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
              Schema Description
            </p>
            <textarea
              value={config.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              placeholder="Describe the expected output so the agent understands the format…"
              title="This description is appended to the agent's system prompt to clarify the required output structure."
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Example preview */}
          {!jsonError && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
                Example Output
              </p>
              <pre className="overflow-auto rounded-lg border theme-border theme-bg-primary px-3 py-2 font-mono text-[10px] theme-text-secondary max-h-40">
                {JSON.stringify(selectedTemplate.exampleOutput, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </section>
  );
}
