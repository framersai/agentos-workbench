/**
 * GuardrailEvaluator — test-and-evaluate guardrail packs.
 *
 * Sub-tabs:
 *   Harness   — text input, pack selector, run button, before/after diff view.
 *   Results   — per-pack verdict cards with confidence scores.
 *   Log       — history of past evaluations.
 *   Allow-list — whitelisted entities that suppress future false positives.
 *
 * All state lives in {@link useGuardrailStore}.
 */

import { useState } from 'react';
import {
  Brain,
  Code,
  Search,
  Shield,
  Target,
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  useGuardrailStore,
  ALL_PACKS,
  type GuardrailPackId,
  type PackVerdict,
  type EvalLogEntry,
} from '@/state/guardrailStore';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

// ---------------------------------------------------------------------------
// Pack metadata
// ---------------------------------------------------------------------------

interface PackMeta {
  id: GuardrailPackId;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const PACK_META: PackMeta[] = [
  { id: 'pii-redaction',  label: 'PII Redaction',    description: 'Detect and redact personal data (emails, SSNs, phone numbers).',               Icon: Shield  },
  { id: 'ml-classifiers', label: 'ML Classifiers',   description: 'Classify toxicity, prompt injection attempts, and jailbreak patterns.',         Icon: Brain   },
  { id: 'topicality',     label: 'Topicality',        description: 'Block queries that fall outside the agent\'s configured domain scope.',         Icon: Target  },
  { id: 'code-safety',    label: 'Code Safety',       description: 'Detect unsafe code execution patterns (eval, exec, shell injections).',         Icon: Code    },
  { id: 'grounding-guard',label: 'Grounding Guard',   description: 'Flag hallucinated citations and unverifiable factual claims.',                  Icon: Search  },
];

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type EvalSubTab = 'harness' | 'results' | 'log' | 'allowlist';

const SUB_TABS: Array<{ key: EvalSubTab; label: string }> = [
  { key: 'harness',   label: 'Harness'    },
  { key: 'results',   label: 'Results'    },
  { key: 'log',       label: 'Log'        },
  { key: 'allowlist', label: 'Allow-list' },
];

// ---------------------------------------------------------------------------
// Pack selector checkbox
// ---------------------------------------------------------------------------

interface PackCheckboxProps {
  meta: PackMeta;
  checked: boolean;
  onChange: () => void;
}

function PackCheckbox({ meta, checked, onChange }: PackCheckboxProps) {
  const { Icon } = meta;
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
        checked ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary hover:bg-white/5',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 shrink-0 accent-sky-500"
      />
      <Icon size={12} className={checked ? 'text-sky-400 mt-0.5 shrink-0' : 'theme-text-muted mt-0.5 shrink-0'} aria-hidden="true" />
      <div>
        <span className={`text-xs font-semibold ${checked ? 'text-sky-400' : 'theme-text-primary'}`}>
          {meta.label}
        </span>
        <p className="mt-0.5 text-[10px] theme-text-secondary">{meta.description}</p>
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Verdict card
// ---------------------------------------------------------------------------

interface VerdictCardProps {
  verdict: PackVerdict;
  onAllow: (text: string, packId: GuardrailPackId) => void;
}

function VerdictCard({ verdict, onAllow }: VerdictCardProps) {
  const meta = PACK_META.find((p) => p.id === verdict.packId);
  const Icon = meta?.Icon ?? Shield;

  return (
    <div
      className={[
        'rounded-lg border px-3 py-2',
        verdict.pass
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-rose-500/30 bg-rose-500/10',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            size={12}
            className={verdict.pass ? 'text-emerald-400 shrink-0' : 'text-rose-400 shrink-0'}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold theme-text-primary">{meta?.label ?? verdict.packId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {verdict.pass ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-px text-[9px] font-medium uppercase text-emerald-300">
              <CheckCircle2 size={9} aria-hidden="true" /> pass
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-px text-[9px] font-medium uppercase text-rose-400">
              <XCircle size={9} aria-hidden="true" /> fail
            </span>
          )}
          <span className="text-[10px] font-mono theme-text-muted">
            {Math.round(verdict.confidence * 100)}%
          </span>
        </div>
      </div>

      <p className="mt-1 text-[10px] theme-text-secondary">
        Detected: <span className={verdict.pass ? 'text-emerald-400' : 'text-rose-400'}>{verdict.detected}</span>
      </p>

      {!verdict.pass && verdict.detected !== 'clean' && (
        <button
          type="button"
          onClick={() => onAllow(verdict.detected, verdict.packId)}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-secondary transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Add this entity to the allow-list to suppress future false-positive detections"
        >
          <PlusCircle size={9} aria-hidden="true" />
          Allow this entity
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Before / after diff view
// ---------------------------------------------------------------------------

interface BeforeAfterProps {
  original: string;
  sanitized: string;
}

function BeforeAfter({ original, sanitized }: BeforeAfterProps) {
  if (!original) return null;
  const changed = original !== sanitized;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Original</p>
        <pre className="whitespace-pre-wrap break-all rounded-lg border theme-border theme-bg-primary p-2.5 text-[10px] theme-text-primary max-h-32 overflow-y-auto">
          {original}
        </pre>
      </div>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
          Sanitized
          {changed && (
            <span className="ml-1.5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-1 text-amber-400">
              modified
            </span>
          )}
          {!changed && (
            <span className="ml-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 text-emerald-400">
              unchanged
            </span>
          )}
        </p>
        <pre className="whitespace-pre-wrap break-all rounded-lg border theme-border theme-bg-primary p-2.5 text-[10px] theme-text-primary max-h-32 overflow-y-auto">
          {sanitized || original}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log entry row
// ---------------------------------------------------------------------------

function LogRow({ entry }: { entry: EvalLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-lg border theme-border theme-bg-primary px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {entry.overallPass ? (
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle size={11} className="text-rose-400 shrink-0" aria-hidden="true" />
            )}
            <p className="truncate text-[10px] font-medium theme-text-primary">{entry.input}</p>
          </div>
          <p className="mt-0.5 text-[9px] theme-text-muted">
            {new Date(entry.timestamp).toLocaleString()} · packs: {entry.packs.join(', ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2 py-0.5 text-[9px] theme-text-secondary hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 border-t theme-border pt-2">
          {entry.verdicts.map((v) => (
            <li key={v.packId} className="flex items-center gap-2 text-[9px] theme-text-secondary">
              {v.pass
                ? <CheckCircle2 size={9} className="text-emerald-400" aria-hidden="true" />
                : <XCircle     size={9} className="text-rose-400"    aria-hidden="true" />
              }
              <span className="font-mono">{v.packId}</span>
              <span className="theme-text-muted">{v.detected}</span>
              <span className="ml-auto font-mono">{Math.round(v.confidence * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * GuardrailEvaluator — interactive test harness for AgentOS guardrail packs.
 *
 * Lets developers paste any text, choose which packs to test, and immediately
 * see per-pack verdicts, confidence scores, and the sanitized output.
 */
export function GuardrailEvaluator() {
  const inputText       = useGuardrailStore((s) => s.inputText);
  const selectedPacks   = useGuardrailStore((s) => s.selectedPacks);
  const currentVerdicts = useGuardrailStore((s) => s.currentVerdicts);
  const sanitizedOutput = useGuardrailStore((s) => s.sanitizedOutput);
  const evalLog         = useGuardrailStore((s) => s.evalLog);
  const allowList       = useGuardrailStore((s) => s.allowList);
  const evaluating      = useGuardrailStore((s) => s.evaluating);
  const error           = useGuardrailStore((s) => s.error);
  const setInputText    = useGuardrailStore((s) => s.setInputText);
  const togglePack      = useGuardrailStore((s) => s.togglePack);
  const evaluate        = useGuardrailStore((s) => s.evaluate);
  const allowEntity     = useGuardrailStore((s) => s.allowEntity);
  const clearLog        = useGuardrailStore((s) => s.clearLog);

  const [activeSubTab, setActiveSubTab] = useState<EvalSubTab>('harness');

  const canRun = inputText.trim().length > 0 && selectedPacks.length > 0 && !evaluating;

  const overallPass = currentVerdicts.length > 0 && currentVerdicts.every((v) => v.pass);

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Guardrails</p>
            <h3 className="text-sm font-semibold theme-text-primary">Evaluator</h3>
          </div>
          <HelpTooltip label="Explain guardrail evaluator" side="bottom">
            Run any text through the AgentOS guardrail pack pipeline.  Select which packs to test,
            paste your text, and see per-pack verdicts, confidence scores, and the sanitized output.
            Use the Allow-list tab to whitelist false-positive detections.
          </HelpTooltip>
        </div>
        {currentVerdicts.length > 0 && (
          <span
            className={[
              'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              overallPass
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400',
            ].join(' ')}
          >
            {overallPass ? 'All pass' : 'Failed'}
          </span>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-400">
          {error} (showing offline demo results)
        </div>
      )}

      {/* Sub-tab strip */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key)}
            title={`Open ${label} section`}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              activeSubTab === key
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
            {key === 'log' && evalLog.length > 0 && (
              <span className="ml-1 rounded-full bg-sky-500/30 px-1 text-[9px]">{evalLog.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Harness tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'harness' && (
        <div className="space-y-4">
          {/* Text input */}
          <div>
            <label className="block">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Input Text</p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                placeholder="Paste text to evaluate through guardrails…"
                className="w-full resize-none rounded-md border theme-border theme-bg-primary px-3 py-2 text-xs theme-text-primary placeholder:theme-text-muted focus:border-sky-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Pack selector */}
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Packs</p>
            <div className="space-y-1">
              {PACK_META.map((meta) => (
                <PackCheckbox
                  key={meta.id}
                  meta={meta}
                  checked={selectedPacks.includes(meta.id)}
                  onChange={() => togglePack(meta.id)}
                />
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            type="button"
            onClick={() => void evaluate()}
            disabled={!canRun}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Play size={12} aria-hidden="true" />
            {evaluating ? 'Evaluating…' : 'Run through guardrails'}
          </button>

          {/* Before / after */}
          {currentVerdicts.length > 0 && (
            <BeforeAfter original={inputText} sanitized={sanitizedOutput} />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Results tab                                                          */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'results' && (
        <div className="space-y-2">
          {currentVerdicts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Shield size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No evaluation results yet.</p>
              <p className="text-[10px] theme-text-muted">Run an evaluation in the Harness tab first.</p>
            </div>
          ) : (
            <>
              {currentVerdicts.map((v) => (
                <VerdictCard key={v.packId} verdict={v} onAllow={allowEntity} />
              ))}
              <BeforeAfter original={inputText} sanitized={sanitizedOutput} />
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Log tab                                                              */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'log' && (
        <div className="space-y-2">
          {evalLog.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearLog}
                className="inline-flex items-center gap-1 rounded-full border theme-border bg-[color:var(--color-background-secondary)] px-2.5 py-1 text-[9px] theme-text-secondary hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Trash2 size={9} aria-hidden="true" />
                Clear log
              </button>
            </div>
          )}
          {evalLog.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <p className="text-[10px] theme-text-muted">No evaluations logged yet.</p>
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="Evaluation log">
              {evalLog.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Allow-list tab                                                       */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'allowlist' && (
        <div className="space-y-2">
          {allowList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border theme-border theme-bg-primary py-8 text-center">
              <Shield size={20} className="theme-text-muted" aria-hidden="true" />
              <p className="text-xs theme-text-secondary">No allow-list entries yet.</p>
              <p className="text-[10px] theme-text-muted">
                Click &ldquo;Allow this entity&rdquo; in the Results tab to suppress false positives.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="Allow-list">
              {allowList.map((entry) => {
                const meta = PACK_META.find((p) => p.id === entry.packId);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border theme-border theme-bg-primary px-3 py-2 text-[10px]"
                  >
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate theme-text-primary">{entry.text}</span>
                    <span className="shrink-0 theme-text-muted">{meta?.label ?? entry.packId}</span>
                    <time className="shrink-0 font-mono theme-text-muted" dateTime={entry.allowedAt}>
                      {new Date(entry.allowedAt).toLocaleDateString()}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
