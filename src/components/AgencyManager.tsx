import { FormEvent, useMemo, useState, useEffect } from "react";
import { Circle, Plus, Trash2, Users, RefreshCcw } from "lucide-react";
import { useSessionStore } from "@/state/sessionStore";
import type { AgentOSAgencyUpdateChunk } from "@/types/agentos";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import type { WorkflowDefinition } from "@/types/workflow";

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

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { roleId: "lead", personaId: personas[0]?.id ?? "" }
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

    const basePersonaId = personas[0]?.id ?? "";
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
    setParticipants((prev) => [...prev, { roleId: "", personaId: personas[0]?.id ?? "" }]);
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
    <section className="rounded-3xl border border-white/5 bg-slate-900/60 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Agency manager</p>
          <h3 className="text-lg font-semibold text-slate-100">Coordinate multi-seat collectives</h3>
        </div>
        <div className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
          {agencies.length} agencies
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-3">
          {agencies.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
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
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => setActiveAgency(agency.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    activeAgencyId === agency.id ? "border-sky-500/60 bg-sky-500/10" : "border-white/10 bg-slate-950/50 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-[0.3em] text-sky-300">
                      <Users className="h-3 w-3" /> {agency.name}
                    </span>
                    {snapshot ? <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Live</span> : null}
                  </div>
                  {agency.goal && <p className="mt-2 text-sm text-slate-200">{agency.goal}</p>}
                  <div className="mt-3 space-y-2">
                    {seats.length === 0 ? (
                      <p className="text-xs text-slate-500">No seats configured yet.</p>
                    ) : (
                      seats.map((seat) => (
                        <div key={seat.roleId} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                          <span className="font-semibold uppercase tracking-[0.35em] text-slate-400">{seat.roleId}</span>
                          <span className="text-slate-100">{seat.personaId}</span>
                          <span className="text-[10px] text-slate-500">{seat.gmiInstanceId}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                    <span>{agency.workflowId ?? "No workflow"}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAgency(agency.id);
                      }}
                      className="inline-flex items-center gap-1 text-rose-300 transition hover:text-rose-200"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">New agency</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {workflowsError && <span className="text-rose-300">Workflow fetch failed.</span>}
              <button
                type="button"
                onClick={() => refetchWorkflows()}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.35em] text-slate-400 transition hover:border-white/30"
              >
                <RefreshCcw className="h-3 w-3" /> Refresh
              </button>
            </div>
            <Circle className="hidden h-3 w-3 text-slate-500 md:block" />
          </div>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Agency name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="Mission Automation Crew"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Shared goal</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="Coordinate the release-readiness workflow and keep telemetry fresh."
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Workflow definition</span>
            <select
              value={workflowId}
              onChange={(event) => setWorkflowId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              <option value="">{workflowsLoading ? "Loading workflows…" : "Unassigned"}</option>
              {workflowDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.displayName}
                </option>
              ))}
            </select>
            {selectedWorkflow?.description && (
              <p className="text-xs text-slate-500">{selectedWorkflow.description}</p>
            )}
          </label>

          {workflowRoleHints.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
              <p className="mb-2 font-semibold uppercase tracking-[0.35em] text-slate-400">Workflow roles</p>
              <ul className="space-y-1">
                {workflowRoleHints.map((role) => (
                  <li key={role.roleId} className="flex items-center justify-between">
                    <span>{role.displayName || role.roleId}</span>
                    {role.personaId && <span className="text-slate-500">Persona: {role.personaId}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Seat assignments</p>
            {participants.map((participant, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 sm:flex-row sm:items-center">
                <input
                  value={participant.roleId}
                  onChange={(event) => handleParticipantChange(index, "roleId", event.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="planner"
                />
                <select
                  value={participant.personaId}
                  onChange={(event) => handleParticipantChange(index, "personaId", event.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
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
                  className="self-start rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-rose-300"
                  title="Remove seat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddParticipant}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400 transition hover:border-white/40"
            >
              <Plus className="h-3 w-3" /> Add seat
            </button>
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5"
          >
            <Users className="h-4 w-4" /> Launch agency
          </button>
        </form>
      </div>
    </section>
  );
}


