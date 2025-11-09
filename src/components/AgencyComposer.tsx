/**
 * @fileoverview AgencyComposer - Multi-agent input form for coordinated workflows
 * @description Provides two input modes:
 * 1. Multi-field mode: Add agents with specific roles, personas, and instructions
 * 2. Markdown mode: Natural language delegation with role prefixes [Agent] task description
 * 
 * **Architecture:**
 * - Each role creates a separate GMI instance
 * - GMIs execute tasks in parallel via WorkflowRuntime's ConcurrencyQueue
 * - AGENCY_UPDATE chunks show seat coordination in real-time
 * - Final outputs are consolidated into structured formats (CSV, JSON, markdown)
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, Users, Hash, Sparkles, Code } from 'lucide-react';
import { useSessionStore } from '@/state/sessionStore';

/** Single agent role configuration for the agency */
interface AgentRoleConfig {
  id: string;
  roleId: string;
  personaId: string;
  instruction: string;
  priority: number;
}

interface AgencyComposerProps {
  onSubmit: (payload: {
    goal: string;
    roles: AgentRoleConfig[];
    format: 'structured' | 'markdown';
    markdownInput?: string;
    outputFormat?: 'json' | 'csv' | 'markdown' | 'text';
  }) => void;
  disabled?: boolean;
}

/** Example markdown agency inputs with increasing complexity */
const MARKDOWN_EXAMPLES = [
  `[Mathematician] Calculate fibonacci(30) and analyze time complexity
[Teacher] Explain the result to a beginner`,

  `[Researcher] List top 5 TypeScript 5.6 features with code examples
[Analyst] Identify breaking changes
[Writer] Create migration guide in markdown`,

  `[Architect] Design schema for multi-tenant SaaS: users, orgs, roles, permissions
[Security] Identify authorization risks and propose solutions
[Developer] Write SQL DDL with proper indexes
[QA] Create test data and validation queries`,

  `[Monitor] Analyze these error logs: {"errors": [{"type": "timeout", "count": 45}, {"type": "5xx", "count": 12}]}
[Debugger] Identify root causes and suggest fixes
[Optimizer] Propose caching strategy to reduce failures
[Writer] Create incident report in markdown with action items`,

  `[DataAnalyst] Parse CSV: "name,score\\nAlice,92\\nBob,87\\nCarol,95"
[Statistician] Calculate mean, median, std deviation
[Visualizer] Create ASCII bar chart of results
[Reporter] Write summary with insights in markdown`
];

