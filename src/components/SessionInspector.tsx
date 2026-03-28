import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";
import {
  AgentOSChunkType,
  type AgentOSAgencyUpdateChunk,
  type AgentOSMetadataUpdateChunk,
  type AgentOSWorkflowUpdateChunk,
  type AgentOSToolResultEmissionChunk,
  type AgentOSTextDeltaChunk,
  type AgentOSFinalResponseChunk,
  type AgentOSSystemProgressChunk,
  type AgentOSToolCallRequestChunk,
  type AgentOSResponse
} from "@/types/agentos";
import { AlertTriangle, Database, GitBranch, RefreshCw, Sparkles, Users } from "lucide-react";
import { WidgetEmbed } from "./WidgetEmbed";
import { useSessionStore } from "@/state/sessionStore";
import { ArtifactViewer } from "@/components/ArtifactViewer";
import { exportAllData } from "@/lib/dataExport";
import { clearSessionEvents, deleteSessionRow, persistSessionRow } from "@/lib/storageBridge";
import { SessionConcurrencyInfo } from "./SessionConcurrencyInfo";
import { getConversationHistory, type ConversationSnapshot } from "@/lib/agentosClient";
import { HelpTooltip } from "./ui/HelpTooltip";

const chunkAccent: Record<string, string> = {
  [AgentOSChunkType.TEXT_DELTA]: "border-slate-300 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100",
  [AgentOSChunkType.FINAL_RESPONSE]: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100 dark:text-emerald-100",
  [AgentOSChunkType.TOOL_CALL_REQUEST]: "border-amber-400/40 bg-amber-400/10 text-amber-100 dark:text-amber-100",
  [AgentOSChunkType.TOOL_RESULT_EMISSION]: "border-purple-400/40 bg-purple-400/10 text-purple-100 dark:text-purple-100",
  [AgentOSChunkType.ERROR]: "border-rose-500/40 bg-rose-500/10 text-rose-100 dark:text-rose-100",
  [AgentOSChunkType.METADATA_UPDATE]: "border-cyan-400/60 bg-cyan-50 text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-100",
  [AgentOSChunkType.AGENCY_UPDATE]: "border-sky-400/60 bg-sky-50 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100",
  [AgentOSChunkType.WORKFLOW_UPDATE]: "border-indigo-400/60 bg-indigo-50 text-indigo-900 dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-100"
};

