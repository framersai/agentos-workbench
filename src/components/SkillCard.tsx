/**
 * SkillCard — compact grid tile representing a single AgentOS skill.
 *
 * Renders the skill's emoji, name, category badge, truncated description,
 * required-tool pills, an env-var readiness indicator, and a toggle switch.
 * Clicking anywhere on the card (except the toggle) fires `onSelect`.
 */

import type { SkillInfo } from '../lib/agentosClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props accepted by {@link SkillCard}. */
interface SkillCardProps {
  /** The skill to display. */
  skill: SkillInfo;
  /**
   * Called when the toggle switch is clicked.
   * @param name    - Skill slug.
   * @param enabled - The new desired state.
   */
  onToggle: (name: string, enabled: boolean) => void;
  /**
   * Called when the card body is clicked (not the toggle).
   * @param name - Skill slug to expand in the detail view.
   */
  onSelect: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Category colour map
// ---------------------------------------------------------------------------

/**
 * Maps a skill category string to a pair of Tailwind colour classes used
 * for the small category pill badge.
 */
const CATEGORY_COLOURS: Record<string, string> = {
  information: 'bg-sky-500/20 text-sky-400',
  communication:'bg-amber-500/20 text-amber-300',
  content:     'bg-orange-500/20 text-orange-300',
  creative:    'bg-pink-500/20 text-pink-300',
  'developer-tools': 'bg-violet-500/20 text-violet-400',
  devops:      'bg-cyan-500/20 text-cyan-300',
  infrastructure: 'bg-cyan-500/20 text-cyan-300',
  research:    'bg-indigo-500/20 text-indigo-300',
  security:    'bg-rose-500/20 text-rose-400',
  productivity:'bg-emerald-500/20 text-emerald-300',
  marketing:   'bg-lime-500/20 text-lime-300',
  automation:  'bg-teal-500/20 text-teal-300',
  'social-automation': 'bg-green-500/20 text-green-400',
  media:       'bg-pink-500/20 text-pink-400',
};

/** Fallback colour for unknown categories. */
const DEFAULT_CATEGORY_COLOUR = 'bg-white/10 text-white/60';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact card displayed in the skills browser grid.
 *
 * Layout (top to bottom):
 *  1. Emoji + name row
 *  2. Category badge
 *  3. Description (line-clamp-2)
 *  4. Required tool pills
 *  5. Footer row — env-var dot + toggle switch
 *
 * @example
 * ```tsx
 * <SkillCard
 *   skill={skill}
 *   onToggle={(name, enabled) => handleToggle(name, enabled)}
 *   onSelect={(name) => setSelected(name)}
 * />
 * ```
 */
export function SkillCard({ skill, onToggle, onSelect }: SkillCardProps) {
  const categoryColour =
    CATEGORY_COLOURS[skill.category] ?? DEFAULT_CATEGORY_COLOUR;

  /** Whether an env var indicator is needed and already set (green) or
   *  expected but user must supply it (yellow). */
  const envDot = skill.requiredEnvVars.length === 0
    ? { colour: 'bg-emerald-400', title: 'No external credentials required' }
    : { colour: 'bg-amber-400', title: `Requires env vars: ${skill.requiredEnvVars.join(', ')}` };

  return (
    <div
      className={[
        'group relative flex flex-col gap-2 rounded-xl border p-3 cursor-pointer',
        'theme-border theme-bg-secondary-soft',
        'hover:border-sky-500/50 transition-colors',
      ].join(' ')}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${skill.name}`}
      onClick={() => onSelect(skill.name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(skill.name);
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header: emoji + name                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none" aria-hidden="true">
          {skill.emoji}
        </span>
        <div className="min-w-0">
          <span className="block truncate text-xs font-semibold theme-text-primary">
            {skill.displayName}
          </span>
          <span className="block truncate text-[10px] font-mono theme-text-muted">
            {skill.name}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Category badge                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-1">
        <span
          className={[
            'inline-block self-start rounded-full px-2 py-0.5 text-[10px] font-medium',
            categoryColour,
          ].join(' ')}
        >
          {skill.category}
        </span>
        {skill.verified && (
          <span className="inline-block self-start rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            verified
          </span>
        )}
        <span className="inline-block self-start rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium theme-text-muted">
          {skill.source}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Description                                                         */}
      {/* ------------------------------------------------------------------ */}
      <p className="text-[11px] theme-text-secondary line-clamp-2">
        {skill.description}
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Required tools                                                      */}
      {/* ------------------------------------------------------------------ */}
      {skill.requiresTools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.requiresTools.map((tool) => (
            <span
              key={tool}
              className="rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-mono theme-text-muted"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {skill.requiredBins.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.requiredBins.map((bin) => (
            <span
              key={bin}
              className="rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300"
            >
              {bin}
            </span>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer: env indicator + toggle                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-auto flex items-center justify-between">
        {/* Env var readiness dot */}
        <span
          className="flex items-center gap-1.5 text-[10px] theme-text-muted"
          title={envDot.title}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${envDot.colour}`}
            aria-hidden="true"
          />
          {skill.requiredEnvVars[0] ?? skill.primaryEnv ?? 'no env required'}
        </span>

        {/* Toggle switch — stop propagation so card click doesn't also fire */}
        <button
          type="button"
          role="switch"
          aria-checked={skill.enabled}
          aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(skill.name, !skill.enabled);
          }}
          className={[
            'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2',
            'border-transparent transition-colors focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
            skill.enabled ? 'bg-sky-500' : 'bg-white/15',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm',
              'ring-0 transition-transform',
              skill.enabled ? 'translate-x-3' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}
