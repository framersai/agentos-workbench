import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Shield, Plug, Settings2, FileText } from 'lucide-react';
import { useSessionStore, type PersonaDefinition } from '@/state/sessionStore';
import { persistPersonaRow } from "@/lib/storageBridge";
import type { SerializableGuardrail } from './GuardrailManager';

interface PersonaWizardProps {
  open: boolean;
  onClose: () => void;
}

interface PersonaDraft extends PersonaDefinition {
  baseSystemPrompt?: string;
  modelPreference?: string;
  guardrails?: SerializableGuardrail[];
  extensions?: string[];
  costSavingStrategy?: string;
  maxTokens?: number;
}

const STEPS = [
  { key: 'basics', label: 'Basics', icon: FileText },
  { key: 'config', label: 'Config', icon: Settings2 },
  { key: 'guardrails', label: 'Guardrails', icon: Shield },
  { key: 'extensions', label: 'Extensions', icon: Plug },
] as const;

type StepKey = typeof STEPS[number]['key'];

export function PersonaWizard({ open, onClose }: PersonaWizardProps) {
  const addPersona = useSessionStore((s) => s.addPersona);
  const personas = useSessionStore((s) => s.personas);
  const [step, setStep] = useState<StepKey>('basics');
  
  // Generate unique default name
  const generateDefaultName = () => {
    const base = 'New Persona';
    const existing = personas.filter(p => p.displayName.startsWith(base));
    return existing.length === 0 ? base : `${base} ${existing.length + 1}`;
  };
  
  const [draft, setDraft] = useState<Partial<PersonaDraft>>({
    displayName: generateDefaultName(),
    description: '',
    tags: [],
    traits: [],
    capabilities: [],
    guardrails: [],
    extensions: [],
    metadata: {},
  });

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStep(STEPS[currentStepIndex + 1].key);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1].key);
    }
  };

  const handleFinish = () => {
    if (!draft.displayName?.trim()) {
      alert('Display name is required');
      return;
    }

    const id = draft.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `persona-${Date.now()}`;
    const persona: PersonaDefinition = {
      id,
      displayName: draft.displayName.trim(),
      description: draft.description?.trim(),
      tags: draft.tags || [],
      traits: draft.traits || [],
      capabilities: draft.capabilities || [],
      metadata: {
        ...draft.metadata,
        baseSystemPrompt: draft.baseSystemPrompt,
        modelPreference: draft.modelPreference,
        guardrails: draft.guardrails,
        extensions: draft.extensions,
        costSavingStrategy: draft.costSavingStrategy,
        maxTokens: draft.maxTokens,
      },
      source: 'local',
    };

    addPersona(persona);
    void persistPersonaRow(persona);
    onClose();
    // Reset with new unique name
    setDraft({
      displayName: generateDefaultName(),
      description: '',
      tags: [],
      traits: [],
      capabilities: [],
      guardrails: [],
      extensions: [],
      metadata: {},
    });
    setStep('basics');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create New Persona</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Define AI agent personality, config, guardrails, and extensions</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Step Progress */}
        <div className="flex items-center border-b border-slate-200 px-6 py-3 dark:border-white/10">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isComplete = idx < currentStepIndex;
            return (
              <div key={s.key} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                    isActive
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                      : isComplete
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400'
                  }`}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {s.label}
                </button>
                {idx < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-slate-200 dark:bg-white/10" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="p-6">
          {step === 'basics' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Display Name *</span>
                <input
                  value={draft.displayName || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="Research Assistant"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
                <textarea
                  value={draft.description || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="Expert at gathering information and synthesizing findings..."
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tags (comma-separated)</span>
                <input
                  value={(draft.tags || []).join(', ')}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="research, analysis, web-search"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Traits (comma-separated)</span>
                <input
                  value={(draft.traits || []).join(', ')}
                  onChange={(e) => setDraft((d) => ({ ...d, traits: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="analytical, thorough, curious"
                />
              </label>
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Base System Prompt</span>
                <textarea
                  value={draft.baseSystemPrompt || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, baseSystemPrompt: e.target.value }))}
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono dark:border-white/10 dark:bg-slate-950"
                  placeholder="You are a helpful research assistant specialized in..."
                />
                <p className="mt-1 text-xs text-slate-500">Core instructions for the LLM (optional—AgentOS provides defaults)</p>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Model Preference</span>
                  <select
                    value={draft.modelPreference || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, modelPreference: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  >
                    <option value="">System default</option>
                    <option value="gpt-4o">gpt-4o (powerful)</option>
                    <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="openai/gpt-4o">OpenRouter: GPT-4o</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cost Strategy</span>
                  <select
                    value={draft.costSavingStrategy || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, costSavingStrategy: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  >
                    <option value="">Default</option>
                    <option value="prefer_free">Prefer free models</option>
                    <option value="balance_quality_cost">Balance quality/cost</option>
                    <option value="quality_first">Quality first</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Max Tokens</span>
                <input
                  type="number"
                  value={draft.maxTokens || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, maxTokens: parseInt(e.target.value) || undefined }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="8192"
                />
                <p className="mt-1 text-xs text-slate-500">Maximum context window (optional)</p>
              </label>
            </div>
          )}

          {step === 'guardrails' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Attach guardrails to enforce safety, privacy, and compliance policies for this persona.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Available Guardrails</p>
                {[
                  { id: 'pii-protection', name: 'PII Protection', desc: 'Redact SSN, email, phone' },
                  { id: 'cost-ceiling', name: 'Cost Ceiling', desc: 'Limit response cost' },
                  { id: 'sensitive-topic', name: 'Sensitive Topics', desc: 'Block harmful content' },
                ].map((g) => {
                  const enabled = draft.guardrails?.some((dg) => dg.id === g.id);
                  return (
                    <label key={g.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDraft((d) => ({
                              ...d,
                              guardrails: [
                                ...(d.guardrails || []),
                                {
                                  id: g.id,
                                  type: `@framersai/guardrail-${g.id}`,
                                  displayName: g.name,
                                  enabled: true,
                                  config: {},
                                },
                              ],
                            }));
                          } else {
                            setDraft((d) => ({
                              ...d,
                              guardrails: (d.guardrails || []).filter((dg) => dg.id !== g.id),
                            }));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{g.name}</p>
                        <p className="text-xs text-slate-500">{g.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {draft.guardrails && draft.guardrails.length > 0 && (
                <div className="text-xs text-slate-500">
                  {draft.guardrails.length} guardrail(s) selected
                </div>
              )}
            </div>
          )}

          {step === 'extensions' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select which extensions (tools, integrations) this persona can use.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Available Extensions</p>
                {[
                  { id: '@framersai/ext-web-search', name: 'Web Search', desc: 'Search the web, fact-check, research' },
                  { id: '@framersai/ext-telegram', name: 'Telegram Bot', desc: 'Send messages, manage groups' },
                  { id: '@framersai/ext-code-executor', name: 'Code Executor', desc: 'Run Python, JS in sandbox' },
                ].map((ext) => {
                  const enabled = draft.extensions?.includes(ext.id);
                  return (
                    <label key={ext.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDraft((d) => ({ ...d, extensions: [...(d.extensions || []), ext.id] }));
                          } else {
                            setDraft((d) => ({ ...d, extensions: (d.extensions || []).filter((e) => e !== ext.id) }));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ext.name}</p>
                        <p className="text-xs text-slate-500">{ext.desc}</p>
                        <p className="text-[10px] font-mono text-slate-400">{ext.id}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {draft.extensions && draft.extensions.length > 0 && (
                <div className="text-xs text-slate-500">
                  {draft.extensions.length} extension(s) selected
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-xs text-slate-500">
            Step {currentStepIndex + 1} of {STEPS.length}
          </div>
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            {isLastStep ? (
              <>
                <Check className="h-4 w-4" />
                Create Persona
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

