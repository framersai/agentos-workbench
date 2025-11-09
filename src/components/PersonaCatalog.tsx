import { ChangeEvent, FormEvent, useMemo, useState, useEffect } from "react";
import { clsx } from "clsx";
import { PlusCircle, Sparkles, Trash2, Wand2, Edit3 } from "lucide-react";
import { useSessionStore, type PersonaDefinition } from "@/state/sessionStore";
import { persistPersonaRow } from "@/lib/storageBridge";
import { PersonaWizard } from "./PersonaWizard";
import { PersonaEditor } from "./PersonaEditor";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function toList(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

interface PersonaDraft {
  displayName: string;
  description: string;
  tags: string;
  traits: string;
}

const defaultDraft: PersonaDraft = {
  displayName: "",
  description: "",
  tags: "",
  traits: ""
};

export function PersonaCatalog() {
  const personas = useSessionStore((state) => state.personas);
  const personaFilters = useSessionStore((state) => state.personaFilters);
  const setPersonaFilters = useSessionStore((state) => state.setPersonaFilters);
  const addPersona = useSessionStore((state) => state.addPersona);
  const removePersona = useSessionStore((state) => state.removePersona);
  // Don't duplicate the personas query - use from store instead
  const [draft, setDraft] = useState<PersonaDraft>(defaultDraft);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<PersonaDefinition | null>(null);

  // Listen for wizard open event from sidebar
  useEffect(() => {
    const handleOpenWizard = () => setShowWizard(true);
    window.addEventListener('agentos:open-persona-wizard', handleOpenWizard);
    return () => window.removeEventListener('agentos:open-persona-wizard', handleOpenWizard);
  }, []);

  const capabilityOptions = useMemo(() => {
    const set = new Set<string>();
    personas.forEach((persona) => {
      persona.capabilities?.forEach((capability) => set.add(capability));
    });
    personaFilters.capabilities.forEach((capability) => set.add(capability));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [personas, personaFilters.capabilities]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPersonaFilters({ search: event.target.value });
  };

  const toggleCapability = (capability: string) => {
    const next = personaFilters.capabilities.includes(capability)
      ? personaFilters.capabilities.filter((entry) => entry !== capability)
      : [...personaFilters.capabilities, capability];
    setPersonaFilters({ capabilities: next });
  };

  const clearFilters = () => {
    setPersonaFilters({ search: "", capabilities: [] });
  };

  const isLoading = false; // Use store data, no loading state needed
  const filterActive =
    personaFilters.search.trim().length > 0 || personaFilters.capabilities.length > 0;

  const totalPersonas = personas.length;
  const primaryPersona = personas[0]?.id ?? null;
  const visiblePersonas = personas.slice(0, 6);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.displayName.trim()) {
      return;
    }
    const id = slugify(draft.displayName) || `persona-${crypto.randomUUID().slice(0, 8)}`;
    const persona: PersonaDefinition = {
      id,
      displayName: draft.displayName.trim(),
      description: draft.description.trim(),
      tags: toList(draft.tags),
      traits: toList(draft.traits)
    };
    addPersona(persona);
    void persistPersonaRow(persona);
    setDraft(defaultDraft);
  };

  return (
    <section className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Persona catalog</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Define new AI characters</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1 rounded-full border border-sky-500 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-300"
          >
            <Wand2 className="h-3 w-3" />
            Wizard
          </button>
          <div className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-slate-700/40 dark:bg-slate-900/80 dark:text-slate-300">
            {isLoading ? "Loading…" : `${totalPersonas} personas`}
          </div>
        </div>
      </header>
      
      <PersonaWizard open={showWizard} onClose={() => setShowWizard(false)} />
      {editingPersona && <PersonaEditor persona={editingPersona} onClose={() => setEditingPersona(null)} />}
      
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-4 shadow-xl dark:border-rose-900/40 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">Delete persona?</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              This will permanently delete &ldquo;{personas.find(p => p.id === showDeleteModal)?.displayName}&rdquo; from your local storage. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button 
                onClick={() => setShowDeleteModal(null)} 
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  if (showDeleteModal) removePersona(showDeleteModal); 
                  setShowDeleteModal(null); 
                }} 
                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
        This catalog merges server-provided personas (remote, read-only) with ones you create locally (saved in your browser). Deleting removes only local personas. Remote personas refresh from the server.
      </div>

      <div className="mb-4 space-y-3 flex-shrink-0">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
          Search personas
          <input
            value={personaFilters.search}
            onChange={handleSearchChange}
            placeholder="Design lead, operations, QA…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 shadow-sm transition focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        {capabilityOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {capabilityOptions.slice(0, 8).map((capability) => {
              const active = personaFilters.capabilities.includes(capability);
              const label = capability.replace('capability:', '').replace(/_/g, ' ');
              return (
                <button
                  key={capability}
                  type="button"
                  onClick={() => toggleCapability(capability)}
                  className={clsx(
                    "rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition",
                    active
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  )}
                >
                  {label}
                </button>
              );
            })}
            {capabilityOptions.length > 8 && (
              <span className="text-[9px] text-slate-500">+{capabilityOptions.length - 8}</span>
            )}
            {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded bg-rose-100 px-2 py-0.5 text-[9px] font-semibold uppercase text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
        <ul className="grid grid-cols-1 gap-3 text-sm text-slate-700 lg:grid-cols-2 dark:text-slate-200">
          {visiblePersonas.map((persona) => (
            <li key={persona.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/5 dark:bg-slate-950/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{persona.displayName}</p>
                  {persona.description && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{persona.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {persona.source === 'local' && (
                    <button
                      onClick={() => setEditingPersona(persona)}
                      className="rounded-md p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      title="Edit persona"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (persona.id === primaryPersona || persona.source === "remote") return;
                      setShowDeleteModal(persona.id);
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:text-slate-400 dark:hover:text-rose-300"
                    title={persona.source === "remote" ? "Remote personas are server-managed" : "Remove persona"}
                    disabled={persona.id === primaryPersona || persona.source === "remote"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              
              {/* Tags as compact grid */}
              {persona.tags && persona.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {persona.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {tag}
                    </span>
                  ))}
                  {persona.tags.length > 5 && (
                    <span className="text-[9px] text-slate-500">+{persona.tags.length - 5}</span>
                  )}
                </div>
              )}
              
              {/* Capabilities as compact grid */}
              {persona.capabilities && persona.capabilities.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {persona.capabilities.slice(0, 4).map((cap) => (
                    <span key={cap} className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                      {cap.replace('capability:', '')}
                    </span>
                  ))}
                  {persona.capabilities.length > 4 && (
                    <span className="text-[9px] text-slate-500">+{persona.capabilities.length - 4}</span>
                  )}
                </div>
              )}
              
              <div className="mt-2 flex items-center gap-1">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${persona.source === "remote" ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>
                  {persona.source === "remote" ? "Remote" : "Local"}
                </span>
                {persona.id === 'nerf_generalist' && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-200" title="Offline-first">
                    Nerf
                  </span>
                )}
                {persona.id === 'v_researcher' && (
                  <span className="rounded bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-200" title="Full-powered">
                    V
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {personas.length > visiblePersonas.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-center text-xs text-slate-500 dark:border-white/10">
            {personas.length - visiblePersonas.length} more personas in store
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Quick add (basic)</p>
            <Sparkles className="h-3 w-3 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">For full config (system prompt, guardrails, extensions), use the Wizard above.</p>
          <label className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Display name</span>
            <input
              value={draft.displayName}
              onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
              placeholder="Aurora QA Specialist"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Purpose / description</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
              placeholder="Monitors telemetry and flags regressions before launches."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Tags</span>
              <input
                value={draft.tags}
                onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
                placeholder="ops, qa"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Traits</span>
              <input
                value={draft.traits}
                onChange={(event) => setDraft((prev) => ({ ...prev, traits: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
                placeholder="meticulous, proactive"
              />
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            <PlusCircle className="h-4 w-4" /> Add persona
          </button>
        </form>
      </div>
    </section>
  );
}

