import { useMemo, useState } from "react";
import { useSessionStore } from "@/state/sessionStore";
import { useWorkflowDefinitions } from "@/hooks/useWorkflowDefinitions";
import { clsx } from "clsx";
import type { WorkflowDefinition } from "@/types/workflow";
import type { AgentOSWorkflowUpdateChunk } from "@/types/agentos";
import { ArtifactViewer } from "@/components/ArtifactViewer";
import { Activity, Clock, GitBranch } from "lucide-react";

const statusToColor: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  completed: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  pending: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  awaiting_input: "bg-blue-500/10 text-blue-200 border-blue-500/40",
  errored: "bg-rose-500/10 text-rose-200 border-rose-500/40",
  cancelled: "bg-slate-500/10 text-slate-200 border-slate-500/30"
};

const statusFilters = ["all", "running", "awaiting_input", "pending", "completed", "errored", "cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveDefinition(definitions: WorkflowDefinition[], definitionId: string): WorkflowDefinition | null {
  return definitions.find((item) => item.id === definitionId) ?? null;
}

export function WorkflowOverview() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workflowSnapshots = useSessionStore((state) => state.workflowSnapshots);
  const removeWorkflowSnapshot = useSessionStore((state) => state.removeWorkflowSnapshot);
  const clearWorkflowSnapshots = useSessionStore((state) => state.clearWorkflowSnapshots);
  const { data: workflowDefinitions = [] } = useWorkflowDefinitions();

  const workflows = useMemo(() => Object.values(workflowSnapshots), [workflowSnapshots]);
  const filteredWorkflows = useMemo(
    () =>
      statusFilter === "all"
        ? workflows
        : workflows.filter((workflow) => workflow.status.toLowerCase() === statusFilter),
    [statusFilter, workflows]
  );

  const selectedWorkflow: AgentOSWorkflowUpdateChunk["workflow"] | null = useMemo(
    () => (selectedId ? workflows.find((workflow) => workflow.workflowId === selectedId) ?? null : null),
    [selectedId, workflows]
  );

  const selectedDefinition = selectedWorkflow
    ? resolveDefinition(workflowDefinitions, selectedWorkflow.definitionId)
    : null;

  type WorkflowTaskSnapshot = NonNullable<AgentOSWorkflowUpdateChunk["workflow"]["tasks"]>[string];
  const selectedTasks: Array<[string, WorkflowTaskSnapshot]> = selectedWorkflow
    ? (Object.entries(selectedWorkflow.tasks ?? {}) as Array<[string, WorkflowTaskSnapshot]>)
    : [];

  const handleClearHistory = () => {
    if (workflows.length === 0) {
      return;
    }
    if (window.confirm("Clear all stored workflow telemetry?")) {
      clearWorkflowSnapshots();
      setSelectedId(null);
    }
  };

  if (workflows.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Workflow overview</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No workflow updates yet. Launch an automation to populate this panel.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-500">Workflow overview</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Active automations</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-slate-400">{workflows.length} tracked</div>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={workflows.length === 0}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
          >
            Clear history
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        {statusFilters.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatusFilter(option)}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 uppercase tracking-[0.3em]",
              statusFilter === option
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-white/30"
            )}
          >
            {option.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredWorkflows.map((workflow) => {
          const definition = resolveDefinition(workflowDefinitions, workflow.definitionId);
          const statusClass = statusToColor[workflow.status.toLowerCase()] ?? "bg-slate-500/10 text-slate-200 border-slate-500/30";
          const tasks = workflow.tasks ? Object.entries(workflow.tasks) : [];
          const goalMetadata =
            workflow.metadata && typeof workflow.metadata === "object"
              ? (workflow.metadata as Record<string, unknown>).goal
              : undefined;
          const goal = typeof goalMetadata === "string" ? goalMetadata : undefined;

          return (
            <article
              key={workflow.workflowId}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/60 dark:hover:border-white/20"
              onClick={() => setSelectedId(workflow.workflowId)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {definition?.displayName ?? workflow.definitionId}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500">Workflow #{workflow.workflowId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]", statusClass)}>
                    <Activity className="h-3 w-3" />
                    {formatStatus(workflow.status)}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeWorkflowSnapshot(workflow.workflowId);
                      if (selectedId === workflow.workflowId) {
                        setSelectedId(null);
                      }
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[10px] text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/30"
                  >
                    Archive
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>Updated {new Date(workflow.updatedAt).toLocaleTimeString()}</span>
                </div>
                {goal ? <div className="truncate text-slate-700 dark:text-slate-200">Goal: {goal}</div> : null}
              </dl>
              {definition?.description ? (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{definition.description}</p>
              ) : null}
              {tasks.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Tasks</p>
                  <ul className="space-y-2">
                    {tasks.map(([taskId, taskSnapshot]) => {
                      const displayName = definition?.tasks?.find((task) => task.id === taskId)?.name ?? taskId;
                      return (
                        <li key={taskId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3 w-3 text-slate-500" />
                            <span>{displayName}</span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-400">{formatStatus(taskSnapshot.status)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {selectedWorkflow ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/60 backdrop-blur">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <header className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Workflow detail</p>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDefinition?.displayName ?? selectedWorkflow.definitionId}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-500">Instance #{selectedWorkflow.workflowId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/30"
              >
                Close
              </button>
            </header>

            <section className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
              <dl className="grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Status</dt>
                  <dd className="text-slate-700 dark:text-slate-200">{formatStatus(selectedWorkflow.status)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Updated</dt>
                  <dd>{new Date(selectedWorkflow.updatedAt).toLocaleString()}</dd>
                </div>
                {selectedWorkflow.createdAt ? (
                  <div>
                    <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Created</dt>
                    <dd>{new Date(selectedWorkflow.createdAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {selectedWorkflow.conversationId ? (
                  <div>
                    <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Conversation</dt>
                    <dd>{selectedWorkflow.conversationId}</dd>
                  </div>
                ) : null}
              </dl>

              {selectedDefinition?.description ? (
                <p className="text-xs text-slate-600 dark:text-slate-400">{selectedDefinition.description}</p>
              ) : null}

              {(() => {
                const metadataGoal =
                  selectedWorkflow.metadata && typeof selectedWorkflow.metadata === "object"
                    ? (selectedWorkflow.metadata as Record<string, unknown>).goal
                    : undefined;
                if (typeof metadataGoal !== "string") {
                  return null;
                }
                return (
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">Goal</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{metadataGoal}</p>
                  </div>
                );
              })()}

              {selectedWorkflow.metadata ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">Metadata</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200">
                    {JSON.stringify(selectedWorkflow.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}

              {selectedTasks.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Tasks</p>
                  <div className="space-y-3">
                    {selectedTasks.map(([taskId, taskSnapshot]) => {
                      const displayName = selectedDefinition?.tasks?.find((task) => task.id === taskId)?.name ?? taskId;
                      return (
                        <article key={taskId} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
                          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3 w-3 text-slate-500" />
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
                            </div>
                            <span className="text-slate-500 dark:text-slate-400">{formatStatus(taskSnapshot.status)}</span>
                          </div>
                          {taskSnapshot.assignedRoleId ? (
                            <p className="text-xs text-slate-600 dark:text-slate-400">Role: {taskSnapshot.assignedRoleId}</p>
                          ) : null}
                          {taskSnapshot.output !== undefined ? (
                            <ArtifactViewer label="Output" result={taskSnapshot.output} />
                          ) : null}
                          {taskSnapshot.error ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-200">
                              <p className="font-semibold">{taskSnapshot.error.message}</p>
                              {taskSnapshot.error.code ? <p>Code: {taskSnapshot.error.code}</p> : null}
                              {taskSnapshot.error.details ? (
                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-rose-700 dark:text-rose-100">
                                  {JSON.stringify(taskSnapshot.error.details, null, 2)}
                                </pre>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