export function AgencyComposer({ onSubmit, disabled = false }: AgencyComposerProps) {
  const [mode, setMode] = useState<'structured' | 'markdown'>('markdown');
  const [goal, setGoal] = useState('Multi-agent coordination');
  const [roles, setRoles] = useState<AgentRoleConfig[]>([]);
  const [markdownInput, setMarkdownInput] = useState(MARKDOWN_EXAMPLES[0]);
  const [currentExample, setCurrentExample] = useState(0);
  const [outputFormat, setOutputFormat] = useState<'json' | 'csv' | 'markdown' | 'text'>('markdown');
  
  const personas = useSessionStore((state) => state.personas);
  const remotePersonas = useMemo(() => personas.filter((p) => p.source === 'remote'), [personas]);

  const addRole = () => {
    const nextPriority = roles.length + 1;
    const defaultPersona = remotePersonas[roles.length % remotePersonas.length] || personas[0];
    
    setRoles([
      ...roles,
      {
        id: crypto.randomUUID(),
        roleId: `agent_${nextPriority}`,
        personaId: defaultPersona?.id || 'v_researcher',
        instruction: '',
        priority: nextPriority,
      },
    ]);
  };

  const updateRole = (id: string, field: keyof AgentRoleConfig, value: string | number) => {
    setRoles(roles.map((role) => (role.id === id ? { ...role, [field]: value } : role)));
  };

  const removeRole = (id: string) => {
    setRoles(roles.filter((role) => role.id !== id));
  };

  const rotateExample = () => {
    const next = (currentExample + 1) % MARKDOWN_EXAMPLES.length;
    setCurrentExample(next);
    setMarkdownInput(MARKDOWN_EXAMPLES[next]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'markdown') {
      // Parse markdown input to extract roles
      const lines = markdownInput.split('\n').filter(l => l.trim());
      const parsedRoles: AgentRoleConfig[] = [];
      
      for (const line of lines) {
        const match = line.match(/^\[([^\]]+)\]\s*(.+)$/);
        if (match) {
          const roleId = match[1].trim().toLowerCase().replace(/\s+/g, '_');
          const instruction = match[2].trim();
          const personaId = remotePersonas[parsedRoles.length % remotePersonas.length]?.id || 'v_researcher';
          
          parsedRoles.push({
            id: crypto.randomUUID(),
            roleId,
            personaId,
            instruction,
            priority: parsedRoles.length + 1,
          });
        }
      }
      
      onSubmit({
        goal,
        roles: parsedRoles,
        format: 'markdown',
        markdownInput,
        outputFormat,
      });
    } else {
      onSubmit({
        goal,
        roles,
        format: 'structured',
        outputFormat,
      });
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Agency Composer</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Multi-GMI Coordination</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'structured' ? 'markdown' : 'structured')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            {mode === 'structured' ? <Code className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
            {mode === 'structured' ? 'Switch to Markdown' : 'Switch to Structured'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shared goal field */}
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Agency Goal</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
            placeholder="Coordinate parallel analysis and synthesis"
          />
        </label>

        {mode === 'markdown' ? (
          // Markdown mode: natural language delegation
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Agent Delegation (Markdown)
              </span>
              <button
                type="button"
                onClick={rotateExample}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <Sparkles className="h-3 w-3" />
                Next Example ({currentExample + 1}/{MARKDOWN_EXAMPLES.length})
              </button>
            </div>
            <textarea
              value={markdownInput}
              onChange={(e) => setMarkdownInput(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
              placeholder="[Researcher] List sorting algorithms with O(n)&#10;[Coder] Implement quicksort in TypeScript&#10;[Tester] Write test cases"
            />
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Use <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">[RoleName] task description</code> format. Each line creates a separate GMI agent.
            </p>
          </div>
        ) : (
          // Structured mode: explicit role configuration
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Agent Roles ({roles.length})
              </span>
              <button
                type="button"
                onClick={addRole}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/20 dark:text-slate-300"
              >
                <Plus className="h-3 w-3" />
                Add Role
              </button>
            </div>

            {roles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-500">
                Add agent roles to coordinate parallel execution
              </div>
            ) : (
              <div className="space-y-2">
                {roles.map((role, index) => (
                  <div
                    key={role.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Agent {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRole(role.id)}
                        className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={role.roleId}
                        onChange={(e) => updateRole(role.id, 'roleId', e.target.value)}
                        placeholder="researcher"
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
                      />
                      <select
                        value={role.personaId}
                        onChange={(e) => updateRole(role.id, 'personaId', e.target.value)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
                      >
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={role.instruction}
                      onChange={(e) => updateRole(role.id, 'instruction', e.target.value)}
                      rows={2}
                      placeholder="Specific task for this agent..."
                      className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Output Format Selection */}
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Output Format
          </span>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as 'json' | 'csv' | 'markdown' | 'text')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
          >
            <option value="markdown">Markdown (default)</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="text">Plain Text</option>
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Requested format for consolidated agency output. Agents will format their responses accordingly.
          </p>
        </label>

        <button
          type="submit"
          disabled={disabled || (mode === 'markdown' ? !markdownInput.trim() : roles.length === 0)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Users className="h-4 w-4" />
          Start Agency Workflow
        </button>
      </form>
    </div>
  );
}

