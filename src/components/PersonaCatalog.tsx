import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { clsx } from "clsx";
import { PlusCircle, Sparkles, Trash2 } from "lucide-react";
import { useSessionStore, type PersonaDefinition } from "@/state/sessionStore";
import { usePersonas } from "@/hooks/usePersonas";

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
  const personasQuery = usePersonas({ filters: personaFilters });
  const [draft, setDraft] = useState<PersonaDraft>(defaultDraft);

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

  const isLoading = personasQuery.isLoading || personasQuery.isFetching;
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
    setDraft(defaultDraft);
  };

  return (
    <section className="rounded-3xl border border-slate-200/60 bg-white/80 p-5 transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Persona catalog</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Define new AI characters</h3>
        </div>
        <div className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-slate-700/40 dark:bg-slate-900/80 dark:text-slate-300">
          {isLoading ? "Loading…" : `${totalPersonas} personas`}
        </div>
      </header>

      <div className="mb-4 space-y-3">
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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {capabilityOptions.map((capability) => {
              const active = personaFilters.capabilities.includes(capability);
              return (
                <button
                  key={capability}
                  type="button"
                  onClick={() => toggleCapability(capability)}
                  className={clsx(
                    "rounded-full border px-3 py-1 font-semibold uppercase tracking-[0.3em] transition",
                    active
                      ? "border-sky-400 bg-sky-500/10 text-sky-600 dark:border-sky-500 dark:text-sky-200"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                  )}
                >
                  {capability}
                </button>
              );
            })}
            {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <ul className="space-y-2 text-sm text-slate-200">
          {visiblePersonas.map((persona) => (
            <li key={persona.id} className="flex items-start justify-between rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{persona.displayName}</p>
                {persona.description && <p className="text-xs text-slate-400">{persona.description}</p>}
                {persona.tags && persona.tags.length > 0 && (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-slate-500">{persona.tags.join(", ")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => persona.id !== primaryPersona && removePersona(persona.id)}
                className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:text-rose-300 disabled:opacity-30"
                title="Remove persona"
                disabled={persona.id === primaryPersona}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
          {personas.length > visiblePersonas.length && (
            <li className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-xs text-slate-500">
              {personas.length - visiblePersonas.length} more personas in store
            </li>
          )}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Create persona</p>
            <Sparkles className="h-3 w-3 text-sky-400" />
          </div>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Display name</span>
            <input
              value={draft.displayName}
              onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="Aurora QA Specialist"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Purpose / description</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="Monitors telemetry and flags regressions before launches."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Tags</span>
              <input
                value={draft.tags}
                onChange={(event) => setDraft((prev) => ({ ...prev, tags: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                placeholder="ops, qa"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Traits</span>
              <input
                value={draft.traits}
                onChange={(event) => setDraft((prev) => ({ ...prev, traits: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
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