const seatStatusAccent: Record<string, string> = {
  running: "bg-emerald-500/20 text-emerald-100",
  complete: "bg-emerald-600/20 text-emerald-100",
  awaiting_input: "bg-amber-500/20 text-amber-100",
  pending: "bg-slate-500/20 text-slate-200",
  errored: "bg-rose-500/20 text-rose-100"
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toPercent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)}%`;
}

function toScore(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function toCount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return String(Math.max(0, Math.round(value)));
}

function conversationRoleAccent(role: string): string {
  switch (role) {
    case "user":
      return "border-sky-300/40 bg-sky-500/10 text-sky-200";
    case "assistant":
      return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
    case "tool":
      return "border-purple-300/40 bg-purple-500/10 text-purple-200";
    case "summary":
      return "border-amber-300/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-slate-300/30 bg-slate-500/10 text-slate-200";
  }
}

function renderMetadataUpdate(chunk: AgentOSMetadataUpdateChunk) {
  const updates = asObject(chunk.updates) ?? {};
  const taskOutcome = asObject(updates.taskOutcome);
  const taskOutcomeKpi = asObject(updates.taskOutcomeKpi);
  const taskOutcomeAlert = asObject(updates.taskOutcomeAlert);
  const turnPlanning = asObject(updates.turnPlanning);
  const knownKeys = new Set(["taskOutcome", "taskOutcomeKpi", "taskOutcomeAlert", "turnPlanning"]);
  const extraUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => !knownKeys.has(key))
  );
  const hasExtraUpdates = Object.keys(extraUpdates).length > 0;
  const planningPolicy = asObject(turnPlanning?.policy);
  const adaptiveExecution = asObject(turnPlanning?.adaptiveExecution);
  const _adaptiveActions = asObject(adaptiveExecution?.actions);

  const outcomeStatus =
    typeof taskOutcome?.status === "string" ? taskOutcome.status.toLowerCase() : "unknown";
  const statusClass =
    outcomeStatus === "success"
      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200"
      : outcomeStatus === "partial"
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-200"
        : outcomeStatus === "failed"
          ? "bg-rose-500/20 text-rose-700 dark:text-rose-200"
          : "bg-slate-500/20 text-slate-700 dark:text-slate-200";

  return (
    <details className="text-xs leading-relaxed" open={Boolean(taskOutcomeAlert)}>
      <summary className="cursor-pointer select-none text-[10px] uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200">
        Metadata{taskOutcome ? ` • ${outcomeStatus}` : ''}{taskOutcomeKpi ? ` • ${toPercent(taskOutcomeKpi.weightedSuccessRate)}` : ''}{taskOutcomeAlert ? ' • ALERT' : ''}
      </summary>
      <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
        {taskOutcome && (
          <div className="flex items-center gap-2 text-xs">
            <span className={clsx("rounded-full px-1.5 py-0 text-[9px] uppercase", statusClass)}>{outcomeStatus}</span>
            <span>Score: {toScore(taskOutcome.score)}</span>
            <span className="text-slate-500 dark:text-slate-400">{typeof taskOutcome.source === "string" ? taskOutcome.source : "heuristic"}</span>
            {typeof taskOutcome.reason === "string" && taskOutcome.reason.trim().length > 0 && (
              <span className="truncate text-slate-600 dark:text-slate-300">{taskOutcome.reason}</span>
            )}
          </div>
        )}
        {taskOutcomeKpi && (
          <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-slate-700 dark:text-slate-200">
            <span>Weighted: {toPercent(taskOutcomeKpi.weightedSuccessRate)}</span>
            <span>Rate: {toPercent(taskOutcomeKpi.successRate)}</span>
            <span>Samples: {toCount(taskOutcomeKpi.sampleCount)}</span>
            <span className="text-slate-500 dark:text-slate-400">{typeof taskOutcomeKpi.scopeKey === "string" ? taskOutcomeKpi.scopeKey : ""}</span>
          </div>
        )}
        {taskOutcomeAlert && (
          <div className="rounded border border-rose-300/70 bg-rose-50/80 px-2 py-1 text-xs text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100">
            <span className="font-semibold">{typeof taskOutcomeAlert.severity === "string" ? taskOutcomeAlert.severity : "warning"}</span>
            {' '}{typeof taskOutcomeAlert.reason === "string" ? taskOutcomeAlert.reason : "KPI below threshold."}
            <span className="ml-2 text-[10px] opacity-70">{toPercent(taskOutcomeAlert.value)} vs {toPercent(taskOutcomeAlert.threshold)} ({toCount(taskOutcomeAlert.sampleCount)})</span>
          </div>
        )}
        {turnPlanning && (
          <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-slate-700 dark:text-slate-200">
            <span>Fail: {typeof planningPolicy?.toolFailureMode === "string" ? planningPolicy.toolFailureMode : "—"}</span>
            <span>Select: {typeof planningPolicy?.toolSelectionMode === "string" ? planningPolicy.toolSelectionMode : "—"}</span>
            <span>Recall: {typeof planningPolicy?.recallProfile === "string" ? planningPolicy.recallProfile : "—"}</span>
            <span>Adaptive: {adaptiveExecution?.applied === true ? "yes" : "no"}</span>
          </div>
        )}
        {hasExtraUpdates && (
          <details className="text-[10px]">
            <summary className="cursor-pointer select-none text-slate-600 dark:text-slate-300">Extra metadata</summary>
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(extraUpdates, null, 2)}</pre>
          </details>
        )}
        {!taskOutcome && !taskOutcomeKpi && !taskOutcomeAlert && !turnPlanning && !hasExtraUpdates && (
          <p className="text-slate-600 dark:text-slate-300">Metadata update received.</p>
        )}
      </div>
    </details>
  );
}

function renderWorkflowUpdate(chunk: AgentOSWorkflowUpdateChunk) {
  const tasks = chunk.workflow.tasks ? Object.entries(chunk.workflow.tasks) : [];
  const goalMetadata =
    chunk.workflow.metadata && typeof chunk.workflow.metadata === "object"
      ? (chunk.workflow.metadata as Record<string, unknown>).goal
      : undefined;
  const goal = typeof goalMetadata === "string" ? goalMetadata : undefined;

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{chunk.workflow.definitionId}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-300">{formatStatus(chunk.workflow.status)}</span>
      </div>
      {goal && <p className="text-slate-600 dark:text-slate-300 truncate">{goal}</p>}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tasks.map(([taskId, taskSnapshot]) => (
            <span key={taskId} className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-white/10">
              <GitBranch className="h-2.5 w-2.5 text-slate-400" />
              {taskId}: {formatStatus(taskSnapshot.status)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function renderAgencyUpdate(chunk: AgentOSAgencyUpdateChunk) {
  const seats = chunk.agency.seats ?? [];
  const goal =
    chunk.agency.metadata && typeof chunk.agency.metadata.goal === "string"
      ? chunk.agency.metadata.goal
      : null;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3 text-sky-500" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">Agency {chunk.agency.agencyId}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{chunk.agency.workflowId}</span>
      </div>
      {goal && <p className="text-slate-600 dark:text-slate-300 truncate">{goal}</p>}
      {seats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {seats.map((seat) => (
            <span key={seat.roleId} className="inline-flex items-center gap-1 rounded border border-sky-200 px-1.5 py-0.5 text-[10px] dark:border-white/10">
              <span className="font-semibold">{seat.roleId}</span>: {seat.personaId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function renderEventBody(type: AgentOSChunkType | "log", payload: unknown): ReactNode {
  if (type === "log") {
    return (
      <div className="flex items-start gap-3 text-sm text-slate-200">
        <Users className="mt-0.5 h-4 w-4" />
        <p>{(payload as { message: string }).message}</p>
      </div>
    );
  }

  if (type === AgentOSChunkType.AGENCY_UPDATE) {
    return renderAgencyUpdate(payload as AgentOSAgencyUpdateChunk);
  }

  if (type === AgentOSChunkType.WORKFLOW_UPDATE) {
    return renderWorkflowUpdate(payload as AgentOSWorkflowUpdateChunk);
  }

  if (type === AgentOSChunkType.TOOL_RESULT_EMISSION) {
    const chunk = payload as AgentOSToolResultEmissionChunk;
    return (
      <div className="space-y-3 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Tool result</p>
            <p className="text-slate-100">{chunk.toolName}</p>
          </div>
          <span className={clsx("text-xs", chunk.isSuccess ? "text-emerald-300" : "text-rose-300")}>{chunk.isSuccess ? "Success" : "Failed"}</span>
        </div>
        {chunk.errorMessage && <p className="text-xs text-rose-300">{chunk.errorMessage}</p>}
        <ArtifactViewer result={chunk.toolResult} />
      </div>
    );
  }

  if (type === AgentOSChunkType.SYSTEM_PROGRESS) {
    const prog = payload as AgentOSSystemProgressChunk;
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-200">{prog.message}</p>
        {prog.progressPercentage != null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, prog.progressPercentage))}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (type === AgentOSChunkType.ERROR) {
    const errorPayload = payload as { message: string; code?: string };
    const msg = errorPayload.message || '';
    let help: string | null = null;
    if (/persona .* not found/i.test(msg)) {
      help = 'Persona not found. Pick a listed persona or switch session to a valid persona.';
    } else if (/access denied|requires tier/i.test(msg)) {
      help = 'Access denied. In development, enable AGENTOS_DEV_ALLOW_ALL=true and restart, or choose a free persona.';
    }
    return (
      <div className="flex items-start gap-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4" />
        <div>
          <p className="font-semibold">{errorPayload.message}</p>
          {errorPayload.code && <p className="text-xs text-slate-300">Code: {errorPayload.code}</p>}
          {help && <p className="text-xs text-amber-300">{help}</p>}
        </div>
      </div>
    );
  }

  if (type === AgentOSChunkType.METADATA_UPDATE) {
    return renderMetadataUpdate(payload as AgentOSMetadataUpdateChunk);
  }

  // Don't render individual FINAL_RESPONSE events - they're aggregated into assistant messages
  if (type === AgentOSChunkType.FINAL_RESPONSE) {
    return null;
  }
  
  // Don't render individual TEXT_DELTA events - they're aggregated into assistant messages  
  if (type === AgentOSChunkType.TEXT_DELTA) {
    return null;
  }

  return (
    <pre className="max-h-64 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

/** A segment of parsed content: either plain markdown or an embedded widget. */
type ContentSegment = { type: "markdown"; content: string } | { type: "widget"; content: string };

/**
 * Split text on `:::widget\n...\n:::` fenced blocks into alternating markdown
 * and widget segments.  Segments with only whitespace are dropped.
 */
function parseContentSegments(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /:::widget\n([\s\S]*?)\n:::/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const before = text.slice(cursor, match.index);
    if (before.trim().length > 0) {
      segments.push({ type: "markdown", content: before });
    }
    if (match[1].trim().length > 0) {
      segments.push({ type: "widget", content: match[1] });
    }
    cursor = match.index + match[0].length;
  }

  const tail = text.slice(cursor);
  if (tail.trim().length > 0) {
    segments.push({ type: "markdown", content: tail });
  }

  return segments.length > 0 ? segments : [{ type: "markdown", content: text }];
}

/**
 * Animated streaming text renderer. It animates towards the provided `text` string.
 */
function StreamingText({ text, isActive }: { text: string; isActive: boolean }) {
  const [displayed, setDisplayed] = useState(text);
  const [showCursor, setShowCursor] = useState(isActive);
  const renderedRef = useRef(text);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setShowCursor(isActive);
  }, [isActive]);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const current = renderedRef.current;
    const target = text;

    if (!isActive || target.length <= current.length || !target.startsWith(current)) {
      renderedRef.current = target;
      setDisplayed(target);
      return;
    }

    const delta = target.slice(current.length);
    let revealed = 0;
    const step = () => {
      const chunkSize = Math.max(1, Math.ceil(delta.length / 18));
      revealed = Math.min(delta.length, revealed + chunkSize);
      const nextValue = current + delta.slice(0, revealed);
      renderedRef.current = nextValue;
      setDisplayed(nextValue);
      if (revealed < delta.length) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [text, isActive]);

  if (!displayed && isActive) {
    return (
      <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
        <span className="mr-2">Thinking</span>
        <span className="inline-block h-4 w-1 animate-pulse bg-sky-500" />
      </div>
    );
  }

  const segments = parseContentSegments(displayed);

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:text-slate-800 dark:prose-p:text-slate-200 prose-li:text-slate-800 dark:prose-li:text-slate-200 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-pre:bg-slate-100 prose-pre:text-slate-800 dark:prose-pre:bg-slate-950 dark:prose-pre:text-slate-100">
      {segments.map((seg, i) =>
        seg.type === "widget"
          ? <WidgetEmbed key={i} html={seg.content} />
          : <ReactMarkdown key={i}>{seg.content}</ReactMarkdown>
      )}
      {showCursor && <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-sky-500" aria-hidden="true" />}
    </div>
  );
}

/**
 * Smooth, dynamic progress bar that animates between reported system progress
 * percentages and gently advances toward 90% when no updates are received,
 * snapping to 100% when final arrives.
 */
function StreamProgress({
  updatedAt,
  lastPercent
}: {
  updatedAt: number;
  lastPercent?: number;
}) {
  const [value, setValue] = useState<number>(typeof lastPercent === 'number' ? lastPercent : 10);
  const [finalized, setFinalized] = useState<boolean>(false);

  // Snap upwards when new reported percent arrives
  useEffect(() => {
    if (typeof lastPercent === 'number') {
      setValue((prev) => Math.max(prev, Math.min(99, lastPercent)));
    }
  }, [lastPercent]);

  // Gentle self-advance toward 90% while active
  useEffect(() => {
    if (finalized) return;
    const tick = setInterval(() => {
      setValue((prev) => {
        const target = typeof lastPercent === 'number' ? Math.max(90, lastPercent) : 90;
        const next = prev + Math.max(0.5, (target - prev) * 0.08);
        return Math.min(target, next);
      });
    }, 150);
    return () => clearInterval(tick);
  }, [lastPercent, finalized]);

  // When updatedAt stops changing for a short time, assume completion arrived soon
  useEffect(() => {
    const t = setTimeout(() => {
      // If FINAL hasn't arrived yet, do nothing; the parent will re-render on final
    }, 500);
    return () => clearTimeout(t);
  }, [updatedAt]);

  // Expose a helper to allow parent to mark final by percent=100 via lastPercent
  useEffect(() => {
    if (typeof lastPercent === 'number' && lastPercent >= 100) {
      setFinalized(true);
      setValue(100);
    }
  }, [lastPercent]);

  const display = Math.round(Math.min(100, value));

  return (
    <div className="mb-2">
      <div className="h-1.5 w-full overflow-hidden rounded bg-slate-700/30 dark:bg-slate-700/50">
        <div
          className="h-1.5 rounded bg-sky-500 transition-[width] duration-200 ease-out"
          style={{ width: `${display}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
        {display < 100 ? `Processing… (${display}%)` : 'Finalizing…'}
      </div>
    </div>
  );
}

