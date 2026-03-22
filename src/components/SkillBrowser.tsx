/**
 * SkillBrowser — top-level container for browsing and managing AgentOS skills.
 *
 * Manages:
 *  - Fetching the skill catalogue from the backend on mount.
 *  - Search (by name, description, or tag) and category filter state.
 *  - Optimistic enable / disable toggling (local state updated immediately,
 *    then synced to backend).
 *  - Navigation between the card grid and the single-skill detail view.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getSkills,
  getSkillDetail,
  enableSkill,
  disableSkill,
  type SkillInfo,
  type SkillDetail,
} from '../lib/agentosClient';
import { SkillCard } from './SkillCard';
import { SkillDetail as SkillDetailView } from './SkillDetail';

/**
 * SkillBrowser renders either:
 * - A searchable, filterable grid of {@link SkillCard}s, or
 * - A full {@link SkillDetailView} for the selected skill.
 *
 * State is kept local to this component; toggle calls optimistically update
 * the skill list before awaiting the backend response so the UI feels instant.
 *
 * @example
 * ```tsx
 * // Drop into any tab/panel that wants a skill management UI
 * <SkillBrowser />
 * ```
 */
export function SkillBrowser() {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** Full catalogue loaded from the backend. */
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  /** Whether the initial fetch is in flight. */
  const [loading, setLoading] = useState(true);
  /** Free-text filter applied to name, description, and tags. */
  const [search, setSearch] = useState('');
  /** Category filter — empty string means "all". */
  const [categoryFilter, setCategoryFilter] = useState('');
  /** Slug of the skill currently shown in the detail view, or null for grid. */
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  /** Fully-loaded skill detail (fetched on demand). */
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  /** Whether the detail fetch is in flight. */
  const [detailLoading, setDetailLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  /** Load the full skill catalogue from the backend. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getSkills();
      if (!cancelled) {
        setSkills(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * When `selectedSkillName` changes, fetch the detailed skill record (which
   * includes the rendered SKILL.md content).
   */
  useEffect(() => {
    if (!selectedSkillName) {
      setSkillDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      const detail = await getSkillDetail(selectedSkillName);
      if (!cancelled) {
        setSkillDetail(detail);
        setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSkillName]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Toggle a skill on or off.  Optimistically updates local state first, then
   * syncs to the backend so the toggle feels instantaneous.
   *
   * @param name    - Skill slug.
   * @param enabled - New desired state.
   */
  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    // Optimistic update — flip the local skill list immediately.
    setSkills((prev) =>
      prev.map((s) => (s.name === name ? { ...s, enabled } : s))
    );
    // Also keep the detail view in sync if it's open for this skill.
    setSkillDetail((prev) =>
      prev && prev.name === name ? { ...prev, enabled } : prev
    );
    // Sync with backend (fire-and-forget; errors silently ignored for now).
    if (enabled) {
      await enableSkill(name);
    } else {
      await disableSkill(name);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  /** Skills filtered by the current search text and category selector. */
  const filteredSkills = skills.filter((skill) => {
    if (categoryFilter && skill.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = skills.filter((s) => s.enabled).length;
  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...Array.from(new Set(skills.map((skill) => skill.category)))
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      })),
  ];

  // -------------------------------------------------------------------------
  // Render — detail view
  // -------------------------------------------------------------------------

  if (selectedSkillName) {
    return (
      <div className="min-h-[200px]">
        {detailLoading || !skillDetail ? (
          skillDetail === null && !detailLoading ? (
            <div className="space-y-3 py-6">
              <p className="text-xs theme-text-muted">This skill could not be loaded.</p>
              <button
                type="button"
                onClick={() => setSelectedSkillName(null)}
                className="rounded-full border theme-border px-3 py-1 text-xs theme-text-secondary"
              >
                Back to skills
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 text-xs theme-text-muted">
              <span className="animate-spin inline-block h-3 w-3 rounded-full border border-t-sky-400" />
              Loading skill…
            </div>
          )
        ) : (
          <SkillDetailView
            skill={skillDetail}
            onClose={() => setSelectedSkillName(null)}
            onToggle={handleToggle}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — card grid
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar: search + category filter + active count                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search input */}
        <input
          type="search"
          placeholder="Search skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={[
            'flex-1 rounded-md border theme-border theme-bg-primary',
            'px-2.5 py-1.5 text-xs theme-text-primary',
            'focus:border-sky-500 focus:outline-none',
          ].join(' ')}
          aria-label="Search skills"
        />

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={[
            'rounded-md border theme-border theme-bg-primary',
            'px-2.5 py-1.5 text-xs theme-text-secondary',
            'focus:border-sky-500 focus:outline-none',
          ].join(' ')}
          aria-label="Filter by category"
        >
          {categoryOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Active count */}
        {!loading && (
          <span className="shrink-0 text-[10px] theme-text-muted whitespace-nowrap">
            {activeCount} of {skills.length} active
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Skill grid / loading / empty state                                 */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-xs theme-text-muted">
          <span className="animate-spin inline-block h-3 w-3 rounded-full border border-t-sky-400" />
          Loading skills…
        </div>
      ) : filteredSkills.length === 0 ? (
        <p className="py-6 text-center text-xs theme-text-muted">
          No skills match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onToggle={handleToggle}
              onSelect={setSelectedSkillName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
