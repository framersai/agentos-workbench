/**
 * SettingsPanel — top-level settings panel for the AgentOS Workbench.
 *
 * Contains a sub-navigation bar with tabs:
 *   LLM | Guardrails | Skills | Extensions | Secrets | Storage
 *
 * Each tab lazily renders its content section so the panel remains compact.
 */

import { useEffect, useState } from 'react';
import { fetchUserSettings, updateUserSettings, type ProviderKey, type ProviderUpdatePayload } from '../lib/settingsClient';
import { configureGuardrails } from '../lib/agentosClient';
import { GuardrailPackManager } from './GuardrailPackManager';
import { StorageDashboard } from './StorageDashboard';
import { SkillBrowser } from './SkillBrowser';
import { ExtensionManager } from './ExtensionManager';
import { SecretManager } from './SecretManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = {
  provider: ProviderKey;
  openaiKey: string;
  openaiModel: string;
  anthropicKey: string;
  anthropicModel: string;
  rpm: string;
};

type LimitsPayload = { rpm?: number };

/**
 * Identifiers for the Settings sub-navigation tabs.
 * Ordered to match the visual left-to-right tab strip.
 */
type SettingsTab = 'llm' | 'guardrails' | 'skills' | 'extensions' | 'secrets' | 'storage';

/** Ordered tab definitions for rendering the sub-nav strip. */
const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'llm',        label: 'LLM'        },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'skills',     label: 'Skills'     },
  { id: 'extensions', label: 'Extensions' },
  { id: 'secrets',    label: 'Secrets'    },
  { id: 'storage',    label: 'Storage'    },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SettingsPanel renders the full settings experience, segmented into tabs.
 *
 * Provider configuration (LLM) and rate limits are fetched from the backend
 * on mount.  All other tabs are rendered inline with their own data sources.
 */
export function SettingsPanel() {
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [activeTab, setActiveTab]         = useState<SettingsTab>('llm');
  const [form, setForm]                   = useState<FormState>({
    provider: 'openai',
    openaiKey: '',
    openaiModel: '',
    anthropicKey: '',
    anthropicModel: '',
    rpm: '',
  });
  const [mask, setMask]                   = useState<{ openai?: string; anthropic?: string }>({});

  // Load provider settings on mount
  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchUserSettings();
        setMask({
          openai:    settings.providers.openai.apiKey.masked,
          anthropic: settings.providers.anthropic.apiKey.masked,
        });
        setForm((prev) => ({
          ...prev,
          openaiModel:    settings.providers.openai.model.value    || '',
          anthropicModel: settings.providers.anthropic.model.value || '',
          rpm:            settings.limits.rpm ? String(settings.limits.rpm) : '',
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Persists LLM provider settings and refreshes the masked key display. */
  const onSave = async () => {
    setSaving(true);
    try {
      const providers: ProviderUpdatePayload = {};
      if (form.openaiKey || form.openaiModel) {
        providers.openai = {};
        if (form.openaiKey)    providers.openai.apiKey = form.openaiKey;
        if (form.openaiModel)  providers.openai.model  = form.openaiModel;
      }
      if (form.anthropicKey || form.anthropicModel) {
        providers.anthropic = {};
        if (form.anthropicKey)    providers.anthropic.apiKey = form.anthropicKey;
        if (form.anthropicModel)  providers.anthropic.model  = form.anthropicModel;
      }

      const limits: LimitsPayload = {};
      if (form.rpm) limits.rpm = Number(form.rpm);

      await updateUserSettings({ providers, limits });

      // Refresh masked key display after save
      const refreshed = await fetchUserSettings();
      setMask({
        openai:    refreshed.providers.openai.apiKey.masked,
        anthropic: refreshed.providers.anthropic.apiKey.masked,
      });
      setForm((prev) => ({ ...prev, openaiKey: '', anthropicKey: '' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3 transition-theme">
      {/* Header row — title + Save button (only relevant on LLM tab) */}
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Settings</p>
          <h3 className="text-sm font-semibold theme-text-primary">Agent configuration</h3>
        </div>
        {activeTab === 'llm' && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full theme-bg-accent px-3 py-1 text-xs font-semibold theme-text-on-accent disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </header>

      {/* Sub-navigation tab strip */}
      <div className="mb-4 flex gap-0.5 overflow-x-auto rounded-lg border theme-border theme-bg-primary p-0.5">
        {SETTINGS_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={[
              'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
              activeTab === id
                ? 'bg-sky-500 text-white'
                : 'theme-text-secondary hover:theme-text-primary hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab content                                                         */}
      {/* ------------------------------------------------------------------ */}

      {/* LLM — provider keys + rate limit */}
      {activeTab === 'llm' && (
        loading ? (
          <p className="text-xs theme-text-muted">Loading…</p>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* OpenAI */}
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">OpenAI</p>
                <label className="block space-y-1">
                  <span className="text-[10px] theme-text-secondary">API key</span>
                  <input
                    type="password"
                    placeholder={mask.openai || 'sk-…'}
                    value={form.openaiKey}
                    onChange={(e) => setForm((f) => ({ ...f, openaiKey: e.target.value }))}
                    className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                  />
                </label>
                <label className="mt-2 block space-y-1">
                  <span className="text-[10px] theme-text-secondary">Model</span>
                  <input
                    placeholder="gpt-4o-mini"
                    value={form.openaiModel}
                    onChange={(e) => setForm((f) => ({ ...f, openaiModel: e.target.value }))}
                    className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                  />
                </label>
              </div>

              {/* Anthropic */}
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Anthropic</p>
                <label className="block space-y-1">
                  <span className="text-[10px] theme-text-secondary">API key</span>
                  <input
                    type="password"
                    placeholder={mask.anthropic || 'sk-ant-…'}
                    value={form.anthropicKey}
                    onChange={(e) => setForm((f) => ({ ...f, anthropicKey: e.target.value }))}
                    className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                  />
                </label>
                <label className="mt-2 block space-y-1">
                  <span className="text-[10px] theme-text-secondary">Model</span>
                  <input
                    placeholder="claude-3-5-sonnet"
                    value={form.anthropicModel}
                    onChange={(e) => setForm((f) => ({ ...f, anthropicModel: e.target.value }))}
                    className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">Rate limiting</p>
              <label className="block space-y-1">
                <span className="text-[10px] theme-text-secondary">Requests per minute</span>
                <input
                  inputMode="numeric"
                  placeholder="Optional (UI only)"
                  value={form.rpm}
                  onChange={(e) => setForm((f) => ({ ...f, rpm: e.target.value }))}
                  className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                />
              </label>
              <p className="mt-1 text-[10px] theme-text-muted">
                Currently informational; server-side enforcement can be enabled later.
              </p>
            </div>
          </div>
        )
      )}

      {/* Guardrails — 5-pack AgentOS extension system */}
      {activeTab === 'guardrails' && (
        <GuardrailPackManager
          onConfigChange={(cfg) => {
            void configureGuardrails(cfg).catch(() => {
              // Non-blocking settings write.
            });
          }}
        />
      )}

      {/* Skills — SkillBrowser (Task 4) */}
      {activeTab === 'skills' && <SkillBrowser />}

      {activeTab === 'extensions' && <ExtensionManager />}

      {activeTab === 'secrets' && <SecretManager />}

      {/* Storage — existing StorageDashboard */}
      {activeTab === 'storage' && (
        <StorageDashboard />
      )}
    </section>
  );
}