type AggregatedAssistantRow = {
  kind: "assistant";
  streamId: string;
  personaId: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  isFinal: boolean;
  logLines: string[];
  progressItems: Array<{ stamp: string; payload: AgentOSSystemProgressChunk }>;
};

type SimpleRow = {
  kind: "event";
  id: string;
  timestamp: number;
  type: AgentOSChunkType | "log";
  payload: AgentOSResponse | { message: string; level?: string };
};

function buildAggregatedRows(events: Array<{ id: string; timestamp: number; type: AgentOSChunkType | "log"; payload: AgentOSResponse | { message: string; level?: string } }>): Array<AggregatedAssistantRow | SimpleRow> {
  // Events are stored oldest → newest already; iterate in that order for correct streaming aggregation
  const chronological = [...events];
  const rows: Array<AggregatedAssistantRow | SimpleRow> = [];
  const byStream: Record<string, AggregatedAssistantRow> = {};

  for (const e of chronological) {
    // Normalize upstream types (backend may send UPPERCASE)
    const typeNorm = (typeof e.type === 'string' ? (e.type as string).toLowerCase() : e.type) as AgentOSChunkType | 'log';
    const payloadAny = e.payload as { type?: string; streamId?: string; personaId?: string };
    const rawType = (payloadAny && typeof payloadAny.type === 'string') ? payloadAny.type.toLowerCase() : String(typeNorm);

    // Treat AgentOS final markers as metadata to close the assistant row, not as visible content
    if (rawType.includes('final') && rawType.includes('marker')) {
      const streamId = payloadAny?.streamId;
      if (streamId) {
        const row = byStream[streamId] || {
          kind: "assistant",
          streamId,
          personaId: payloadAny.personaId,
          createdAt: e.timestamp,
          updatedAt: e.timestamp,
          text: "",
          isFinal: true,
          logLines: [],
          progressItems: [],
        };
        row.updatedAt = e.timestamp;
        row.isFinal = true;
        byStream[streamId] = row;
      }
      continue;
    }

    if (typeNorm === AgentOSChunkType.TEXT_DELTA) {
      const chunk = e.payload as AgentOSTextDeltaChunk;
      const row = byStream[chunk.streamId] || {
        kind: "assistant",
        streamId: chunk.streamId,
        personaId: chunk.personaId,
        createdAt: e.timestamp,
        updatedAt: e.timestamp,
        text: "",
        isFinal: false,
        logLines: [],
        progressItems: [],
      };
      row.text += chunk.textDelta || "";
      row.updatedAt = e.timestamp;
      byStream[chunk.streamId] = row;
      continue;
    }

    if (typeNorm === AgentOSChunkType.FINAL_RESPONSE) {
      const chunk = e.payload as AgentOSFinalResponseChunk;
      const row = byStream[chunk.streamId] || {
        kind: "assistant",
        streamId: chunk.streamId,
        personaId: chunk.personaId,
        createdAt: e.timestamp,
        updatedAt: e.timestamp,
        text: "",
        isFinal: false,
        logLines: [],
        progressItems: [],
      };
      // Use the final response content ONLY if nothing was streamed yet, and ignore final markers
      const asAny = chunk as unknown as { content?: string };
      const candidate = (typeof asAny.content === 'string' && asAny.content.trim().length > 0)
        ? asAny.content
        : (typeof chunk.finalResponseText === 'string' ? chunk.finalResponseText : '');
      const isMarkerPhrase = candidate.trim().toLowerCase() === 'turn processing sequence complete.';
      if (row.text.trim().length === 0 && candidate.trim().length > 0 && !isMarkerPhrase) {
        row.text = candidate;
      }
      row.updatedAt = e.timestamp;
      row.isFinal = true;
      byStream[chunk.streamId] = row;
      continue;
    }

    // For TOOL_*, ERROR, and METADATA_UPDATE, keep brief lines under the assistant's debug section
    if (
      typeNorm === AgentOSChunkType.TOOL_CALL_REQUEST ||
      typeNorm === AgentOSChunkType.TOOL_RESULT_EMISSION ||
      typeNorm === AgentOSChunkType.ERROR ||
      typeNorm === AgentOSChunkType.METADATA_UPDATE
    ) {
      const chunk = e.payload as AgentOSResponse;
      const streamId = (chunk as { streamId?: string }).streamId;
      // Try to attach to matching stream row, or fall back to most recent stream row
      const targetStreamId = (streamId && byStream[streamId]) ? streamId : Object.keys(byStream).pop();
      if (targetStreamId && byStream[targetStreamId]) {
        const row = byStream[targetStreamId];
        const stamp = new Date(e.timestamp).toLocaleTimeString();
        if (typeNorm === AgentOSChunkType.TOOL_CALL_REQUEST) {
          const tcr = chunk as AgentOSToolCallRequestChunk;
          row.logLines.push(`[${stamp}] tool_call: ${tcr.toolCalls.map(tc => tc.name).join(', ')}`);
        } else if (typeNorm === AgentOSChunkType.TOOL_RESULT_EMISSION) {
          const tre = chunk as AgentOSToolResultEmissionChunk;
          row.logLines.push(`[${stamp}] tool_result: ${tre.toolName} ${tre.isSuccess ? '✓' : '✕'}`);
        } else if (typeNorm === AgentOSChunkType.ERROR) {
          const err = chunk as { message?: string };
          row.logLines.push(`[${stamp}] error: ${err.message || 'Unknown error'}`);
        } else if (typeNorm === AgentOSChunkType.METADATA_UPDATE) {
          const meta = chunk as AgentOSMetadataUpdateChunk;
          const updates = asObject(meta.updates) ?? {};
          const taskOutcome = asObject(updates.taskOutcome);
          const taskOutcomeKpi = asObject(updates.taskOutcomeKpi);
          const taskOutcomeAlert = asObject(updates.taskOutcomeAlert);
          const parts: string[] = [];
          if (taskOutcome) {
            const status = typeof taskOutcome.status === 'string' ? taskOutcome.status : '?';
            parts.push(`outcome:${status}`);
          }
          if (taskOutcomeKpi) parts.push(`kpi:${toPercent(taskOutcomeKpi.weightedSuccessRate)}`);
          if (taskOutcomeAlert) parts.push('ALERT');
          row.logLines.push(`[${stamp}] metadata: ${parts.length > 0 ? parts.join(' ') : 'update'}`);
        }
        continue;
      }
    }

    // SYSTEM_PROGRESS goes under assistant logs, consolidated
    if (typeNorm === AgentOSChunkType.SYSTEM_PROGRESS) {
      const prog = e.payload as AgentOSSystemProgressChunk;
      const streamId = (prog as { streamId?: string }).streamId;
      if (streamId) {
        const row = byStream[streamId] || {
          kind: "assistant",
          streamId,
          personaId: prog.personaId,
          createdAt: e.timestamp,
          updatedAt: e.timestamp,
          text: "",
          isFinal: false,
          logLines: [],
          progressItems: [],
        };
        row.updatedAt = e.timestamp;
        row.progressItems.push({ stamp: new Date(e.timestamp).toLocaleTimeString(), payload: prog });
        byStream[streamId] = row;
        continue;
      }
    }

    // Fallback: push as a simple row (skip types aggregated into debug logs)
    // Note: TEXT_DELTA and FINAL_RESPONSE are already handled above and won't reach here
    if (typeNorm !== AgentOSChunkType.SYSTEM_PROGRESS && typeNorm !== AgentOSChunkType.METADATA_UPDATE) {
      rows.push({ kind: "event", id: e.id, timestamp: e.timestamp, type: typeNorm as AgentOSChunkType, payload: e.payload });
    }
  }

  // Push all aggregated assistant rows into rows list
  for (const row of Object.values(byStream)) {
    rows.push(row);
  }

  // Render newest first so fresh activity bubbles to the top of the timeline
  rows.sort((a, b) => {
    const ta = a.kind === "assistant" ? a.updatedAt : a.timestamp;
    const tb = b.kind === "assistant" ? b.updatedAt : b.timestamp;
    return tb - ta;
  });

  return rows;
}

