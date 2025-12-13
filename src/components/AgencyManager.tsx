import { FormEvent, useMemo, useState, useEffect } from "react";
import { Plus, Trash2, Users, RefreshCcw, Sparkles, History } from "lucide-react";
import { useSessionStore } from "@/state/sessionStore";
import type { AgentOSAgencyUpdateChunk } from "@/types/agentos";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import type { WorkflowDefinition } from "@/types/workflow";
import { AgencyWizard } from "./AgencyWizard";
import { AgencyHistoryView } from "./AgencyHistoryView";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

interface ParticipantDraft {
  roleId: string;
  personaId: string;
}

export function AgencyManager() {
  const agencies = useSessionStore((state) => state.agencies);
  const personas = useSessionStore((state) => state.personas);
  const agencySessions = useSessionStore((state) => state.agencySessions);
  const activeAgencyId = useSessionStore((state) => state.activeAgencyId);
  const addAgency = useSessionStore((state) => state.addAgency);
  const removeAgency = useSessionStore((state) => state.removeAgency);
  const setActiveAgency = useSessionStore((state) => state.setActiveAgency);
  // Use a mock user ID for now - in production, get from auth context
  const currentUserId = 'workbench-user';
  const [showWizard, setShowWizard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Generate unique default agency name
  const generateDefaultName = () => {
    const base = 'New Agency';
    const existing = agencies.filter(a => a.name.startsWith(base));
    return existing.length === 0 ? base : `${base} ${existing.length + 1}`;
  };
  const [name, setName] = useState(generateDefaultName());
  const [goal, setGoal] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const remotePersonas = useMemo(() => personas.filter((p) => p.source === "remote"), [personas]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { roleId: "lead", personaId: remotePersonas[0]?.id ?? "" }
  ]);

  const {
    data: workflowDefinitions = [],
    isLoading: workflowsLoading,
    refetch: refetchWorkflows,
    error: workflowsError
  } = useWorkflowDefinitions();

  const selectedWorkflow = useMemo<WorkflowDefinition | null>(
    () => workflowDefinitions.find((definition) => definition.id === workflowId) ?? null,
    [workflowDefinitions, workflowId]
  );

  useEffect(() => {
    if (!workflowId && workflowDefinitions.length > 0) {
      setWorkflowId(workflowDefinitions[0].id);
    }
  }, [workflowDefinitions, workflowId]);

  useEffect(() => {
    if (!selectedWorkflow) {
      return;
    }

    const basePersonaId = remotePersonas[0]?.id ?? "";
    const shouldSeedParticipants =
      participants.length <= 1 &&
      participants[0]?.roleId === "lead" &&
      (!participants[0]?.personaId || participants[0]?.personaId === basePersonaId);

    if (shouldSeedParticipants && selectedWorkflow.roles && selectedWorkflow.roles.length > 0) {
      setParticipants(
        selectedWorkflow.roles.map((role) => ({
          roleId: role.roleId,
          personaId: role.personaId ?? ""
        }))
      );
    }

    if (!goal && selectedWorkflow.description) {
      setGoal(selectedWorkflow.description);
    }
  }, [goal, participants, personas, selectedWorkflow]);

  useEffect(() => {
    const handler = () => setShowWizard(true);
    window.addEventListener("agentos:open-agency-wizard", handler as EventListener);
    return () => window.removeEventListener("agentos:open-agency-wizard", handler as EventListener);
  }, []);

  const handleParticipantChange = (index: number, field: keyof ParticipantDraft, value: string) => {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddParticipant = () => {
    setParticipants((prev) => [...prev, { roleId: "", personaId: remotePersonas[0]?.id ?? "" }]);
  };

  const seedWorkflowMetadata = (existing?: Record<string, unknown>) => {
    if (!selectedWorkflow) {
      return existing;
    }
    return {
      ...existing,
      workflowDefinitionId: selectedWorkflow.id,
      workflowDisplayName: selectedWorkflow.displayName
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const id = slugify(name) || `agency-${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    const cleanedParticipants = participants
      .filter((participant) => participant.roleId.trim().length > 0)
      .map((participant, index) => ({
        roleId: slugify(participant.roleId) || `seat-${index + 1}`,
        personaId: participant.personaId || undefined
      }));

    addAgency({
      id,
      name: name.trim(),
      goal: goal.trim() || undefined,
      workflowId: workflowId.trim() || undefined,
      participants: cleanedParticipants,
      metadata: seedWorkflowMetadata(goal ? { goal } : undefined),
      createdAt: timestamp,
      updatedAt: timestamp
    });

    setActiveAgency(id);
    setName("");
    setGoal("");
    setWorkflowId(workflowDefinitions[0]?.id ?? "");
    setParticipants([{ roleId: "lead", personaId: personas[0]?.id ?? "" }]);
  };

  const workflowRoleHints = selectedWorkflow?.roles ?? [];
  
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <section className="flex-1 flex flex-col rounded-xl border theme-border theme-bg-secondary-soft p-3 overflow-y-auto transition-theme" data-tour="agency-manager">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] theme-text-muted">Agency manager</p>
          <h3 className="text-base font-semibold theme-text-primary">Coordinate collectives</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-full border theme-border px-2 py-0.5 text-[10px] theme-text-secondary">
            {agencies.length}
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-1 rounded-full border theme-border px-2 py-0.5 text-[10px] font-semibold theme-text-secondary transition hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <History className="h-3 w-3 text-purple-500" />
            History
          </button>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1 rounded-full border theme-border px-2 py-0.5 text-[10px] font-semibold theme-text-secondary transition hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <Sparkles className="h-3 w-3 text-sky-500" />
            Wizard
          </button>
        </div>
      </header>

      <div className="space-y-3">
        <div className="space-y-2">
          {agencies.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
              Create an agency to assign personas into workflow roles and watch seats update in real time.
            </p>
          ) : (
            agencies.map((agency) => {
              const snapshot = agencySessions[agency.id];
              const seats: AgentOSAgencyUpdateChunk["agency"]["seats"] =
                snapshot?.seats ??
                agency.participants.map((participant) => ({
                  roleId: participant.roleId,
                  personaId: participant.personaId ?? "unassigned",
                  gmiInstanceId: "pending",
                  metadata: participant.personaId ? { requestedPersonaId: participant.personaId } : undefined
                }));
              return (
                <div
                  key={agency.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveAgency(agency.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveAgency(agency.id);
                    }
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    activeAgencyId === agency.id ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20" : "theme-border theme-bg-secondary hover:opacity-95"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] theme-text-secondary">
                    <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">
                      <Users className="h-2.5 w-2.5" /> {agency.name}
                    </span>
                    {snapshot ? <span className="text-[9px] uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-300">Live</span> : null}
                  </div>
                  {agency.goal && <p className="mt-1 text-xs theme-text-primary line-clamp-2">{agency.goal}</p>}
                  <div className="mt-2 space-y-1.5">
                    {seats.length === 0 ? (
                      <p className="text-[10px] theme-text-muted">No seats configured.</p>
                    ) : (
                      seats.map((seat) => (
                        <div key={seat.roleId} className="flex items-center justify-between rounded-lg border theme-border theme-bg-primary px-2 py-1 text-[10px] theme-text-secondary">
                          <span className="font-semibold uppercase tracking-[0.35em] theme-text-muted">{seat.roleId}</span>
                          <span className="theme-text-primary truncate max-w-[100px]">{seat.personaId}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] theme-text-muted">
                    <span>{agency.workflowId ?? "No workflow"}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const ok = window.confirm(`Remove agency "${agency.name}"?`);
                        if (ok) removeAgency(agency.id);
                      }}
                      className="inline-flex items-center gap-0.5 text-rose-700 transition hover:text-rose-500 dark:text-rose-300 dark:hover:text-rose-200"
                    >
                      <Trash2 className="h-2.5 w-2.5" /> Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border theme-border theme-bg-secondary p-3 text-xs theme-text-secondary">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">New agency</p>
            <div className="flex items-center gap-1 text-[10px] theme-text-muted">
              {workflowsError && <span className="text-rose-300">Fetch failed.</span>}
              <button
                type="button"
                onClick={() => refetchWorkflows()}
                className="inline-flex items-center gap-0.5 rounded-full border theme-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.35em] transition hover:opacity-95"
              >
                <RefreshCcw className="h-2.5 w-2.5" /> Refresh
              </button>
            </div>
          </div>
          <label className="space-y-0.5 block">
            <span className="text-[10px] theme-text-muted">Agency name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
              placeholder="Mission Automation Crew"
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-[10px] theme-text-muted">Shared goal</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={2}
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
              placeholder="Coordinate the release-readiness workflow..."
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-[10px] theme-text-muted">Workflow definition</span>
            <select
              value={workflowId}
              onChange={(event) => setWorkflowId(event.target.value)}
              className="w-full rounded-md border theme-border theme-bg-primary px-2 py-1.5 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
            >
              <option value="">{workflowsLoading ? "Loading..." : "Unassigned"}</option>
              {workflowDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.displayName}
                </option>
              ))}
            </select>
          </label>

          {workflowRoleHints.length > 0 && (
            <div className="rounded-lg border theme-border theme-bg-primary p-2 text-[10px] theme-text-muted">
              <p className="mb-1 font-semibold uppercase tracking-[0.35em]">Workflow roles</p>
              <ul className="space-y-0.5">
                {workflowRoleHints.map((role) => (
                  <li key={role.roleId} className="flex items-center justify-between">
                    <span>{role.displayName || role.roleId}</span>
                    {role.personaId && <span className="text-slate-500">Persona: {role.personaId}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.35em] theme-text-muted">Seat assignments</p>
            {participants.map((participant, index) => (
              <div key={index} className="flex flex-col gap-1 rounded-lg border theme-border theme-bg-primary p-2 sm:flex-row sm:items-center">
                <input
                  value={participant.roleId}
                  onChange={(event) => handleParticipantChange(index, "roleId", event.target.value)}
                  className="flex-1 rounded border theme-border theme-bg-secondary px-2 py-1 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                  placeholder="planner"
                />
                <select
                  value={participant.personaId}
                  onChange={(event) => handleParticipantChange(index, "personaId", event.target.value)}
                  className="flex-1 rounded border theme-border theme-bg-secondary px-2 py-1 text-xs theme-text-primary focus:border-sky-500 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.displayName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(index)}
                  className="self-start rounded-full border theme-border p-1 text-slate-500 transition hover:bg-slate-50 dark:hover:text-rose-300"
                  title="Remove seat"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddParticipant}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] theme-text-muted transition hover:opacity-95"
            >
              <Plus className="h-2.5 w-2.5" /> Add seat
            </button>
          </div>
          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full theme-bg-success px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5"
          >
            <Users className="h-3.5 w-3.5" /> Launch agency
          </button>
        </form>
      </div>
      </section>

      {/* Agency History Panel */}
      {showHistory && (
        <section className="rounded-xl border theme-border theme-bg-secondary-soft p-3">
          <AgencyHistoryView userId={currentUserId} />
        </section>
      )}

      <AgencyWizard open={showWizard} onClose={() => setShowWizard(false)} />
    </div>
  );
}


