/**
 * GuardrailPackManager — replaces the old regex/keyword guardrail editor
 * with the real AgentOS 5-pack extension system.
 *
 * Sections:
 * 1. Security Tier Picker — 5 radio buttons (dangerous → paranoid)
 * 2. Pack Toggles — 5 checkboxes with status badges
 * 3. Live Status — per-pack evaluation stats (collapsed by default)
 */

import { useState } from 'react';
import { Shield, Brain, Target, Code, Search } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported security tier identifiers, ordered from least to most restrictive. */
type Tier = 'dangerous' | 'permissive' | 'balanced' | 'strict' | 'paranoid';

/** Keyed pack enable/disable state for the 5 AgentOS guardrail packs. */
interface PackState {
  piiRedaction: boolean;
  mlClassifiers: boolean;
  topicality: boolean;
  codeSafety: boolean;
  groundingGuard: boolean;
}

/** Props accepted by GuardrailPackManager. */
export interface GuardrailPackManagerProps {
  /**
   * Called whenever the tier or any individual pack toggle changes.
   * Receives the full current configuration snapshot.
   */
  onConfigChange?: (config: { tier: string; packs: Record<string, boolean> }) => void;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

/**
 * Canonical pack defaults for each security tier.
 * Used to (a) seed pack state when a tier is selected and
 * (b) determine whether individual packs have been overridden ("custom" badge).
 */
const TIER_PACK_DEFAULTS: Record<Tier, PackState> = {
  dangerous:  { piiRedaction: false, mlClassifiers: false, topicality: false, codeSafety: false, groundingGuard: false },
  permissive: { piiRedaction: false, mlClassifiers: false, topicality: false, codeSafety: true,  groundingGuard: false },
  balanced:   { piiRedaction: true,  mlClassifiers: false, topicality: false, codeSafety: true,  groundingGuard: false },
  strict:     { piiRedaction: true,  mlClassifiers: true,  topicality: false, codeSafety: true,  groundingGuard: false },
  paranoid:   { piiRedaction: true,  mlClassifiers: true,  topicality: true,  codeSafety: true,  groundingGuard: true  },
};

/**
 * One-line description shown next to each tier radio button.
 */
const TIER_DESCRIPTIONS: Record<Tier, string> = {
  dangerous:  'No guardrails — unrestricted access',
  permissive: 'Code safety only — lightweight regex scanning',
  balanced:   'PII redaction + code safety — recommended for most use cases',
  strict:     'PII + ML classifiers + code safety — production-grade',
  paranoid:   'All 5 packs enabled — maximum safety',
};

/** Ordered list of tier keys for deterministic rendering. */
const TIERS: Tier[] = ['dangerous', 'permissive', 'balanced', 'strict', 'paranoid'];

/**
 * Metadata for each of the 5 guardrail extension packs.
 * `key` matches the `PackState` property name; `icon` is a lucide-react component.
 */
const PACK_INFO: Array<{
  key: keyof PackState;
  name: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}> = [
  {
    key: 'piiRedaction',
    name: 'PII Redaction',
    description: 'Detect and redact personal info (SSN, names, emails) via regex + NER + LLM',
    Icon: Shield,
  },
  {
    key: 'mlClassifiers',
    name: 'ML Classifiers',
    description: 'Toxicity, injection, jailbreak detection via ONNX BERT models',
    Icon: Brain,
  },
  {
    key: 'topicality',
    name: 'Topicality',
    description: 'Embedding-based topic enforcement with session drift detection',
    Icon: Target,
  },
  {
    key: 'codeSafety',
    name: 'Code Safety',
    description: 'OWASP Top 10 code scanning for LLM-generated code (25 regex rules)',
    Icon: Code,
  },
  {
    key: 'groundingGuard',
    name: 'Grounding Guard',
    description: 'RAG-grounded hallucination detection via NLI entailment',
    Icon: Search,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * GuardrailPackManager renders the AgentOS 5-pack guardrail configuration UI.
 *
 * The component is self-contained: it manages its own tier + pack state and
 * propagates changes upward via the optional `onConfigChange` callback.
 *
 * @example
 * ```tsx
 * <GuardrailPackManager onConfigChange={(cfg) => console.log(cfg)} />
 * ```
 */
export function GuardrailPackManager({ onConfigChange }: GuardrailPackManagerProps) {
  const [tier, setTier] = useState<Tier>('balanced');
  const [packs, setPacks] = useState<PackState>({ ...TIER_PACK_DEFAULTS['balanced'] });

  /**
   * Handles tier selection: resets all packs to tier defaults and fires the
   * onConfigChange callback with the new canonical state.
   */
  const handleTierChange = (newTier: Tier) => {
    const defaults = { ...TIER_PACK_DEFAULTS[newTier] };
    setTier(newTier);
    setPacks(defaults);
    onConfigChange?.({ tier: newTier, packs: defaults });
  };

  /**
   * Handles an individual pack toggle.  The tier selection is preserved; a
   * "custom" badge will appear on any pack whose value differs from the tier
   * default.
   */
  const handlePackToggle = (key: keyof PackState) => {
    const updated = { ...packs, [key]: !packs[key] };
    setPacks(updated);
    onConfigChange?.({ tier, packs: updated });
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Security Tier                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted mb-0.5">
          Security Tier
        </p>
        <p className="text-[10px] theme-text-secondary mb-2">
          Select the overall guardrail posture for this agent.
        </p>

        <div className="space-y-1">
          {TIERS.map((t) => {
            const isSelected = tier === t;
            return (
              <label
                key={t}
                className={[
                  'flex items-start gap-2.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors',
                  isSelected
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'theme-border theme-bg-primary hover:bg-white/5',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="guardrail-tier"
                  value={t}
                  checked={isSelected}
                  onChange={() => handleTierChange(t)}
                  className="mt-0.5 accent-sky-500 shrink-0"
                />
                <div>
                  <span
                    className={[
                      'text-xs font-semibold capitalize',
                      isSelected ? 'text-sky-400' : 'theme-text-primary',
                    ].join(' ')}
                  >
                    {t}
                  </span>
                  <p className="text-[10px] theme-text-secondary mt-0.5">
                    {TIER_DESCRIPTIONS[t]}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Guardrail Packs                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted mb-0.5">
          Guardrail Packs
        </p>
        <p className="text-[10px] theme-text-secondary mb-2">
          Content safety extensions. Toggle individual packs to override tier defaults.
        </p>

        <div className="space-y-1.5">
          {PACK_INFO.map(({ key, name, description, Icon }) => {
            const enabled = packs[key];
            const isCustom = enabled !== TIER_PACK_DEFAULTS[tier][key];

            return (
              <label
                key={key}
                className={[
                  'flex items-start gap-2.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors',
                  enabled
                    ? 'theme-border theme-bg-primary'
                    : 'theme-border theme-bg-primary opacity-60',
                  'hover:bg-white/5',
                ].join(' ')}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handlePackToggle(key)}
                  className="mt-0.5 accent-sky-500 shrink-0"
                />

                {/* Icon */}
                <Icon
                  size={14}
                  className={enabled ? 'mt-0.5 shrink-0 text-sky-400' : 'mt-0.5 shrink-0 theme-text-muted'}
                />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold theme-text-primary">{name}</span>
                    {isCustom && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-px text-[9px] font-medium text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                        custom
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] theme-text-secondary mt-0.5 leading-relaxed">
                    {description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
