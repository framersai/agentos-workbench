import { useState } from 'react';
import { Shield, Plus, Trash2, Power, Settings2 } from 'lucide-react';

export interface SerializableGuardrail {
  id: string;
  type: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  priority?: number;
  uiMetadata?: {
    category?: 'safety' | 'privacy' | 'budget' | 'compliance' | 'quality' | 'custom';
    icon?: string;
    color?: string;
  };
}

interface GuardrailManagerProps {
  personaId?: string;
  guardrails: SerializableGuardrail[];
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  onConfigure: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  safety: '#ef4444',
  privacy: '#10b981',
  budget: '#f59e0b',
  compliance: '#3b82f6',
  quality: '#8b5cf6',
  custom: '#6b7280',
};

export function GuardrailManager({
  personaId,
  guardrails,
  onToggle,
  onRemove,
  onConfigure,
}: GuardrailManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Guardrails</p>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {personaId ? `Active for ${personaId}` : 'Safety & Policy'}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500 px-3 py-1 text-xs text-sky-600 hover:bg-sky-50 dark:border-sky-400 dark:text-sky-300 dark:hover:bg-sky-950"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </header>

      {guardrails.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
          No guardrails configured. Click &ldquo;Add&rdquo; to install from the registry.
        </div>
      ) : (
        <div className="space-y-2">
          {guardrails.map((guard) => (
            <div
              key={guard.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[guard.uiMetadata?.category ?? 'custom'] + '20' }}
              >
                <Shield className="h-4 w-4" style={{ color: CATEGORY_COLORS[guard.uiMetadata?.category ?? 'custom'] }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{guard.displayName}</p>
                {guard.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{guard.description}</p>
                )}
                {guard.uiMetadata?.category && (
                  <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {guard.uiMetadata.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(guard.id, !guard.enabled)}
                  className={`rounded-md p-1 transition ${
                    guard.enabled
                      ? 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title={guard.enabled ? 'Enabled' : 'Disabled'}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onConfigure(guard.id)}
                  className="rounded-md p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
                  title="Configure"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(guard.id)}
                  className="rounded-md p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-950"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Add Guardrail</h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Browse the guardrail registry and select one to install.
            </p>
            {/* TODO: Fetch from registry.json and display */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Coming soon: Browse curated and community guardrails</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