export function SessionInspector() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const session = useSessionStore((state) => state.sessions.find((item) => item.id === state.activeSessionId));
  const personas = useSessionStore((state) => state.personas);
  const agencies = useSessionStore((state) => state.agencies);
  const agencySessionsState = useSessionStore((state) => state.agencySessions);
  const removeSession = useSessionStore((s) => s.removeSession);
  const upsertSession = useSessionStore((s) => s.upsertSession);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [conversationSnapshot, setConversationSnapshot] = useState<ConversationSnapshot | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationUnsupported, setConversationUnsupported] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const isAgencySession = session?.targetType === "agency";
  const sessionId = session?.id ?? null;
  const agencySnapshot =
    isAgencySession && session?.agencyId ? agencySessionsState[session.agencyId] ?? null : null;
  const agencyDefinition =
    isAgencySession && session?.agencyId ? agencies.find((agency) => agency.id === session.agencyId) ?? null : null;
  const seatSnapshots =
    isAgencySession
      ? agencySnapshot?.seats?.map((seat) => ({
          roleId: seat.roleId,
          personaId: seat.personaId,
          gmiInstanceId: seat.gmiInstanceId,
          status: typeof seat.metadata?.status === "string" ? seat.metadata.status : undefined,
          notes: typeof seat.metadata?.notes === "string" ? seat.metadata.notes : undefined
        })) ??
        agencyDefinition?.participants.map((participant) => ({
          roleId: participant.roleId,
          personaId: participant.personaId ?? "unassigned",
          gmiInstanceId: "pending",
          status: "pending",
          notes: participant.notes
        })) ??
        []
      : [];
  const lastAgencyEvent =
    isAgencySession && session
      ? session.events.find((event) => event.type === AgentOSChunkType.AGENCY_UPDATE)
      : null;
  const agencyGoal =
    isAgencySession && agencySnapshot?.metadata && typeof agencySnapshot.metadata.goal === "string"
      ? agencySnapshot.metadata.goal
      : agencyDefinition?.goal;
  const workflowIdentifier = agencySnapshot?.workflowId ?? agencyDefinition?.workflowId;
  const timelineContainerClass = clsx(
    "relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10",
    isAgencySession
      ? "bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:text-slate-100"
      : "bg-white text-slate-900 dark:bg-slate-900/50 dark:text-slate-100"
  );
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const persistSessionSnapshot = useCallback((sessionId: string) => {
    const latest = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
    if (latest) {
      void persistSessionRow(latest);
    }
  }, []);

  const loadConversationSnapshot = useCallback(async () => {
    if (!sessionId) {
      setConversationSnapshot(null);
      setConversationUnsupported(false);
      setConversationError(null);
      return;
    }

    setConversationLoading(true);
    setConversationError(null);
    try {
      const response = await getConversationHistory(sessionId);
      setConversationSnapshot(response.conversation);
      setConversationUnsupported(Boolean(response.unsupported));
      setConversationError(response.error ?? null);
    } catch (error) {
      setConversationSnapshot(null);
      setConversationUnsupported(false);
      setConversationError(error instanceof Error ? error.message : "Failed to load conversation context");
    } finally {
      setConversationLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadConversationSnapshot();
  }, [loadConversationSnapshot]);

  // Effect to scroll to bottom on new messages, but only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp && timelineScrollRef.current) {
      const container = timelineScrollRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      });
    }
  }, [session?.id, session?.events.length, userScrolledUp]);

  // Handle user scrolling
  const handleScroll = useCallback(() => {
    if (timelineScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = timelineScrollRef.current;
      // If scrolled near the bottom (within 100px), reset userScrolledUp
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setUserScrolledUp(false);
      } else {
        setUserScrolledUp(true);
      }
    }
  }, []);

  useEffect(() => {
    const container = timelineScrollRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleExport = () => {
    if (!session) return;
    const payload = {
      id: session.id,
      targetType: session.targetType,
      displayName: session.displayName,
      personaId: session.personaId,
      agencyId: session.agencyId,
      events: [...session.events].reverse() // chronological
    };
    const data = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentos-session-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportAgency = () => {
    if (!session) return;
    const items = [...session.events]
      .reverse()
      .filter((e) => e.type === AgentOSChunkType.AGENCY_UPDATE)
      .map((e) => ({ timestamp: e.timestamp, ...e.payload }));
    const data = new Blob([JSON.stringify({ sessionId: session.id, agencyUpdates: items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentos-agency-updates-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportWorkflow = () => {
    if (!session) return;
    const items = [...session.events]
      .reverse()
      .filter((e) => e.type === AgentOSChunkType.WORKFLOW_UPDATE)
      .map((e) => ({ timestamp: e.timestamp, ...e.payload }));
    const data = new Blob([JSON.stringify({ sessionId: session.id, workflowUpdates: items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentos-workflow-updates-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!activeSessionId || !session) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/50">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Session timeline</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Output</h2>
            </div>
            <HelpTooltip label="Explain session inspector" side="bottom">
              Review the live event timeline, export traces, inspect persisted conversation context, and manage the
              current session without leaving the workbench.
            </HelpTooltip>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400"></div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
              Waiting for the first event. Use the left panel to compose a request.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const conversationMessages = Array.isArray(conversationSnapshot?.messages)
    ? conversationSnapshot.messages
    : [];
  const recentConversationMessages = [...conversationMessages].slice(-4).reverse();
  const conversationMessageCount = conversationSnapshot?.messageCount ?? conversationMessages.length;
  const conversationTurnCount = conversationMessages.filter((message) => message.role === "user").length;
  const conversationLastActiveAt = conversationSnapshot?.lastActiveAt ?? conversationSnapshot?.createdAt ?? null;

  return (
    <div className={timelineContainerClass}>
      {showRenameModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Rename session</h3>
            <input
              autoFocus
              defaultValue={session.displayName}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowRenameModal(false)} title="Close the rename dialog without changing the session name." className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">Cancel</button>
              <button
                onClick={() => {
                  const nextName = (nameDraft || session.displayName || 'Untitled').trim();
                  upsertSession({ id: session.id, displayName: nextName });
                  persistSessionSnapshot(session.id);
                  setShowRenameModal(false);
                }}
                title="Save the new display name for this session."
                className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-4 shadow-xl dark:border-rose-900/40 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">Delete session?</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">This action cannot be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} title="Keep this session and close the delete confirmation." className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">Cancel</button>
              <button
                onClick={() => {
                  removeSession(session.id);
                  void deleteSessionRow(session.id);
                  setShowDeleteModal(false);
                }}
                title="Permanently delete this session and its local persisted state."
                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showClearModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Clear history?</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">This will remove all events from this session.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowClearModal(false)} title="Close the clear-history dialog without removing any events." className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">Cancel</button>
              <button
                onClick={() => {
                  upsertSession({ id: session.id, events: [], status: 'idle' });
                  void clearSessionEvents(session.id);
                  persistSessionSnapshot(session.id);
                  setShowClearModal(false);
                }}
                title="Remove all recorded events from this session while keeping the session entry."
                className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Session timeline</p>
          {!renaming ? (
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{session.displayName}</h2>
          ) : (
            <div className="flex items-center gap-2">
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-slate-900" />
              <button
                type="button"
                onClick={() => {
                  const nextName = (nameDraft || 'Untitled').trim();
                  upsertSession({ id: session.id, displayName: nextName });
                  persistSessionSnapshot(session.id);
                  setRenaming(false);
                }}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              >
                Save
              </button>
              <button type="button" onClick={() => setRenaming(false)} title="Cancel inline renaming and keep the current session name." className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">Cancel</button>
            </div>
          )}
          </div>
          <HelpTooltip label="Explain session inspector" side="bottom">
            Review live events, export traces, rename sessions, and inspect persisted conversation state for the
            currently selected run.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                aria-label="Export"
                title="Export traces, rename the session, or clear/delete local session history."
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                onChange={(e) => {
                  const v = e.target.value; e.currentTarget.selectedIndex = 0; // reset
                  if (v === 'session') handleExport();
                  if (v === 'agency') handleExportAgency();
                  if (v === 'workflow') handleExportWorkflow();
                  if (v === 'all' && session) {
                    exportAllData(session, 'json', `agentos-session-${session.id}`);
                  }
                  if (v === 'rename') setShowRenameModal(true);
                  if (v === 'delete') setShowDeleteModal(true);
                  if (v === 'clear') setShowClearModal(true);
                }}
              >
                <option value="">Export…</option>
                <option value="session">Session</option>
                <option value="agency">Agency updates</option>
                <option value="workflow">Workflow trace</option>
                <option value="all">All data</option>
                <option value="rename">Rename session…</option>
                <option value="delete">Delete session</option>
                <option value="clear">Clear history</option>
              </select>
            </div>
          </div>
        </div>
      </header>
      <div ref={timelineScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2.5">
          {/* Session Concurrency Info */}
          <SessionConcurrencyInfo sessionStatus={session.status} />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Conversation Context</p>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Backend history and persisted state</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadConversationSnapshot()}
                title="Reload persisted conversation history from the connected backend."
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              >
                <RefreshCw className={clsx("h-3 w-3", conversationLoading && "animate-spin")} />
                Refresh
              </button>
            </header>

            {conversationUnsupported ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                This runtime does not expose `getConversationHistory()`, so the workbench can only show the local event timeline.
              </p>
            ) : conversationError ? (
              <div className="rounded-xl border border-rose-300/50 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {conversationError}
              </div>
            ) : conversationLoading && !conversationSnapshot ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">Loading persisted conversation state…</p>
            ) : conversationSnapshot ? (
              <div className="space-y-3">
                <dl className="grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <dt className="uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Messages</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{conversationMessageCount}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Turns</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{conversationTurnCount}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Persona</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {conversationSnapshot.activePersonaId ?? session.personaId ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Last active</dt>
                    <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {conversationLastActiveAt ? new Date(conversationLastActiveAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-2 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Session metadata</p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                      Session: <span className="font-mono">{conversationSnapshot.sessionId ?? session.id}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                      User: <span className="font-mono">{conversationSnapshot.userId ?? "agentos-workbench-user"}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                      Language: <span className="font-mono">{conversationSnapshot.currentLanguage ?? "—"}</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Recent persisted messages</p>
                    {recentConversationMessages.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {recentConversationMessages.map((message, index) => (
                          <div key={`${message.id ?? message.timestamp ?? index}-${index}`} className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/60">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className={clsx("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.25em]", conversationRoleAccent(message.role))}>
                                {message.role}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ""}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                              {message.content.length > 220 ? `${message.content.slice(0, 220)}…` : message.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">No persisted messages available yet.</p>
                    )}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <summary className="cursor-pointer select-none text-[10px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    Raw metadata
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-700 dark:text-slate-200">
                    {JSON.stringify(
                      {
                        sessionMetadata: conversationSnapshot.sessionMetadata ?? {},
                        config: conversationSnapshot.config ?? {},
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                No persisted conversation was found for this session yet. The local event timeline below is still available.
              </p>
            )}
          </section>

          {isAgencySession && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg dark:border-sky-500/40 dark:bg-slate-950/80 dark:text-slate-100">
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Agency overview</p>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {agencyDefinition?.name ?? session.displayName}
                  </h3>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  {agencySnapshot ? "Live telemetry" : "Awaiting updates"}
                </div>
              </header>
              <dl className="grid gap-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-3">
                <div>
                  <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Agency</dt>
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{session.agencyId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Workflow</dt>
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{workflowIdentifier ?? "Not attached"}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Last update</dt>
                  <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {lastAgencyEvent ? new Date(lastAgencyEvent.timestamp).toLocaleTimeString() : "—"}
                  </dd>
                </div>
              </dl>
              {agencyGoal && <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{agencyGoal}</p>}
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {seatSnapshots.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                    Configure participants for this agency to see seat telemetry.
                  </p>
                ) : (
                  seatSnapshots.map((seat) => {
                    const personaName =
                      personas.find((persona) => persona.id === seat.personaId)?.displayName ?? seat.personaId ?? "Unassigned";
                    const statusKey = (seat.status ?? "pending").toLowerCase();
                    const statusClass = seatStatusAccent[statusKey] ?? seatStatusAccent.pending;
                    return (
                      <div
                        key={`${seat.roleId}-${seat.gmiInstanceId}-${personaName}`}
                        className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                            {seat.roleId}
                          </p>
                          <span className={clsx("rounded-full px-2 py-0.5 text-[10px] uppercase", statusClass)}>
                            {statusKey.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{personaName}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {seat.notes ?? (seat.gmiInstanceId !== "pending" ? seat.gmiInstanceId : "Awaiting assignment")}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* Raw stream debug (last 10 events) */}
            <details
              className={clsx(
                "rounded-xl border p-3 text-xs",
                isAgencySession
                  ? "border-white/10 bg-slate-900/60 text-slate-200"
                  : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"
              )}
            >
              <summary className="cursor-pointer select-none">Stream debug</summary>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {[...session.events]
                  .slice(0, 10)
                  .map((e) => (
                    <div key={e.id} className="rounded border border-white/10 bg-slate-950/30 p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase">{String(e.type)}</span>
                        <time className="text-[11px]">{new Date(e.timestamp).toLocaleTimeString()}</time>
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(e.payload, null, 2)}</pre>
                    </div>
                  ))}
              </div>
            </details>
          {session.events.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
              Waiting for the first event. Use the composer to send a message or replay a transcript to populate the timeline.
            </div>
          ) : (
            buildAggregatedRows(session.events).map((row) => {
              if (row.kind === "assistant") {
                const isActive = !row.isFinal;
                return (
              <div key={`assistant-${row.streamId}`} className={clsx("rounded-xl border px-3 py-2.5", "border-slate-300 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100")}>
                    <header className="mb-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase tracking-[0.35em]">{`Agent: ${personas.find(p => p.id === row.personaId)?.displayName || row.personaId || 'Agent'}`}</span>
                      <div className="flex items-center gap-2">
                        {row.isFinal && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>}
                        <time>{new Date(row.updatedAt).toLocaleTimeString()}</time>
                      </div>
                    </header>
                    {!row.isFinal && (
                      <StreamProgress
                        updatedAt={row.updatedAt}
                        lastPercent={
                          row.progressItems.length > 0
                            ? (row.progressItems[row.progressItems.length - 1].payload.progressPercentage ?? undefined)
                            : undefined
                        }
                      />
                    )}
                    <StreamingText text={row.text} isActive={isActive} />
                {(row.logLines.length > 0 || row.progressItems.length > 0) && (
                  <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-xs dark:border-white/10 dark:bg-slate-800/50">
                    <summary className="cursor-pointer select-none text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
                      <span className="font-medium">Logs</span>
                      <span className="ml-2 text-[10px]">({row.logLines.length + row.progressItems.length} entries)</span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      {row.progressItems.map((item, idx) => (
                        <div key={`prog-${idx}`} className="font-mono text-[11px] text-blue-400">
                          [{item.stamp}] {item.payload.message}
                          {item.payload.progressPercentage != null && ` (${item.payload.progressPercentage}%)`}
                        </div>
                      ))}
                      {row.logLines.map((line, idx) => (
                        <div key={idx} className="font-mono text-[11px] text-slate-400">{line}</div>
                      ))}
                    </div>
                  </details>
                )}
                  </div>
                );
              }

              // Skip rendering TEXT_DELTA, FINAL_RESPONSE, SYSTEM_PROGRESS - they're aggregated
              if (row.type === AgentOSChunkType.TEXT_DELTA || 
                  row.type === AgentOSChunkType.FINAL_RESPONSE || 
                  row.type === AgentOSChunkType.SYSTEM_PROGRESS) {
                return null;
              }

              const chunkClass = chunkAccent[row.type] ?? "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/5 dark:bg-white/5 dark:text-slate-200";
              const headerLabel = row.type === 'log' ? 'User' : String(row.type).replace(/_/g, ' ');
              return (
                <Fragment key={row.id}>
                  <div className={clsx("rounded-xl border px-3 py-2", chunkClass)}>
                    <header className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase tracking-[0.3em]">{headerLabel}</span>
                      <time>{new Date(row.timestamp).toLocaleTimeString()}</time>
                    </header>
                    {renderEventBody(row.type, row.payload)}
                  </div>
                </Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
