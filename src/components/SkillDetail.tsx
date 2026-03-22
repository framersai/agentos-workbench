/**
 * SkillDetail — expanded detail view for a single AgentOS skill.
 *
 * Renders the full SKILL.md content via react-markdown alongside
 * metadata: category, tags, required tools, env var status, and an
 * enable/disable button.
 */

import ReactMarkdown from 'react-markdown';
import type { SkillDetail as SkillDetailType } from '../lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props accepted by {@link SkillDetail}. */
interface SkillDetailProps {
  /** The fully-loaded skill including markdown content. */
  skill: SkillDetailType;
  /** Called when the user clicks "← Back to skills". */
  onClose: () => void;
  /**
   * Called when the enable/disable button is clicked.
   * @param name    - Skill slug.
   * @param enabled - The new desired state.
   */
  onToggle: (name: string, enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-width detail panel shown when a skill card is selected.
 *
 * Layout:
 *  1. Back button
 *  2. Emoji + name heading
 *  3. Category + tags row
 *  4. Enable / disable action button
 *  5. Required tools list
 *  6. Primary env var status
 *  7. SKILL.md rendered via react-markdown
 *
 * @example
 * ```tsx
 * <SkillDetail
 *   skill={detail}
 *   onClose={() => setSelected(null)}
 *   onToggle={(name, enabled) => handleToggle(name, enabled)}
 * />
 * ```
 */
export function SkillDetail({ skill, onClose, onToggle }: SkillDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Back navigation                                                     */}
      {/* ------------------------------------------------------------------ */}
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1.5 text-xs theme-text-muted hover:theme-text-primary transition-colors w-fit"
      >
        <span aria-hidden="true">←</span>
        Back to skills
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Heading row                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden="true">
          {skill.emoji}
        </span>
        <div>
          <h2 className="text-base font-semibold theme-text-primary">{skill.displayName}</h2>
          <p className="text-[11px] font-mono theme-text-muted">{skill.name}</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Category + tags                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-400">
          {skill.category}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] theme-text-muted">
          {skill.source}
        </span>
        {skill.verified && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
            verified
          </span>
        )}
        {skill.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] theme-text-muted"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Enable / disable button                                             */}
      {/* ------------------------------------------------------------------ */}
      <button
        type="button"
        onClick={() => onToggle(skill.name, !skill.enabled)}
        className={[
          'self-start rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
          skill.enabled
            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
            : 'bg-sky-500 text-white hover:bg-sky-400',
        ].join(' ')}
      >
        {skill.enabled ? 'Disable skill' : 'Enable skill'}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Required tools                                                      */}
      {/* ------------------------------------------------------------------ */}
      {skill.requiresTools.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
            Required tools
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skill.requiresTools.map((tool) => (
              <span
                key={tool}
                className="rounded-sm bg-white/5 px-2 py-1 text-[11px] font-mono theme-text-secondary"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Primary env var                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
          Environment
        </p>
        {skill.requiredEnvVars.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skill.requiredEnvVars.map((envVar) => (
              <span key={envVar} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-amber-400"
                  aria-hidden="true"
                  title="Env var required"
                />
                <code className="font-mono text-amber-300">{envVar}</code>
              </span>
            ))}
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-xs theme-text-secondary">
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-400"
              aria-hidden="true"
              title="No credentials needed"
            />
            No external credentials required
          </span>
        )}
      </div>

      {skill.requiredSecrets.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
            Required secrets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skill.requiredSecrets.map((secretId) => (
              <span
                key={secretId}
                className="rounded-sm bg-white/5 px-2 py-1 text-[11px] font-mono theme-text-secondary"
              >
                {secretId}
              </span>
            ))}
          </div>
        </div>
      )}

      {skill.requiredBins.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.35em] theme-text-muted">
            Local prerequisites
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skill.requiredBins.map((bin) => (
              <span
                key={bin}
                className="rounded-sm bg-white/5 px-2 py-1 text-[11px] font-mono text-cyan-300"
              >
                {bin}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SKILL.md content                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-lg border theme-border theme-bg-primary p-3">
        <div className="prose prose-invert prose-sm max-w-none text-xs [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:theme-text-muted [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_li]:theme-text-secondary [&_p]:theme-text-secondary">
          <ReactMarkdown>{skill.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
