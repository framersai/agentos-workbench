import { useEffect, useMemo, useState } from "react";
import { X, ArrowLeft, ArrowRight, Users, Workflow, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useSessionStore, type AgencyParticipantDefinition } from "@/state/sessionStore";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";

interface AgencyWizardProps {
  open: boolean;
  onClose: () => void;
}

type StepKey = "basics" | "participants" | "review";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "participants", label: "Seats" },
  { key: "review", label: "Review" }
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function AgencyWizard({ open, onClose }: AgencyWizardProps) {
  const personas = useSessionStore((state) => state.personas);
  const addAgency = useSessionStore((state) => state.addAgency);
  const remotePersonas = useMemo(() => personas.filter((p) => p.source === "remote"), [personas]);
  const fallbackPersonaId = remotePersonas[0]?.id ?? personas[0]?.id ?? "";

  const [step, setStep] = useState<StepKey>("basics");
  const [name, setName] = useState("New Agency");
  const [goal, setGoal] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [participants, setParticipants] = useState<AgencyParticipantDefinition[]>([
    { roleId: "lead", personaId: fallbackPersonaId }
  ]);

  const { data: workflowDefinitions = [], isLoading: workflowsLoading } = useWorkflowDefinitions();

  useEffect(() => {
    if (!workflowId && workflowDefinitions.length > 0) {
      setWorkflowId(workflowDefinitions[0].id);
    }
  }, [workflowDefinitions, workflowId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const workflow = workflowDefinitions.find((definition) => definition.id === workflowId);
    if (!workflow?.roles || workflow.roles.length === 0) {
      return;
    }

    const shouldSeed =
      participants.length === 1 &&
      participants[0]?.roleId === "lead" &&
      (!participants[0]?.personaId || participants[0]?.personaId === fallbackPersonaId);

    if (!shouldSeed) {
      return;
    }

    setParticipants(
      workflow.roles.map((role, index) => ({
        roleId: role.roleId || `seat-${index + 1}`,
        personaId: role.personaId ?? fallbackPersonaId,
        notes: role.description
      }))
    );
  }, [open, workflowDefinitions, workflowId, participants, fallbackPersonaId]);

  useEffect(() => {
    if (!fallbackPersonaId) {
      return;
    }
    setParticipants((prev) =>
      prev.map((participant) =>
        participant.personaId ? participant : { ...participant, personaId: fallbackPersonaId }
      )
    );
  }, [fallbackPersonaId]);

  const currentStepIndex = STEPS.findIndex((item) => item.key === step);
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setStep(STEPS[currentStepIndex + 1].key);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1].key);
    }
  };

  const resetWizard = () => {
    setStep("basics");
    setName("New Agency");
    setGoal("");
    setWorkflowId(workflowDefinitions[0]?.id ?? "");
    setParticipants([{ roleId: "lead", personaId: fallbackPersonaId }]);
  };

  const handleFinish = () => {
    if (!name.trim()) {
      alert("Agency name is required");
      return;
    }

    const cleanedParticipants = participants
      .filter((participant) => participant.roleId.trim().length > 0)
      .map((participant, index) => ({
        roleId: slugify(participant.roleId) || `seat-${index + 1}`,
        personaId: participant.personaId || fallbackPersonaId,
        notes: participant.notes
      }));

    if (cleanedParticipants.length === 0) {
      alert("Add at least one participant");
      return;
    }

    const id = slugify(name) || `agency-${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    addAgency({
      id,
      name: name.trim(),
      goal: goal.trim() || undefined,
      workflowId: workflowId || undefined,
      participants: cleanedParticipants,
      metadata: { createdViaWizard: true },
      createdAt: timestamp,
      updatedAt: timestamp
    });
    onClose();
    resetWizard();
  };

  if (!open) {
    return null;
  }

  const personaOptionsAvailable = personas.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Agency Wizard</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Launch a multi-seat collective</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              resetWizard();
              onClose();
            }}
            className="rounded-full p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close agency wizard"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </header>

        <div className="border-b border-slate-200 px-6 py-3 dark:border-white/10">
          <ol className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            {STEPS.map((item, index) => (
              <li
                key={item.key}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
                  index === currentStepIndex
                    ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:text-sky-200"
                    : index < currentStepIndex
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400 dark:text-emerald-200"
                      : "border-slate-200 text-slate-500 dark:border-white/10"
                }`}
              >
                {item.label}
              </li>
            ))}
          </ol>
        </div>

        <section className="px-6 py-6">
          {step === "basics" && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Agency name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base dark:border-white/10 dark:bg-slate-900"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Mission / Goal
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base dark:border-white/10 dark:bg-slate-900"
                  placeholder="Define what this agency should accomplish in parallel"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Workflow blueprint
                <div className="mt-1 flex items-center gap-3">
                  <Workflow className="h-4 w-4 text-sky-500" />
                  {workflowsLoading ? (
                    <span className="text-xs text-slate-500">Loading workflows...</span>
                  ) : workflowDefinitions.length === 0 ? (
                    <span className="text-xs text-slate-500">No workflows available. Add definitions via backend.</span>
                  ) : (
                    <select
                      value={workflowId}
                      onChange={(event) => setWorkflowId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                    >
                      {workflowDefinitions.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.displayName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>
          )}

          {step === "participants" && (
            <div className="space-y-4">
              {!personaOptionsAvailable ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Add at least one persona before configuring an agency. Use the Personas tab to seed GMIs.
                </p>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Seats</p>
                  <div className="space-y-3">
                    {participants.map((participant, index) => (
                      <div
                        key={`${participant.roleId}-${index}`}
                        className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-sky-500" />
                            <input
                              value={participant.roleId}
                              onChange={(event) =>
                                setParticipants((prev) =>
                                  prev.map((seat, seatIndex) =>
                                    seatIndex === index ? { ...seat, roleId: event.target.value } : seat
                                  )
                                )
                              }
                              placeholder="Role id (e.g. researcher)"
                              className="rounded-lg border border-slate-200 px-3 py-1 text-sm dark:border-white/10 dark:bg-slate-950"
                            />
                          </div>
                          {participants.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setParticipants((prev) => prev.filter((_, seatIndex) => seatIndex !== index))
                              }
                              className="rounded-full p-1 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                              aria-label="Remove seat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Persona
                            <select
                              value={participant.personaId}
                              onChange={(event) =>
                                setParticipants((prev) =>
                                  prev.map((seat, seatIndex) =>
                                    seatIndex === index ? { ...seat, personaId: event.target.value } : seat
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                            >
                              {personas.map((persona) => (
                                <option key={persona.id} value={persona.id}>
                                  {persona.displayName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Notes
                            <input
                              value={participant.notes ?? ""}
                              onChange={(event) =>
                                setParticipants((prev) =>
                                  prev.map((seat, seatIndex) =>
                                    seatIndex === index ? { ...seat, notes: event.target.value } : seat
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                              placeholder="Seat instructions"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setParticipants((prev) => [
                        ...prev,
                        { roleId: `seat-${prev.length + 1}`, personaId: fallbackPersonaId }
                      ])
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add seat
                  </button>
                </>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h3>
                <dl className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.35em] text-slate-500">Name</dt>
                    <dd className="text-slate-900 dark:text-slate-100">{name || "Untitled agency"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.35em] text-slate-500">Workflow</dt>
                    <dd>{workflowDefinitions.find((workflow) => workflow.id === workflowId)?.displayName ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.35em] text-slate-500">Goal</dt>
                    <dd>{goal || "No goal provided"}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Participants</p>
                <ul className="mt-3 space-y-2">
                  {participants.map((participant, index) => {
                    const persona = personas.find((p) => p.id === participant.personaId);
                    return (
                      <li
                        key={`${participant.roleId}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                      >
                        <div>
                          <span className="font-semibold uppercase tracking-[0.25em]">{participant.roleId}</span>
                          <p className="text-xs text-slate-500">{participant.notes || "No instructions"}</p>
                        </div>
                        <span>{persona?.displayName ?? participant.personaId ?? "Unassigned"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white hover:bg-sky-400"
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Launch
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
