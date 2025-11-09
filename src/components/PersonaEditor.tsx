import { useState } from 'react';
import { Save, X, Shield, Plug, Settings2, User } from 'lucide-react';
import { useSessionStore, type PersonaDefinition } from '@/state/sessionStore';
import type { SerializableGuardrail } from './GuardrailManager';

interface PersonaEditorProps {
  persona: PersonaDefinition;
  onClose: () => void;
}

export function PersonaEditor({ persona, onClose }: PersonaEditorProps) {
  const updatePersona = useSessionStore((s) => s.updatePersona);
  const [draft, setDraft] = useState({
    displayName: persona.displayName,
    description: persona.description || '',
    tags: (persona.tags || []).join(', '),
    traits: (persona.traits || []).join(', '),
    capabilities: (persona.capabilities || []).join(', '),
    baseSystemPrompt: persona.metadata?.baseSystemPrompt as string || '',
    modelPreference: persona.metadata?.modelPreference as string || '',
    costSavingStrategy: persona.metadata?.costSavingStrategy as string || '',
    maxTokens: typeof persona.metadata?.maxTokens === 'number' ? persona.metadata.maxTokens : '',
    guardrails: persona.metadata?.guardrails as SerializableGuardrail[] || [],
    extensions: persona.metadata?.extensions as string[] || [],
  });

  const handleSave = () => {
    updatePersona(persona.id, {
      displayName: draft.displayName.trim(),
      description: draft.description.trim() || undefined,
      tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
      traits: draft.traits.split(',').map(t => t.trim()).filter(Boolean),
      capabilities: draft.capabilities.split(',').map(t => t.trim()).filter(Boolean),
      metadata: {
        ...persona.metadata,
        baseSystemPrompt: draft.baseSystemPrompt.trim() || undefined,
        modelPreference: draft.modelPreference.trim() || undefined,
        costSavingStrategy: draft.costSavingStrategy.trim() || undefined,
        maxTokens: draft.maxTokens || undefined,
        guardrails: draft.guardrails,
        extensions: draft.extensions,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Persona</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{persona.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <User className="h-4 w-4" />
              Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Display Name</span>
                <input
                  value={draft.displayName}
                  onChange={(e) => setDraft(d => ({ ...d, displayName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Source</span>
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/50">
                  {persona.source === 'remote' ? 'Remote (server-managed)' : 'Local (browser storage)'}
                </div>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                placeholder="What this persona does and when to use it..."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tags</span>
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft(d => ({ ...d, tags: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="research, analysis"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Traits</span>
                <input
                  value={draft.traits}
                  onChange={(e) => setDraft(d => ({ ...d, traits: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="analytical, thorough"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Capabilities</span>
                <input
                  value={draft.capabilities}
                  onChange={(e) => setDraft(d => ({ ...d, capabilities: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="web-search, analysis"
                />
              </label>
            </div>
          </section>

          {/* Configuration */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Settings2 className="h-4 w-4" />
              Configuration
            </h3>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Base System Prompt</span>
              <textarea
                value={draft.baseSystemPrompt}
                onChange={(e) => setDraft(d => ({ ...d, baseSystemPrompt: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono dark:border-white/10 dark:bg-slate-950"
                placeholder="You are a helpful research assistant..."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Model Preference</span>
                <input
                  value={draft.modelPreference}
                  onChange={(e) => setDraft(d => ({ ...d, modelPreference: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="gpt-4o-mini"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cost Strategy</span>
                <select
                  value={draft.costSavingStrategy}
                  onChange={(e) => setDraft(d => ({ ...d, costSavingStrategy: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                >
                  <option value="">Default</option>
                  <option value="prefer_free">Prefer free</option>
                  <option value="balance_quality_cost">Balance quality/cost</option>
                  <option value="quality_first">Quality first</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Max Tokens</span>
                <input
                  type="number"
                  value={draft.maxTokens}
                  onChange={(e) => {
                    const numeric = Number(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      maxTokens: Number.isNaN(numeric) || e.target.value === '' ? '' : numeric
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                  placeholder="8192"
                />
              </label>
            </div>
          </section>

          {/* Guardrails */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Shield className="h-4 w-4" />
              Guardrails ({draft.guardrails.length})
            </h3>
            {draft.guardrails.length === 0 ? (
              <p className="text-sm text-slate-500">No guardrails configured</p>
            ) : (
              <div className="space-y-2">
                {draft.guardrails.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{g.displayName}</p>
                      <p className="text-xs text-slate-500">{g.description}</p>
                    </div>
                    <button
                      onClick={() => setDraft(d => ({ ...d, guardrails: d.guardrails.filter((_, i) => i !== idx) }))}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Extensions */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Plug className="h-4 w-4" />
              Extensions ({draft.extensions.length})
            </h3>
            {draft.extensions.length === 0 ? (
              <p className="text-sm text-slate-500">No extensions configured</p>
            ) : (
              <div className="space-y-2">
                {draft.extensions.map((ext, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ext}</p>
                      <a 
                        href={`https://npmjs.com/package/${ext}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400"
                      >
                        View on npm →
                      </a>
                    </div>
                    <button
                      onClick={() => setDraft(d => ({ ...d, extensions: d.extensions.filter((_, i) => i !== idx) }))}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
