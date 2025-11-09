import { useEffect, useState } from 'react';
import { fetchUserSettings, updateUserSettings, type ProviderKey, type ProviderUpdatePayload } from '../lib/settingsClient';
import { GuardrailManager, type SerializableGuardrail } from './GuardrailManager';
import { StorageDashboard } from './StorageDashboard';

type FormState = {
  provider: ProviderKey;
  openaiKey: string;
  openaiModel: string;
  anthropicKey: string;
  anthropicModel: string;
  rpm: string;
};

type LimitsPayload = { rpm?: number };

export function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ provider: 'openai', openaiKey: '', openaiModel: '', anthropicKey: '', anthropicModel: '', rpm: '' });
  const [mask, setMask] = useState<{ openai?: string; anthropic?: string }>({});
  const [guardrails, setGuardrails] = useState<SerializableGuardrail[]>([
    {
      id: 'guardrail-pii',
      type: '@framersai/guardrail-keyword',
      displayName: 'PII Protection',
      description: 'Redacts SSN, email, phone from output (evaluates final chunk only for performance)',
      enabled: false, // Disabled by default - requires implementation
      config: {},
      priority: 10,
      uiMetadata: { category: 'privacy', icon: 'shield-check', color: '#10b981' }
    }
  ]);

  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchUserSettings();
        setMask({ openai: settings.providers.openai.apiKey.masked, anthropic: settings.providers.anthropic.apiKey.masked });
        setForm((prev) => ({
          ...prev,
          openaiModel: settings.providers.openai.model.value || '',
          anthropicModel: settings.providers.anthropic.model.value || '',
          rpm: settings.limits.rpm ? String(settings.limits.rpm) : '',
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const providers: ProviderUpdatePayload = {};
      if (form.openaiKey || form.openaiModel) providers.openai = {};
      if (form.openaiKey) providers.openai.apiKey = form.openaiKey;
      if (form.openaiModel) providers.openai.model = form.openaiModel;
      if (form.anthropicKey || form.anthropicModel) providers.anthropic = {};
      if (form.anthropicKey) providers.anthropic.apiKey = form.anthropicKey;
      if (form.anthropicModel) providers.anthropic.model = form.anthropicModel;

      const limits: LimitsPayload = {};
      if (form.rpm) limits.rpm = Number(form.rpm);

      await updateUserSettings({ providers, limits });
      // Refresh mask after save
      const refreshed = await fetchUserSettings();
      setMask({ openai: refreshed.providers.openai.apiKey.masked, anthropic: refreshed.providers.anthropic.apiKey.masked });
      setForm((prev) => ({ ...prev, openaiKey: '', anthropicKey: '' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Settings</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Providers & limits</h3>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">OpenAI</p>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">API key</span>
                <input
                  type="password"
                  placeholder={mask.openai || 'sk-…'}
                  value={form.openaiKey}
                  onChange={(e) => setForm((f) => ({ ...f, openaiKey: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="mt-2 block space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">Model</span>
                <input
                  placeholder="gpt-4o-mini"
                  value={form.openaiModel}
                  onChange={(e) => setForm((f) => ({ ...f, openaiModel: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Anthropic</p>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">API key</span>
                <input
                  type="password"
                  placeholder={mask.anthropic || 'sk-ant-…'}
                  value={form.anthropicKey}
                  onChange={(e) => setForm((f) => ({ ...f, anthropicKey: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="mt-2 block space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">Model</span>
                <input
                  placeholder="claude-3-5-sonnet"
                  value={form.anthropicModel}
                  onChange={(e) => setForm((f) => ({ ...f, anthropicModel: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Rate limiting</p>
            <label className="block space-y-1">
              <span className="text-xs text-slate-600 dark:text-slate-400">Requests per minute</span>
              <input
                inputMode="numeric"
                placeholder="Optional (UI only)"
                value={form.rpm}
                onChange={(e) => setForm((f) => ({ ...f, rpm: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Currently informational; server-side enforcement can be enabled later.</p>
          </div>

        </div>
      )}
      
      <div className="mt-6">
        <GuardrailManager
          guardrails={guardrails}
          onToggle={(id, enabled) => {
            setGuardrails((prev) => prev.map((g) => (g.id === id ? { ...g, enabled } : g)));
          }}
          onRemove={(id) => setGuardrails((prev) => prev.filter((g) => g.id !== id))}
          onConfigure={(id) => {
            console.log('Configure guardrail:', id);
            // TODO: Open config modal
          }}
        />
      </div>

      <div className="mt-6">
        <StorageDashboard />
      </div>
    </section>
  );
}


