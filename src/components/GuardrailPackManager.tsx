/**
 * @file GuardrailPackManager.tsx
 * @description Security guardrail tier selector and pack toggle manager.
 *
 * Five named security tiers (from {@link packages/agentos/src/guardrails/SecurityTiers.ts}):
 *
 * | Tier       | PII | ML Classifiers | Topicality | Code Safety | Grounding |
 * |------------|-----|----------------|------------|-------------|-----------|
 * | Dangerous  |     |                |            |             |           |
 * | Permissive |     |                |            | X           |           |
 * | Balanced   | X   |                |            | X           |           |
 * | Strict     | X   | X              |            | X           |           |
 * | Paranoid   | X   | X              | X          | X           | X         |
 *
 * Selecting a tier pre-fills the pack toggles with defaults from
 * {@link TIER_PACK_DEFAULTS}.  Individual packs can be overridden after
 * tier selection.  Config flows upward via {@link GuardrailPackManagerProps.onConfigChange}.
 *
 * On mount, the panel fetches runtime guardrail config from
 * `GET /api/agentos/guardrails` to show the currently active tier.
 */
import { useEffect, useMemo, useState } from 'react';
import { Brain, Code, Search, Shield, Target, type LucideIcon } from 'lucide-react';
import {
  getGuardrails,
  type GuardrailConfigResponse,
  type GuardrailTier,
} from '../lib/agentosClient';

type PackState = {
  piiRedaction: boolean;
  mlClassifiers: boolean;
  topicality: boolean;
  codeSafety: boolean;
  groundingGuard: boolean;
};

export interface GuardrailPackManagerProps {
  onConfigChange?: (config: { tier: GuardrailTier; packs: Record<string, boolean> }) => void;
}

const TIER_PACK_DEFAULTS: Record<GuardrailTier, PackState> = {
  dangerous: { piiRedaction: false, mlClassifiers: false, topicality: false, codeSafety: false, groundingGuard: false },
  permissive: { piiRedaction: false, mlClassifiers: false, topicality: false, codeSafety: true, groundingGuard: false },
  balanced: { piiRedaction: true, mlClassifiers: false, topicality: false, codeSafety: true, groundingGuard: false },
  strict: { piiRedaction: true, mlClassifiers: true, topicality: false, codeSafety: true, groundingGuard: false },
  paranoid: { piiRedaction: true, mlClassifiers: true, topicality: true, codeSafety: true, groundingGuard: true },
};

const TIER_DESCRIPTIONS: Record<GuardrailTier, string> = {
  dangerous: 'No guardrails; useful only for fully trusted local workflows.',
  permissive: 'Minimal scanning with code safety enabled by default.',
  balanced: 'PII redaction plus code safety; good default for most agents.',
  strict: 'Adds ML classifiers for stronger production protections.',
  paranoid: 'Enables all published safety packs for maximum enforcement.',
};

const TIERS: GuardrailTier[] = ['dangerous', 'permissive', 'balanced', 'strict', 'paranoid'];

const PACK_INFO: Array<{
  id: keyof PackState;
  apiId: string;
  fallbackName: string;
  fallbackDescription: string;
  Icon: LucideIcon;
}> = [
  {
    id: 'piiRedaction',
    apiId: 'pii-redaction',
    fallbackName: 'PII Redaction',
    fallbackDescription: 'Detect and redact personal data before it leaves the model boundary.',
    Icon: Shield,
  },
  {
    id: 'mlClassifiers',
    apiId: 'ml-classifiers',
    fallbackName: 'ML Classifiers',
    fallbackDescription: 'Classify toxicity, prompt injection, and jailbreak attempts.',
    Icon: Brain,
  },
  {
    id: 'topicality',
    apiId: 'topicality',
    fallbackName: 'Topicality',
    fallbackDescription: 'Keep conversations on policy-approved topics and detect drift.',
    Icon: Target,
  },
  {
    id: 'codeSafety',
    apiId: 'code-safety',
    fallbackName: 'Code Safety',
    fallbackDescription: 'Scan generated code for dangerous or policy-disallowed patterns.',
    Icon: Code,
  },
  {
    id: 'groundingGuard',
    apiId: 'grounding-guard',
    fallbackName: 'Grounding Guard',
    fallbackDescription: 'Verify factual grounding against retrieved context and source material.',
    Icon: Search,
  },
];

