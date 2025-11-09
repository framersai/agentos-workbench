/**
 * @fileoverview Guardrails Configuration UI Component
 * @description Allows users to configure custom guardrails with regex patterns and keyword lists
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface GuardrailRule {
  id: string;
  name: string;
  type: 'regex' | 'keyword';
  pattern: string;
  action: 'block' | 'flag' | 'sanitize';
  enabled: boolean;
  description?: string;
}

interface GuardrailsConfigProps {
  rules: GuardrailRule[];
  onRulesChange: (rules: GuardrailRule[]) => void;
  className?: string;
}

/**
 * Guardrails Configuration Component
 * 
 * Allows users to:
 * - Add regex patterns for content filtering
 * - Add keyword lists for blocking/flagging
 * - Configure actions (block, flag, sanitize)
 * - Enable/disable individual rules
 */
export function GuardrailsConfig({ rules, onRulesChange, className = '' }: GuardrailsConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addRule = useCallback(() => {
    const newRule: GuardrailRule = {
      id: crypto.randomUUID(),
      name: 'New Rule',
      type: 'keyword',
      pattern: '',
      action: 'flag',
      enabled: true,
    };
    onRulesChange([...rules, newRule]);
    setEditingId(newRule.id);
  }, [rules, onRulesChange]);

  const updateRule = useCallback((id: string, updates: Partial<GuardrailRule>) => {
    onRulesChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [rules, onRulesChange]);

  const removeRule = useCallback((id: string) => {
    onRulesChange(rules.filter(r => r.id !== id));
  }, [rules, onRulesChange]);

  const validatePattern = useCallback((pattern: string, type: 'regex' | 'keyword'): { valid: boolean; error?: string } => {
    if (!pattern.trim()) {
      return { valid: false, error: 'Pattern cannot be empty' };
    }
    
    if (type === 'regex') {
      try {
        new RegExp(pattern);
        return { valid: true };
      } catch (e) {
        return { valid: false, error: `Invalid regex: ${(e as Error).message}` };
      }
    }
    
    return { valid: true };
  }, []);

  return (
    <div className={`rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/60 ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Shield className={`h-4 w-4 ${rules.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Custom Guardrails ({rules.filter(r => r.enabled).length}/{rules.length} active)
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {expanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-4 dark:border-white/10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Configure regex patterns and keyword lists to filter content. Rules are applied to both input and output.
            </p>
            <button
              onClick={addRule}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            >
              <Plus className="h-3 w-3" />
              Add Rule
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-500">
              No guardrail rules configured. Click &ldquo;Add Rule&rdquo; to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                const validation = validatePattern(rule.pattern, rule.type);
                
                return (
                  <div
                    key={rule.id}
                    className={`rounded-lg border p-3 ${
                      rule.enabled
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                        : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        {isEditing ? (
                          <>
                            <input
                              value={rule.name}
                              onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                              placeholder="Rule name"
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select
                                value={rule.type}
                                onChange={(e) => updateRule(rule.id, { type: e.target.value as 'regex' | 'keyword' })}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                              >
                                <option value="keyword">Keyword List</option>
                                <option value="regex">Regex Pattern</option>
                              </select>
                              <select
                                value={rule.action}
                                onChange={(e) => updateRule(rule.id, { action: e.target.value as 'block' | 'flag' | 'sanitize' })}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                              >
                                <option value="flag">Flag (log only)</option>
                                <option value="sanitize">Sanitize (replace)</option>
                                <option value="block">Block (reject)</option>
                              </select>
                            </div>
                            <textarea
                              value={rule.pattern}
                              onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                              placeholder={rule.type === 'regex' ? '/pattern/i' : 'keyword1, keyword2, keyword3'}
                              rows={2}
                              className={`w-full rounded border px-2 py-1 font-mono text-xs dark:bg-slate-900 dark:text-slate-100 ${
                                validation.valid
                                  ? 'border-slate-200 dark:border-white/10'
                                  : 'border-rose-300 dark:border-rose-500'
                              }`}
                            />
                            {validation.error && (
                              <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                                <XCircle className="h-3 w-3" />
                                {validation.error}
                              </p>
                            )}
                            {rule.type === 'keyword' && (
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                Separate keywords with commas. Case-insensitive matching.
                              </p>
                            )}
                            {rule.type === 'regex' && (
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                Enter a valid JavaScript regex pattern. Use /pattern/flags format.
                              </p>
                            )}
                            <input
                              value={rule.description || ''}
                              onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                              placeholder="Optional description"
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              {rule.enabled ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-slate-400" />
                              )}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{rule.name}</span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {rule.type}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                                rule.action === 'block'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                  : rule.action === 'sanitize'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                              }`}>
                                {rule.action}
                              </span>
                            </div>
                            <pre className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                              {rule.pattern}
                            </pre>
                            {rule.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">{rule.description}</p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-1">
                        {isEditing ? (
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                          >
                            Done
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                              className="rounded-full border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                              title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                            >
                              {rule.enabled ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(rule.id)}
                              className="rounded-full border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                              title="Edit rule"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeRule(rule.id)}
                              className="rounded-full border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300"
                              title="Delete rule"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