function toPackState(response: GuardrailConfigResponse): PackState {
  const enabledPacks = new Map(response.packs.map((pack) => [pack.id, pack.enabled]));
  return {
    piiRedaction: enabledPacks.get('pii-redaction') ?? TIER_PACK_DEFAULTS[response.tier].piiRedaction,
    mlClassifiers: enabledPacks.get('ml-classifiers') ?? TIER_PACK_DEFAULTS[response.tier].mlClassifiers,
    topicality: enabledPacks.get('topicality') ?? TIER_PACK_DEFAULTS[response.tier].topicality,
    codeSafety: enabledPacks.get('code-safety') ?? TIER_PACK_DEFAULTS[response.tier].codeSafety,
    groundingGuard: enabledPacks.get('grounding-guard') ?? TIER_PACK_DEFAULTS[response.tier].groundingGuard,
  };
}

export function GuardrailPackManager({ onConfigChange }: GuardrailPackManagerProps) {
  const [tier, setTier] = useState<GuardrailTier>('balanced');
  const [packs, setPacks] = useState<PackState>({ ...TIER_PACK_DEFAULTS.balanced });
  const [catalog, setCatalog] = useState<GuardrailConfigResponse['packs']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await getGuardrails();
        if (cancelled) return;
        setTier(config.tier);
        setPacks(toPackState(config));
        setCatalog(config.packs);
      } catch {
        if (!cancelled) {
          setCatalog([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogById = useMemo(
    () => new Map(catalog.map((pack) => [pack.id, pack])),
    [catalog]
  );

  const emitConfig = (nextTier: GuardrailTier, nextPacks: PackState) => {
    onConfigChange?.({ tier: nextTier, packs: nextPacks });
  };

  const handleTierChange = (nextTier: GuardrailTier) => {
    const nextPacks = { ...TIER_PACK_DEFAULTS[nextTier] };
    setTier(nextTier);
    setPacks(nextPacks);
    emitConfig(nextTier, nextPacks);
  };

  const handlePackToggle = (key: keyof PackState) => {
    const nextPacks = { ...packs, [key]: !packs[key] };
    setPacks(nextPacks);
    emitConfig(tier, nextPacks);
  };

  if (loading) {
    return <p className="text-xs theme-text-muted">Loading guardrail packs…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Security Tier</p>
        <p className="mb-2 text-[10px] theme-text-secondary">
          Choose the default guardrail posture, then override individual packs if needed.
        </p>
        <div className="space-y-1">
          {TIERS.map((value) => {
            const selected = tier === value;
            return (
              <label
                key={value}
                className={[
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                  selected ? 'border-sky-500/60 bg-sky-500/10' : 'theme-border theme-bg-primary hover:bg-white/5',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="guardrail-tier"
                  checked={selected}
                  onChange={() => handleTierChange(value)}
                  className="mt-0.5 shrink-0 accent-sky-500"
                />
                <div>
                  <span className={selected ? 'text-xs font-semibold capitalize text-sky-400' : 'text-xs font-semibold capitalize theme-text-primary'}>
                    {value}
                  </span>
                  <p className="mt-0.5 text-[10px] theme-text-secondary">{TIER_DESCRIPTIONS[value]}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-0.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Guardrail Packs</p>
        <p className="mb-2 text-[10px] theme-text-secondary">
          Registry-backed safety extensions. Installed status now reflects the actual extension sources in this repo.
        </p>

        <div className="space-y-1.5">
          {PACK_INFO.map(({ id, apiId, fallbackName, fallbackDescription, Icon }) => {
            const pack = catalogById.get(apiId);
            const enabled = packs[id];
            const isCustom = enabled !== TIER_PACK_DEFAULTS[tier][id];
            return (
              <label
                key={apiId}
                className={[
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors hover:bg-white/5',
                  enabled ? 'theme-border theme-bg-primary' : 'theme-border theme-bg-primary opacity-70',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handlePackToggle(id)}
                  className="mt-0.5 shrink-0 accent-sky-500"
                />
                <Icon
                  size={14}
                  className={enabled ? 'mt-0.5 shrink-0 text-sky-400' : 'mt-0.5 shrink-0 theme-text-muted'}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold theme-text-primary">
                      {pack?.name ?? fallbackName}
                    </span>
                    {pack?.installed && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                        installed
                      </span>
                    )}
                    {pack?.verified && (
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-sky-300">
                        verified
                      </span>
                    )}
                    {isCustom && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-amber-400">
                        custom
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed theme-text-secondary">
                    {pack?.description ?? fallbackDescription}
                  </p>
                  {pack?.package && (
                    <p className="mt-1 text-[10px] font-mono theme-text-muted">{pack.package}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
